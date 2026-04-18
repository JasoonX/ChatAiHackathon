import { unlink } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";

import { db } from "../db";
import { attachments } from "../db/schema/messages";
import { rooms } from "../db/schema/rooms";

const UPLOADS_DIR = join(process.cwd(), "uploads");

/**
 * Permanently deletes a room and all associated data.
 *
 * Steps:
 * 1. Collect attachment storage keys so we can remove files after the DB is clean.
 * 2. Delete the room row inside a transaction — Postgres cascades take care of
 *    room_members, room_bans, room_invitations, messages, and attachments.
 * 3. Delete attachment files from disk (best-effort; individual failures are
 *    swallowed so a missing file never blocks the operation).
 *
 * Callers are responsible for permission checks and Socket.IO notifications
 * before invoking this function.
 */
export async function deleteRoom(roomId: string): Promise<void> {
  // Collect storage keys BEFORE deleting so we know what to remove from disk.
  const attachmentRows = await db
    .select({ storageKey: attachments.storageKey })
    .from(attachments)
    .where(eq(attachments.roomId, roomId));

  // A single DELETE on rooms cascades to room_members, room_bans,
  // room_invitations, messages, and attachments via FK CASCADE rules.
  await db.transaction(async (tx) => {
    await tx.delete(rooms).where(eq(rooms.id, roomId));
  });

  // Remove files from disk after the transaction commits.
  await Promise.allSettled(
    attachmentRows.map(({ storageKey }) =>
      unlink(join(UPLOADS_DIR, storageKey)),
    ),
  );
}
