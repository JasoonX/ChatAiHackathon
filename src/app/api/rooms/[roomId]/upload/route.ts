import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { attachments, messages } from "@/db/schema/messages";
import { roomMembers, rooms } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { getIO } from "@/lib/socket-server";
import type { MessagePayload } from "@/lib/socket";
import { getCurrentUser } from "@/server/auth";
import { getDirectMessageState } from "@/server/friends";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB
const MAX_FILES = 10;
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
  if (!isValidUUID(roomId)) {
    return Response.json({ error: "Invalid room ID" }, { status: 400 });
  }

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

  if (room.type === "direct") {
    const directState = await getDirectMessageState(roomId, user.id);
    if (!directState?.canMessage) {
      return Response.json(
        { error: "You cannot message this user" },
        { status: 403 },
      );
    }
  }

  // Parse multipart form data — support both single "file" and multiple "files"
  const formData = await req.formData();
  const comment = (formData.get("comment") as string | null)?.trim() || null;

  const fileList: File[] = [
    ...(formData.getAll("files") as File[]),
    ...(formData.getAll("file") as File[]),
  ].filter((f): f is File => f instanceof File && f.size > 0);

  if (fileList.length === 0) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (fileList.length > MAX_FILES) {
    return Response.json(
      { error: `You can attach at most ${MAX_FILES} files at once` },
      { status: 400 },
    );
  }

  // Validate all files before writing anything
  for (const file of fileList) {
    const mimeType = file.type || "application/octet-stream";
    if (isImageMime(mimeType) && file.size > MAX_IMAGE_SIZE) {
      return Response.json(
        { error: `Image "${file.name}" must be 3 MB or smaller` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File "${file.name}" must be 20 MB or smaller` },
        { status: 400 },
      );
    }
  }

  // Create one message for all attachments
  const [message] = await db
    .insert(messages)
    .values({
      roomId,
      senderUserId: user.id,
      body: comment,
    })
    .returning();

  // Write files to disk and create attachment rows
  await mkdir(UPLOADS_DIR, { recursive: true });

  const attachmentRows = await Promise.all(
    fileList.map(async (file) => {
      const mimeType = file.type || "application/octet-stream";
      const ext = extname(file.name) || "";
      const storageKey = `${randomUUID()}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(join(UPLOADS_DIR, storageKey), buffer);

      const [row] = await db
        .insert(attachments)
        .values({
          roomId,
          messageId: message.id,
          uploaderUserId: user.id,
          storageKey,
          originalFilename: file.name,
          mimeType,
          byteSize: file.size,
          comment,
        })
        .returning();

      return row;
    }),
  );

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
    attachments: attachmentRows.map((a) => ({
      id: a.id,
      storageKey: a.storageKey,
      originalFilename: a.originalFilename,
      mimeType: a.mimeType,
      byteSize: a.byteSize,
      imageWidth: a.imageWidth,
      imageHeight: a.imageHeight,
      comment: a.comment,
    })),
  };

  const io = getIO();
  if (io) {
    io.to(roomId).emit("message:new", payload);
  }

  return Response.json({ message: payload });
}
