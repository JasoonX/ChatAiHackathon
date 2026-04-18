import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { roomMembers } from "@/db/schema/rooms";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import {
  canActorManageMembers,
  canActorRemoveAdmin,
  getRoomPermissionContext,
} from "@/server/room-management";

type RouteContext = { params: Promise<{ roomId: string; userId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, userId } = await params;
  const context = await getRoomPermissionContext(roomId, user.id);

  if (!context || !context.actorMembership) {
    return NextResponse.json({ error: "Room not found or inaccessible" }, { status: 404 });
  }

  if (!canActorManageMembers(context)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (context.room.type === "direct") {
    return NextResponse.json({ error: "Direct rooms do not support admins" }, { status: 400 });
  }

  const [targetMembership] = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);

  if (!targetMembership) {
    return NextResponse.json({ error: "Target user is not a room member" }, { status: 404 });
  }

  if (context.room.ownerId === userId) {
    return NextResponse.json({ error: "The owner is already an admin" }, { status: 409 });
  }

  if (targetMembership.role === "admin") {
    return NextResponse.json({ error: "User is already an admin" }, { status: 409 });
  }

  await db
    .update(roomMembers)
    .set({ role: "admin" })
    .where(eq(roomMembers.id, targetMembership.id));

  getIO()?.to(roomId).emit("room:admin-updated", { roomId, userId, role: "admin" });

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, userId } = await params;
  const context = await getRoomPermissionContext(roomId, user.id);

  if (!context || !context.actorMembership) {
    return NextResponse.json({ error: "Room not found or inaccessible" }, { status: 404 });
  }

  const [targetMembership] = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);

  if (!targetMembership) {
    return NextResponse.json({ error: "Target admin not found" }, { status: 404 });
  }

  if (targetMembership.role !== "admin") {
    return NextResponse.json({ error: "Target user is not an admin" }, { status: 409 });
  }

  if (!canActorRemoveAdmin(context, userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .update(roomMembers)
    .set({ role: "member" })
    .where(eq(roomMembers.id, targetMembership.id));

  getIO()?.to(roomId).emit("room:admin-updated", { roomId, userId, role: "member" });

  return NextResponse.json({ success: true });
}
