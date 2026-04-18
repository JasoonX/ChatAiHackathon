import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { attachments, messages } from "@/db/schema/messages";
import { roomMembers, rooms } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { getIO } from "@/lib/socket-server";
import type { MessagePayload } from "@/lib/socket";
import { getCurrentUser } from "@/server/auth";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB
const UPLOADS_DIR = join(process.cwd(), "uploads");

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  // Verify room exists and user is member
  const [room] = await db
    .select({ id: rooms.id, type: rooms.type, ownerId: rooms.ownerId })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt)))
    .limit(1);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  const [membership] = await db
    .select({ userId: roomMembers.userId, role: roomMembers.role })
    .from(roomMembers)
    .where(
      and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)),
    )
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Not a room member" }, { status: 403 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const comment = (formData.get("comment") as string | null)?.trim() || null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const byteSize = file.size;

  // Size validation
  if (isImageMime(mimeType) && byteSize > MAX_IMAGE_SIZE) {
    return Response.json(
      { error: "Image files must be 3 MB or smaller" },
      { status: 400 },
    );
  }

  if (byteSize > MAX_FILE_SIZE) {
    return Response.json(
      { error: "Files must be 20 MB or smaller" },
      { status: 400 },
    );
  }

  // Generate storage key
  const ext = extname(file.name) || "";
  const storageKey = `${randomUUID()}${ext}`;

  // Write file to disk
  await mkdir(UPLOADS_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOADS_DIR, storageKey), buffer);

  // Create message row (attachment messages may have empty body)
  const [message] = await db
    .insert(messages)
    .values({
      roomId,
      senderUserId: user.id,
      body: comment,
    })
    .returning();

  // Create attachment row
  const [attachment] = await db
    .insert(attachments)
    .values({
      roomId,
      messageId: message.id,
      uploaderUserId: user.id,
      storageKey,
      originalFilename: file.name,
      mimeType,
      byteSize,
      comment,
    })
    .returning();

  // Fetch sender info
  const [sender] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Build and broadcast message payload
  const payload: MessagePayload = {
    id: message.id,
    roomId: message.roomId,
    content: comment,
    createdAt: message.createdAt.toISOString(),
    editedAt: null,
    deletedAt: null,
    sender: {
      id: sender.id,
      username: sender.username,
      name: sender.name,
      image: sender.image,
    },
    replyTo: null,
    attachments: [
      {
        id: attachment.id,
        storageKey: attachment.storageKey,
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        byteSize: attachment.byteSize,
        imageWidth: attachment.imageWidth,
        imageHeight: attachment.imageHeight,
        comment: attachment.comment,
      },
    ],
  };

  const io = getIO();
  if (io) {
    io.to(roomId).emit("message:new", payload);
  }

  return Response.json({
    message: payload,
    attachment: {
      id: attachment.id,
      storageKey: attachment.storageKey,
      originalFilename: attachment.originalFilename,
      mimeType: attachment.mimeType,
      byteSize: attachment.byteSize,
    },
  });
}
