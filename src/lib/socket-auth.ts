import { and, eq, gt } from "drizzle-orm";
import type { Socket } from "socket.io";

import { db } from "../db";
import { sessions } from "../db/schema/users";
import { users } from "../db/schema/users";
import { SESSION_COOKIE_NAME } from "./auth-constants";

function extractSessionToken(cookieHeader: string): string | undefined {
  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");

    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return undefined;
}

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
) {
  const cookieHeader = socket.handshake.headers.cookie;

  if (!cookieHeader) {
    next(new Error("unauthorized"));
    return;
  }

  const rawToken = extractSessionToken(cookieHeader);

  if (!rawToken) {
    next(new Error("unauthorized"));
    return;
  }

  // better-auth stores "token.hash" in the cookie but only "token" in the DB
  const token = rawToken.split(".")[0];

  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      username: users.username,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    console.log("[socket-auth] REJECTED: no valid session for token");
    next(new Error("unauthorized"));
    return;
  }

  socket.data.userId = row.userId;
  socket.data.sessionId = row.sessionId;
  socket.data.username = row.username;

  console.log(`[socket-auth] OK: userId=${row.userId} username=${row.username}`);
  next();
}
