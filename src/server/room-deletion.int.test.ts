import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { count, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, resetDb } from "../../tests/setup/integration";
import { attachments, messages } from "../db/schema/messages";
import { roomBans, roomInvitations, roomMembers, rooms } from "../db/schema/rooms";
import { users } from "../db/schema/users";
import { deleteRoom } from "./room-deletion";

const UPLOADS_DIR = join(process.cwd(), "uploads");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insertUser(overrides: { email: string; username: string }) {
  const [user] = await db
    .insert(users)
    .values({
      name: overrides.username,
      email: overrides.email,
      username: overrides.username,
      displayUsername: overrides.username,
    })
    .returning();
  return user!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deleteRoom", () => {
  beforeEach(async () => {
    await resetDb();
    await mkdir(UPLOADS_DIR, { recursive: true });
  });

  afterAll(async () => {
    // nothing to close — integration setup handles DB teardown
  });

  it("deletes room row, all child DB rows, and attachment files from disk", async () => {
    // --- Arrange ---------------------------------------------------------
    const owner = await insertUser({ email: "owner@example.com", username: "owner_user" });
    const member = await insertUser({ email: "member@example.com", username: "member_user" });
    const invitee = await insertUser({ email: "invitee@example.com", username: "invitee_user" });

    const [room] = await db
      .insert(rooms)
      .values({
        name: "test-room",
        description: "to be deleted",
        type: "private",
        ownerId: owner.id,
      })
      .returning();

    await db.insert(roomMembers).values([
      { roomId: room!.id, userId: owner.id, role: "admin" },
      { roomId: room!.id, userId: member.id, role: "member" },
    ]);

    await db.insert(roomBans).values({
      roomId: room!.id,
      userId: invitee.id,
      bannedByUserId: owner.id,
    });

    await db.insert(roomInvitations).values({
      roomId: room!.id,
      inviteeUserId: invitee.id,
      inviterUserId: owner.id,
      status: "pending",
    });

    const [msg] = await db
      .insert(messages)
      .values({ roomId: room!.id, senderUserId: owner.id, body: "hello" })
      .returning();

    const storageKey1 = `room-del-test-${room!.id}-a.txt`;
    const storageKey2 = `room-del-test-${room!.id}-b.txt`;

    await writeFile(join(UPLOADS_DIR, storageKey1), "attachment 1");
    await writeFile(join(UPLOADS_DIR, storageKey2), "attachment 2");

    await db.insert(attachments).values([
      {
        roomId: room!.id,
        messageId: msg!.id,
        uploaderUserId: owner.id,
        storageKey: storageKey1,
        originalFilename: "a.txt",
        mimeType: "text/plain",
        byteSize: 12,
      },
      {
        roomId: room!.id,
        messageId: msg!.id,
        uploaderUserId: owner.id,
        storageKey: storageKey2,
        originalFilename: "b.txt",
        mimeType: "text/plain",
        byteSize: 12,
      },
    ]);

    // --- Act -------------------------------------------------------------
    await deleteRoom(room!.id);

    // --- Assert: DB rows gone --------------------------------------------
    const deletedRoom = await db.query.rooms.findFirst({
      where: eq(rooms.id, room!.id),
    });
    expect(deletedRoom).toBeUndefined();

    const [memberCount] = await db
      .select({ value: count() })
      .from(roomMembers)
      .where(eq(roomMembers.roomId, room!.id));
    expect(memberCount!.value).toBe(0);

    const [banCount] = await db
      .select({ value: count() })
      .from(roomBans)
      .where(eq(roomBans.roomId, room!.id));
    expect(banCount!.value).toBe(0);

    const [invitationCount] = await db
      .select({ value: count() })
      .from(roomInvitations)
      .where(eq(roomInvitations.roomId, room!.id));
    expect(invitationCount!.value).toBe(0);

    const [messageCount] = await db
      .select({ value: count() })
      .from(messages)
      .where(eq(messages.roomId, room!.id));
    expect(messageCount!.value).toBe(0);

    const [attachmentCount] = await db
      .select({ value: count() })
      .from(attachments)
      .where(eq(attachments.roomId, room!.id));
    expect(attachmentCount!.value).toBe(0);

    // --- Assert: files removed from disk ---------------------------------
    await expect(access(join(UPLOADS_DIR, storageKey1))).rejects.toThrow();
    await expect(access(join(UPLOADS_DIR, storageKey2))).rejects.toThrow();
  });

  it("succeeds when the room has no attachments (nothing to delete from disk)", async () => {
    const owner = await insertUser({ email: "owner2@example.com", username: "owner2" });

    const [room] = await db
      .insert(rooms)
      .values({ name: "empty-room", type: "public", ownerId: owner.id })
      .returning();

    await db.insert(roomMembers).values({
      roomId: room!.id,
      userId: owner.id,
      role: "admin",
    });

    await deleteRoom(room!.id);

    const deletedRoom = await db.query.rooms.findFirst({
      where: eq(rooms.id, room!.id),
    });
    expect(deletedRoom).toBeUndefined();
  });
});
