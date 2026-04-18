import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { rooms } from "@/db/schema/rooms";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import {
  canActorDeleteRoom,
  getRoomManagementSnapshot,
  getRoomPermissionContext,
} from "@/server/room-management";
import { deleteRoom } from "@/server/room-deletion";

const updateRoomSchema = z.object({
  name: z.string().trim().min(1, "Room name is required"),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

type RouteContext = { params: Promise<{ roomId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const snapshot = await getRoomManagementSnapshot(roomId, user.id);

  if (!snapshot) {
    return NextResponse.json({ error: "Room not found or inaccessible" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const context = await getRoomPermissionContext(roomId, user.id);

  if (!context) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (context.room.ownerId !== user.id) {
    return NextResponse.json({ error: "Only the owner can update room settings" }, { status: 403 });
  }

  if (context.room.type === "direct") {
    return NextResponse.json({ error: "Direct rooms cannot be updated" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const nextName = parsed.data.name;
  const nextDescription = parsed.data.description?.trim() || null;
  const nextType = parsed.data.visibility ?? context.room.type;

  const [existing] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(ne(rooms.id, roomId), eq(rooms.name, nextName)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Room name already taken" }, { status: 409 });
  }

  const [updatedRoom] = await db
    .update(rooms)
    .set({
      name: nextName,
      description: nextDescription,
      type: nextType,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, roomId))
    .returning();

  getIO()?.to(roomId).emit("room:updated", {
    roomId,
    name: updatedRoom.name,
    description: updatedRoom.description,
    type: updatedRoom.type,
  });

  return NextResponse.json({
    room: {
      id: updatedRoom.id,
      name: updatedRoom.name,
      description: updatedRoom.description,
      type: updatedRoom.type,
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const context = await getRoomPermissionContext(roomId, user.id);

  if (!context) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (!canActorDeleteRoom(context)) {
    return NextResponse.json({ error: "Only the owner can delete the room" }, { status: 403 });
  }

  // Notify connected sockets before touching the DB so they can react
  // while the room still exists in socket.io channel state.
  const io = getIO();
  io?.to(roomId).emit("room:deleted", { roomId });
  if (io) {
    const sockets = await io.in(roomId).fetchSockets();
    await Promise.all(sockets.map((socket) => socket.leave(roomId)));
  }

  await deleteRoom(roomId);

  return NextResponse.json({ success: true });
}
