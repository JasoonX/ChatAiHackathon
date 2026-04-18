import type { Socket } from "socket.io";

import { auth } from "./auth";
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

  const token = extractSessionToken(cookieHeader);

  if (!token) {
    next(new Error("unauthorized"));
    return;
  }

  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookieHeader }),
  });

  if (!session) {
    next(new Error("unauthorized"));
    return;
  }

  socket.data.userId = session.user.id;
  socket.data.sessionId = session.session.id;
  socket.data.username = session.user.username;

  next();
}
