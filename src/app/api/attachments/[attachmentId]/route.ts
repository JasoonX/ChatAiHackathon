import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { attachments } from "@/db/schema/messages";
import { roomMembers } from "@/db/schema/rooms";
import { canUserDownloadAttachment } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attachmentId } = await params;
  if (!isValidUUID(attachmentId)) {
    return Response.json({ error: "Invalid attachment ID" }, { status: 400 });
  }

  // Fetch attachment
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);

  if (!attachment) {
    return Response.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Check room membership
  const [membership] = await db
    .select({ userId: roomMembers.userId, role: roomMembers.role })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.roomId, attachment.roomId),
        eq(roomMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (
    !canUserDownloadAttachment(
      user,
      membership ? { userId: membership.userId, role: membership.role } : null,
    )
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const filePath = join(UPLOADS_DIR, attachment.storageKey);

  // Check file exists
  try {
    await stat(filePath);
  } catch {
    return Response.json({ error: "File not found on disk" }, { status: 404 });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  const isInline = attachment.mimeType.startsWith("image/");
  const disposition = isInline
    ? `inline; filename="${attachment.originalFilename}"`
    : `attachment; filename="${attachment.originalFilename}"`;

  return new Response(webStream, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": disposition,
      "Content-Length": String(attachment.byteSize),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
