import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { roomMembers } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import { canActorManageMembers, getRoomPermissionContext } from "@/server/room-management";

type RouteContext = { params: Promise<{ roomId: string; userId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, userId: targetUserId } = await params;
  const context = await getRoomPermissionContext(roomId, user.id);

  if (!context || !context.actorMembership) {
    return NextResponse.json({ error: "Room not found or inaccessible" }, { status: 404 });
  }

  if (!canActorManageMembers(context)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (context.room.ownerId === targetUserId) {
    return NextResponse.json({ error: "The owner cannot be removed" }, { status: 403 });
  }

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const deletedMembership = await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, targetUserId)))
    .returning({ id: roomMembers.id });

  if (deletedMembership.length === 0) {
    return NextResponse.json({ error: "User is not a room member" }, { status: 404 });
  }

  const io = getIO();
  if (io) {
    const sockets = await io.fetchSockets();
    await Promise.all(
      sockets
        .filter((socket) => socket.data.userId === targetUserId)
        .map(async (socket) => {
          socket.emit("room:member-left", { roomId, userId: targetUserId });
          await socket.leave(roomId);
        }),
    );
    io.to(roomId).emit("room:member-left", { roomId, userId: targetUserId });
  }

  return NextResponse.json({ success: true });
}
