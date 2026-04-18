import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { friendRequests, friendships } from "@/db/schema/friends";
import { users } from "@/db/schema/users";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import {
  ensureDirectRoom,
  getCanonicalUserPair,
  getFriendPairKey,
  getFriendshipBetween,
  getUserBansBetween,
} from "@/server/friends";

const respondSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { requestId } = await params;
  if (!isValidUUID(requestId)) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
  }

  const [friendRequest] = await db
    .select()
    .from(friendRequests)
    .where(eq(friendRequests.id, requestId))
    .limit(1);

  if (!friendRequest || friendRequest.status !== "pending") {
    return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
  }

  if (friendRequest.addresseeUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const newStatus = parsed.data.action === "accept" ? "accepted" : "rejected";
  const now = new Date();

  await db
    .delete(friendRequests)
    .where(
      and(
        eq(friendRequests.pairKey, friendRequest.pairKey),
        eq(friendRequests.status, newStatus),
        ne(friendRequests.id, friendRequest.id),
      ),
    );

  if (parsed.data.action === "reject") {
    await db
      .update(friendRequests)
      .set({ status: "rejected", respondedAt: now })
      .where(eq(friendRequests.id, requestId));

    return NextResponse.json({ success: true, status: "rejected" });
  }

  const [requester] = await db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, friendRequest.requesterUserId))
    .limit(1);

  if (!requester) {
    return NextResponse.json({ error: "Requester not found" }, { status: 404 });
  }

  const [existingFriendship, bans] = await Promise.all([
    getFriendshipBetween(db, requester.id, user.id),
    getUserBansBetween(db, requester.id, user.id),
  ]);

  if (existingFriendship) {
    return NextResponse.json({ error: "Users are already friends" }, { status: 409 });
  }

  if (bans.length > 0) {
    return NextResponse.json(
      { error: "Friend request cannot be accepted because one user has banned the other" },
      { status: 403 },
    );
  }

  const [userOneId, userTwoId] = getCanonicalUserPair(requester.id, user.id);
  const pairKey = getFriendPairKey(requester.id, user.id);

  const result = await db.transaction(async (tx) => {
    const [friendship] = await tx
      .insert(friendships)
      .values({
        userOneId,
        userTwoId,
        pairKey,
        createdFromRequestId: friendRequest.id,
      })
      .returning({
        id: friendships.id,
      });

    await tx
      .update(friendRequests)
      .set({ status: "accepted", respondedAt: now })
      .where(eq(friendRequests.id, requestId));

    const directRoom = await ensureDirectRoom(tx, requester.id, user.id);

    return { friendship, directRoom };
  });

  const io = getIO();
  if (io) {
    const sockets = await io.fetchSockets();
    await Promise.all(
      sockets
        .filter((socket) => socket.data.userId === requester.id)
        .map(async (socket) => {
          socket.emit("friend:accepted", {
            requestId,
            friendUserId: user.id,
            friendUsername: user.username ?? user.email,
            directRoomId: result.directRoom.id,
          });
        }),
    );
  }

  return NextResponse.json({
    success: true,
    friendshipId: result.friendship.id,
    directRoomId: result.directRoom.id,
  });
}
