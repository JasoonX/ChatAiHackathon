import { access, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

import { and, count, eq, gt } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, resetDb } from "../../../../../tests/setup/integration";
import { friendships, friendRequests, userBans } from "../../../../db/schema/friends";
import { attachments, messages } from "../../../../db/schema/messages";
import { roomMembers, rooms } from "../../../../db/schema/rooms";
import { sessions, users } from "../../../../db/schema/users";
import { SESSION_COOKIE_NAME } from "../../../../lib/auth-constants";
import { handleAuthRequest } from "../../../../lib/auth";
import { deleteUserAccount } from "../../../../server/account-deletion";

const UPLOADS_DIR = join(process.cwd(), "uploads");

function getFriendPairKey(userAId: string, userBId: string) {
  return userAId < userBId ? `${userAId}:${userBId}` : `${userBId}:${userAId}`;
}

type RouteHandler = (request: Request) => Promise<Response>;

async function getCurrentUserFromHeaders(headers: Headers) {
  const cookieHeader = headers.get("cookie") ?? "";
  const rawToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(`${SESSION_COOKIE_NAME}=`.length);

  const token = rawToken?.split(".")[0];

  if (!token) {
    return null;
  }

  const [session] = await db
    .select({
      id: sessions.userId,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return session ?? null;
}

async function deleteCurrentUserHandler(request: Request) {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteUserAccount(user.id);

  const response = Response.json({ success: true });
  response.headers.append(
    "set-cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`,
  );
  return response;
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1:3000");

  let handler: RouteHandler | undefined;
  if (requestUrl.pathname.startsWith("/api/auth/")) {
    handler = handleAuthRequest;
  } else if (requestUrl.pathname === "/api/users/me" && req.method === "DELETE") {
    handler = deleteCurrentUserHandler;
  }

  if (!handler) {
    res.statusCode = 404;
    res.end("Not Found");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const requestHeaders = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        requestHeaders.append(key, item);
      }
      continue;
    }

    if (value !== undefined) {
      requestHeaders.set(key, value);
    }
  }

  const webRequest = new Request(requestUrl, {
    method: req.method,
    headers: requestHeaders,
    body,
  });

  const response = await handler(webRequest);
  res.statusCode = response.status;

  const setCookies = response.headers.getSetCookie?.() ?? [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }
    res.setHeader(key, value);
  });

  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }

  res.end(Buffer.from(await response.arrayBuffer()));
});

async function registerUser(agent = request.agent(server), overrides?: {
  email?: string;
  password?: string;
  username?: string;
}) {
  const email = overrides?.email ?? "owner@example.com";
  const password = overrides?.password ?? "password123";
  const username = overrides?.username ?? "owner_user";

  const response = await agent
    .post("/api/auth/sign-up/email")
    .set("x-forwarded-for", "127.0.0.1")
    .set("user-agent", "vitest")
    .send({
      email,
      password,
      name: username,
      username,
      displayUsername: username,
    });

  return { agent, email, password, response, username };
}

describe("delete account integration", () => {
  beforeEach(async () => {
    await resetDb();
    await mkdir(UPLOADS_DIR, { recursive: true });
  });

  afterAll(async () => {
    if (!server.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("deletes owned room data, files, memberships in other rooms, and the user account", async () => {
    const { agent: ownerAgent, email, response: ownerResponse } = await registerUser(undefined, {
      email: "owner@example.com",
      username: "owner_user",
    });
    expect([200, 201]).toContain(ownerResponse.status);

    await registerUser(undefined, {
      email: "member@example.com",
      username: "member_user",
    });

    const owner = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    const member = await db.query.users.findFirst({
      where: eq(users.email, "member@example.com"),
    });

    expect(owner).toBeTruthy();
    expect(member).toBeTruthy();

    const [ownedRoom] = await db
      .insert(rooms)
      .values({
        name: "owned-room",
        description: "Owned by deleted user",
        type: "public",
        ownerId: owner!.id,
      })
      .returning();

    await db.insert(roomMembers).values({
      roomId: ownedRoom.id,
      userId: owner!.id,
      role: "admin",
    });

    const [ownedMessage] = await db
      .insert(messages)
      .values({
        roomId: ownedRoom.id,
        senderUserId: owner!.id,
        body: "owned room message",
      })
      .returning();

    const storageKey = `delete-account-${ownedRoom.id}.txt`;
    await writeFile(join(UPLOADS_DIR, storageKey), "owned file");

    await db.insert(attachments).values({
      roomId: ownedRoom.id,
      messageId: ownedMessage.id,
      uploaderUserId: owner!.id,
      storageKey,
      originalFilename: "owned.txt",
      mimeType: "text/plain",
      byteSize: 10,
      comment: "owned attachment",
    });

    const [otherRoom] = await db
      .insert(rooms)
      .values({
        name: "other-room",
        description: "Owned by someone else",
        type: "public",
        ownerId: member!.id,
      })
      .returning();

    await db.insert(roomMembers).values([
      {
        roomId: otherRoom.id,
        userId: member!.id,
        role: "admin",
      },
      {
        roomId: otherRoom.id,
        userId: owner!.id,
        role: "member",
      },
    ]);

    const pairKey = getFriendPairKey(owner!.id, member!.id);
    await db.insert(friendships).values({
      userOneId: owner!.id < member!.id ? owner!.id : member!.id,
      userTwoId: owner!.id < member!.id ? member!.id : owner!.id,
      pairKey,
    });
    await db.insert(friendRequests).values({
      requesterUserId: owner!.id,
      addresseeUserId: member!.id,
      pairKey,
      status: "pending",
    });
    await db.insert(userBans).values({
      blockerUserId: member!.id,
      blockedUserId: owner!.id,
    });

    const deleteResponse = await ownerAgent.delete("/api/users/me");

    expect(deleteResponse.status).toBe(200);

    const deletedUser = await db.query.users.findFirst({
      where: eq(users.id, owner!.id),
    });
    const deletedOwnedRoom = await db.query.rooms.findFirst({
      where: eq(rooms.id, ownedRoom.id),
    });
    const survivingOtherRoom = await db.query.rooms.findFirst({
      where: eq(rooms.id, otherRoom.id),
    });
    const [ownedMessageCount] = await db
      .select({ value: count() })
      .from(messages)
      .where(eq(messages.roomId, ownedRoom.id));
    const [ownedAttachmentCount] = await db
      .select({ value: count() })
      .from(attachments)
      .where(eq(attachments.roomId, ownedRoom.id));
    const [otherMembershipCount] = await db
      .select({ value: count() })
      .from(roomMembers)
      .where(eq(roomMembers.roomId, otherRoom.id));
    const [deletedUserMembershipCount] = await db
      .select({ value: count() })
      .from(roomMembers)
      .where(eq(roomMembers.userId, owner!.id));
    const [deletedUserSessionCount] = await db
      .select({ value: count() })
      .from(sessions)
      .where(eq(sessions.userId, owner!.id));
    const [friendshipCount] = await db.select({ value: count() }).from(friendships);
    const [friendRequestCount] = await db.select({ value: count() }).from(friendRequests);
    const [userBanCount] = await db.select({ value: count() }).from(userBans);

    expect(deletedUser).toBeUndefined();
    expect(deletedOwnedRoom).toBeUndefined();
    expect(survivingOtherRoom).toBeTruthy();
    expect(ownedMessageCount?.value).toBe(0);
    expect(ownedAttachmentCount?.value).toBe(0);
    expect(otherMembershipCount?.value).toBe(1);
    expect(deletedUserMembershipCount?.value).toBe(0);
    expect(deletedUserSessionCount?.value).toBe(0);
    expect(friendshipCount?.value).toBe(0);
    expect(friendRequestCount?.value).toBe(0);
    expect(userBanCount?.value).toBe(0);
    await expect(access(join(UPLOADS_DIR, storageKey))).rejects.toThrow();
  });
});
