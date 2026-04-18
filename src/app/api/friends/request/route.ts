import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { friendRequests } from "@/db/schema/friends";
import { users } from "@/db/schema/users";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import { getFriendPairKey, getFriendshipBetween, getUserBansBetween } from "@/server/friends";

const sendFriendRequestSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
});

export async function POST(request: Request) {
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

  const parsed = sendFriendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const [targetUser] = await db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.id === user.id) {
    return NextResponse.json({ error: "You cannot add yourself" }, { status: 400 });
  }

  const pairKey = getFriendPairKey(user.id, targetUser.id);

  const [existingFriendship, bans, pendingRequest] = await Promise.all([
    getFriendshipBetween(db, user.id, targetUser.id),
    getUserBansBetween(db, user.id, targetUser.id),
    db
      .select({ id: friendRequests.id })
      .from(friendRequests)
      .where(
        and(eq(friendRequests.pairKey, pairKey), eq(friendRequests.status, "pending")),
      )
      .limit(1),
  ]);

  if (existingFriendship) {
    return NextResponse.json({ error: "You are already friends" }, { status: 409 });
  }

  if (bans.length > 0) {
    return NextResponse.json(
      { error: "Friend request is blocked by an active user ban" },
      { status: 403 },
    );
  }

  if (pendingRequest[0]) {
    return NextResponse.json({ error: "A friend request is already pending" }, { status: 409 });
  }

  const [friendRequest] = await db
    .insert(friendRequests)
    .values({
      requesterUserId: user.id,
      addresseeUserId: targetUser.id,
      pairKey,
    })
    .returning({
      id: friendRequests.id,
      createdAt: friendRequests.createdAt,
    });

  const io = getIO();
  if (io) {
    const sockets = await io.fetchSockets();
    await Promise.all(
      sockets
        .filter((socket) => socket.data.userId === targetUser.id)
        .map(async (socket) => {
          socket.emit("friend:request-received", {
            requestId: friendRequest.id,
            requesterUserId: user.id,
            requesterUsername: user.username ?? user.email,
            createdAt: friendRequest.createdAt.toISOString(),
          });
        }),
    );
  }

  return NextResponse.json({ requestId: friendRequest.id }, { status: 201 });
}
