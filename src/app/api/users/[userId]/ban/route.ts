import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { friendRequests, friendships, userBans } from "@/db/schema/friends";
import { users } from "@/db/schema/users";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import { getFriendPairKey, getFriendshipBetween } from "@/server/friends";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId: targetUserId } = await params;

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You cannot ban yourself" }, { status: 400 });
  }

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [existingBan, friendship] = await Promise.all([
    db
      .select({ id: userBans.id })
      .from(userBans)
      .where(and(eq(userBans.blockerUserId, user.id), eq(userBans.blockedUserId, targetUserId)))
      .limit(1),
    getFriendshipBetween(db, user.id, targetUserId),
  ]);

  if (existingBan[0]) {
    return NextResponse.json({ error: "User is already banned" }, { status: 409 });
  }

  await db.transaction(async (tx) => {
    await tx.insert(userBans).values({
      blockerUserId: user.id,
      blockedUserId: targetUserId,
    });

    if (friendship) {
      await tx.delete(friendships).where(eq(friendships.id, friendship.id));
    }

    await tx
      .update(friendRequests)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(
        and(
          eq(friendRequests.pairKey, getFriendPairKey(user.id, targetUserId)),
          eq(friendRequests.status, "pending"),
        ),
      );
  });

  const io = getIO();
  if (io) {
    const sockets = await io.fetchSockets();
    await Promise.all(
      sockets
        .filter((socket) => socket.data.userId === targetUserId)
        .map(async (socket) => {
          socket.emit("user:banned", {
            blockerUserId: user.id,
            blockedUserId: targetUserId,
          });
        }),
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId: targetUserId } = await params;

  const deleted = await db
    .delete(userBans)
    .where(and(eq(userBans.blockerUserId, user.id), eq(userBans.blockedUserId, targetUserId)))
    .returning({ id: userBans.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Ban not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
