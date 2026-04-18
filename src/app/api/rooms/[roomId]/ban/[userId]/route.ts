import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { roomBans } from "@/db/schema/rooms";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import { canActorManageMembers, getRoomPermissionContext } from "@/server/room-management";

type RouteContext = { params: Promise<{ roomId: string; userId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, userId } = await params;
  if (!isValidUUID(roomId) || !isValidUUID(userId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const context = await getRoomPermissionContext(roomId, user.id);

  if (!context || !context.actorMembership) {
    return NextResponse.json({ error: "Room not found or inaccessible" }, { status: 404 });
  }

  if (!canActorManageMembers(context)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [existingBan] = await db
    .select({ id: roomBans.id })
    .from(roomBans)
    .where(and(eq(roomBans.roomId, roomId), eq(roomBans.userId, userId)))
    .limit(1);

  if (!existingBan) {
    return NextResponse.json({ error: "Ban not found" }, { status: 404 });
  }

  await db.delete(roomBans).where(
    and(eq(roomBans.roomId, roomId), eq(roomBans.userId, userId)),
  );

  getIO()?.to(roomId).emit("room:ban-removed", { roomId, userId });

  return NextResponse.json({ success: true });
}
