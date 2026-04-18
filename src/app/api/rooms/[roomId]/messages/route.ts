import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { attachments, messages } from "@/db/schema/messages";
import { roomMembers } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/server/auth";
import type { AttachmentPayload, MessagePayload, ReplyPreview } from "@/lib/socket";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  const searchParams = req.nextUrl.searchParams;
  const cursor = searchParams.get("cursor") ?? undefined;
  const rawLimit = searchParams.get("limit");
  const limit = Math.min(
    rawLimit ? parseInt(rawLimit, 10) || 50 : 50,
    100,
  );

  // Check room membership
  const membership = await db
    .select({ id: roomMembers.id })
    .from(roomMembers)
    .where(
      and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)),
    )
    .limit(1);

  if (membership.length === 0) {
    return NextResponse.json(
      { error: "Not a room member" },
      { status: 403 },
    );
  }

  // Build WHERE conditions
  const conditions = [
    eq(messages.roomId, roomId),
    isNull(messages.deletedAt),
  ];

  if (cursor) {
    const cursorRows = await db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, cursor))
      .limit(1);

    if (cursorRows.length > 0) {
      const cursorMsg = cursorRows[0];
      conditions.push(
        or(
          lt(messages.createdAt, cursorMsg.createdAt),
          and(
            eq(messages.createdAt, cursorMsg.createdAt),
            lt(messages.id, cursorMsg.id),
          ),
        )!,
      );
    }
  }

  const rows = await db
    .select({
      id: messages.id,
      roomId: messages.roomId,
      body: messages.body,
      createdAt: messages.createdAt,
      editedAt: messages.editedAt,
      replyToMessageId: messages.replyToMessageId,
      senderId: users.id,
      senderUsername: users.username,
      senderName: users.name,
      senderImage: users.image,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1);

  let hasMore = false;
  let results = rows;

  if (results.length === limit + 1) {
    hasMore = true;
    results = results.slice(0, limit);
  }

  // Reverse to chronological order (oldest first)
  results.reverse();

  // Batch-fetch reply-to messages
  const replyIds = results
    .map((r) => r.replyToMessageId)
    .filter((id): id is string => id !== null);

  const replyMap = new Map<string, ReplyPreview>();

  if (replyIds.length > 0) {
    const replyRows = await db
      .select({
        id: messages.id,
        body: messages.body,
        deletedAt: messages.deletedAt,
        senderUsername: users.username,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderUserId, users.id))
      .where(inArray(messages.id, replyIds));

    for (const r of replyRows) {
      replyMap.set(r.id, {
        id: r.id,
        content: r.deletedAt ? null : r.body,
        sender: { username: r.senderUsername },
      });
    }
  }

  // Batch-fetch attachments for these messages
  const messageIds = results.map((r) => r.id);
  const attachmentMap = new Map<string, AttachmentPayload[]>();

  if (messageIds.length > 0) {
    const attachmentRows = await db
      .select({
        id: attachments.id,
        messageId: attachments.messageId,
        storageKey: attachments.storageKey,
        originalFilename: attachments.originalFilename,
        mimeType: attachments.mimeType,
        byteSize: attachments.byteSize,
        imageWidth: attachments.imageWidth,
        imageHeight: attachments.imageHeight,
        comment: attachments.comment,
      })
      .from(attachments)
      .where(inArray(attachments.messageId, messageIds));

    for (const a of attachmentRows) {
      const list = attachmentMap.get(a.messageId) ?? [];
      list.push({
        id: a.id,
        storageKey: a.storageKey,
        originalFilename: a.originalFilename,
        mimeType: a.mimeType,
        byteSize: a.byteSize,
        imageWidth: a.imageWidth,
        imageHeight: a.imageHeight,
        comment: a.comment,
      });
      attachmentMap.set(a.messageId, list);
    }
  }

  const mapped: MessagePayload[] = results.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    content: row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: null,
    sender: {
      id: row.senderId,
      username: row.senderUsername,
      name: row.senderName,
      image: row.senderImage,
    },
    replyTo: row.replyToMessageId
      ? replyMap.get(row.replyToMessageId) ?? null
      : null,
    attachments: attachmentMap.get(row.id) ?? [],
  }));

  // nextCursor is the oldest message ID in the batch (first after reversing)
  const nextCursor = hasMore ? results[0].id : null;

  return NextResponse.json({ messages: mapped, hasMore, nextCursor });
}
