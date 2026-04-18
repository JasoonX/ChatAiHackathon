import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { roomBans, roomMembers } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import { canActorManageMembers, getRoomPermissionContext } from "@/server/room-management";

const banSchema = z.object({
  userId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ roomId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  if (!isValidUUID(roomId)) {
    return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
  }

  const context = await getRoomPermissionContext(roomId, user.id);

  if (!context || !context.actorMembership) {
    return NextResponse.json({ error: "Room not found or inaccessible" }, { status: 404 });
  }

  if (!canActorManageMembers(context)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = banSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const targetUserId = parsed.data.userId;

  if (context.room.ownerId === targetUserId) {
    return NextResponse.json({ error: "The owner cannot be banned" }, { status: 403 });
  }

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [existingBan] = await db
    .select({ id: roomBans.id })
    .from(roomBans)
    .where(and(eq(roomBans.roomId, roomId), eq(roomBans.userId, targetUserId)))
    .limit(1);

  const deletedMembership = await db.delete(roomMembers).where(
    and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, targetUserId)),
  ).returning({ id: roomMembers.id });

  if (existingBan) {
    if (deletedMembership.length > 0) {
      const io = getIO();
      const payload = {
        roomId,
        userId: targetUserId,
        bannedByUserId: user.id,
        createdAt: new Date().toISOString(),
      };

      if (io) {
        const sockets = await io.fetchSockets();
        await Promise.all(
          sockets
            .filter((socket) => socket.data.userId === targetUserId)
            .map(async (socket) => {
              socket.emit("room:member-banned", payload);
              await socket.leave(roomId);
            }),
        );
        io.to(roomId).emit("room:member-banned", payload);
      }

      return NextResponse.json({
        success: true,
        alreadyBanned: true,
        membershipRemoved: true,
      });
    }

    return NextResponse.json({ error: "User is already banned" }, { status: 409 });
  }

  const [ban] = await db
    .insert(roomBans)
    .values({
      roomId,
      userId: targetUserId,
      bannedByUserId: user.id,
    })
    .returning();

  const io = getIO();
  const payload = {
    roomId,
    userId: targetUserId,
    bannedByUserId: user.id,
    createdAt: ban.createdAt.toISOString(),
  };

  if (io) {
    const sockets = await io.fetchSockets();
    await Promise.all(
      sockets
        .filter((socket) => socket.data.userId === targetUserId)
        .map(async (socket) => {
          socket.emit("room:member-banned", payload);
          await socket.leave(roomId);
        }),
    );
    io.to(roomId).emit("room:member-banned", payload);
  }

  return NextResponse.json({ success: true });
}
