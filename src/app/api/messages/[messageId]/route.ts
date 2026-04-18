import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { messages } from "@/db/schema/messages";
import { roomMembers, rooms } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { canUserDeleteMessage } from "@/lib/permissions";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";

type RouteContext = { params: Promise<{ messageId: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/messages/:messageId  — edit message body
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messageId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content =
    typeof body === "object" && body !== null && "content" in body
      ? (body as { content: unknown }).content
      : undefined;

  if (
    typeof content !== "string" ||
    content.trim().length === 0 ||
    Buffer.byteLength(content, "utf8") > 3072
  ) {
    return NextResponse.json(
      { error: "Content is required and must be <= 3 KB" },
      { status: 400 },
    );
  }

  // Fetch message
  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!msg || msg.deletedAt) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // Only the author can edit
  if (msg.senderUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update
  const [updated] = await db
    .update(messages)
    .set({ body: content.trim(), editedAt: new Date(), updatedAt: new Date() })
    .where(eq(messages.id, messageId))
    .returning();

  // Build payload for broadcast
  const [sender] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, updated.senderUserId))
    .limit(1);

  const payload = {
    id: updated.id,
    roomId: updated.roomId,
    content: updated.body,
    createdAt: updated.createdAt.toISOString(),
    editedAt: updated.editedAt?.toISOString() ?? null,
    deletedAt: null,
    sender: {
      id: sender.id,
      username: sender.username,
      name: sender.name,
      image: sender.image,
    },
    replyTo: null as null, // reply-to doesn't change on edit
  };

  // Broadcast via socket
  const io = getIO();
  if (io) {
    io.to(updated.roomId).emit("message:updated", payload);
  }

  return NextResponse.json(payload);
}

// ---------------------------------------------------------------------------
// DELETE /api/messages/:messageId  — soft-delete message
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messageId } = await params;

  // Fetch message + room info for permission check
  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!msg || msg.deletedAt) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const [room] = await db
    .select({
      id: rooms.id,
      type: rooms.type,
      ownerId: rooms.ownerId,
    })
    .from(rooms)
    .where(eq(rooms.id, msg.roomId))
    .limit(1);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Collect admin user IDs for permission check
  const adminRows = await db
    .select({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(
      and(eq(roomMembers.roomId, room.id), eq(roomMembers.role, "admin")),
    );
  const adminUserIds = adminRows.map((r) => r.userId);

  const permRoom = {
    id: room.id,
    type: room.type,
    ownerId: room.ownerId,
    adminUserIds,
  };
  const permMessage = { id: msg.id, authorId: msg.senderUserId };

  if (!canUserDeleteMessage({ id: user.id }, permMessage, permRoom)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete
  const now = new Date();
  await db
    .update(messages)
    .set({
      deletedAt: now,
      deletedByUserId: user.id,
      updatedAt: now,
    })
    .where(eq(messages.id, messageId));

  // Broadcast via socket
  const io = getIO();
  if (io) {
    io.to(msg.roomId).emit("message:deleted", {
      id: messageId,
      roomId: msg.roomId,
      deletedAt: now.toISOString(),
    });
  }

  return NextResponse.json({ success: true });
}
