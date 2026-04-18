import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { roomBans, roomMembers, rooms } from "@/db/schema/rooms";
import { canUserJoinRoom } from "@/lib/permissions";
import { isValidUUID } from "@/lib/validate";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  if (!isValidUUID(roomId)) {
    return Response.json({ error: "Invalid room ID" }, { status: 400 });
  }

  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt)))
    .limit(1);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  const [membership] = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)))
    .limit(1);

  const [ban] = await db
    .select()
    .from(roomBans)
    .where(and(eq(roomBans.roomId, roomId), eq(roomBans.userId, user.id)))
    .limit(1);

  const permissionRoom = {
    id: room.id,
    type: room.type,
    ownerId: room.ownerId,
  };

  const permissionMembership = membership
    ? { userId: membership.userId, role: membership.role }
    : null;

  const permissionBan = ban ? { userId: ban.userId } : null;

  if (permissionBan !== null && permissionBan.userId === user.id) {
    return Response.json(
      { error: "You are banned from this room" },
      { status: 403 },
    );
  }

  if (permissionMembership !== null) {
    return Response.json({ error: "Already a member" }, { status: 409 });
  }

  if (!canUserJoinRoom(user, permissionRoom, permissionMembership, permissionBan)) {
    return Response.json({ error: "Cannot join this room" }, { status: 403 });
  }

  await db.insert(roomMembers).values({
    roomId,
    userId: user.id,
    role: "member",
  });

  getIO()
    ?.to(roomId)
    .emit("room:member-joined", {
      roomId,
      userId: user.id,
      username: user.name ?? user.username ?? "",
    });

  return Response.json({ success: true }, { status: 200 });
}
