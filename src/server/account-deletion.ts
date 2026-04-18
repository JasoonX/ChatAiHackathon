import { unlink } from "node:fs/promises";
import { join } from "node:path";

import { eq, inArray, or } from "drizzle-orm";

import { db } from "../db";
import { friendRequests, friendships, userBans } from "../db/schema/friends";
import { attachments, messages } from "../db/schema/messages";
import { roomBans, roomInvitations, roomMembers, rooms } from "../db/schema/rooms";
import { accounts, sessions, users, verifications } from "../db/schema/users";

const UPLOADS_DIR = join(process.cwd(), "uploads");

async function deleteFiles(storageKeys: string[]) {
  await Promise.allSettled(
    storageKeys.map((storageKey) => unlink(join(UPLOADS_DIR, storageKey))),
  );
}

export async function deleteUserAccount(userId: string) {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return;
  }

  const ownedRooms = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.ownerId, userId));

  const ownedRoomIds = ownedRooms.map((room) => room.id);

  const attachmentRows =
    ownedRoomIds.length > 0
      ? await db
          .select({
            id: attachments.id,
            storageKey: attachments.storageKey,
          })
          .from(attachments)
          .where(inArray(attachments.roomId, ownedRoomIds))
      : [];

  await db.transaction(async (tx) => {
    if (ownedRoomIds.length > 0) {
      const ownedMessageIds = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(inArray(messages.roomId, ownedRoomIds));

      const messageIds = ownedMessageIds.map((message) => message.id);

      if (messageIds.length > 0) {
        await tx.delete(attachments).where(inArray(attachments.messageId, messageIds));
        await tx.delete(messages).where(inArray(messages.id, messageIds));
      }

      await tx.delete(roomMembers).where(inArray(roomMembers.roomId, ownedRoomIds));
      await tx.delete(roomInvitations).where(inArray(roomInvitations.roomId, ownedRoomIds));
      await tx.delete(roomBans).where(inArray(roomBans.roomId, ownedRoomIds));
      await tx.delete(rooms).where(inArray(rooms.id, ownedRoomIds));
    }

    await tx
      .delete(roomMembers)
      .where(eq(roomMembers.userId, userId));

    await tx
      .delete(friendships)
      .where(or(eq(friendships.userOneId, userId), eq(friendships.userTwoId, userId)));

    await tx
      .delete(friendRequests)
      .where(
        or(
          eq(friendRequests.requesterUserId, userId),
          eq(friendRequests.addresseeUserId, userId),
        ),
      );

    await tx
      .delete(userBans)
      .where(
        or(eq(userBans.blockerUserId, userId), eq(userBans.blockedUserId, userId)),
      );

    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx
      .delete(verifications)
      .where(
        or(
          eq(verifications.identifier, userId),
          eq(verifications.identifier, user.email),
        ),
      );
    await tx.delete(users).where(eq(users.id, userId));
  });

  await deleteFiles(attachmentRows.map((attachment) => attachment.storageKey));
}
