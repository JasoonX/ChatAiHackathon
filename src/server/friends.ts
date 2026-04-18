import { and, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { friendships, userBans } from "@/db/schema/friends";
import { roomMembers, rooms } from "@/db/schema/rooms";
import {
  canUsersDirectMessage,
  type PermissionFriendship,
  type PermissionUserBan,
} from "@/lib/permissions";

type DbLike = Omit<typeof db, "$client">;

export function getCanonicalUserPair(userAId: string, userBId: string) {
  return userAId < userBId ? [userAId, userBId] as const : [userBId, userAId] as const;
}

export function getFriendPairKey(userAId: string, userBId: string) {
  const [userOneId, userTwoId] = getCanonicalUserPair(userAId, userBId);
  return `${userOneId}:${userTwoId}`;
}

export function getDirectRoomKey(userAId: string, userBId: string) {
  return `dm:${getFriendPairKey(userAId, userBId)}`;
}

export async function getUserBansBetween(
  dbLike: DbLike,
  userAId: string,
  userBId: string,
) {
  return dbLike
    .select({
      blockerUserId: userBans.blockerUserId,
      blockedUserId: userBans.blockedUserId,
    })
    .from(userBans)
    .where(
      or(
        and(eq(userBans.blockerUserId, userAId), eq(userBans.blockedUserId, userBId)),
        and(eq(userBans.blockerUserId, userBId), eq(userBans.blockedUserId, userAId)),
      ),
    );
}

export async function getFriendshipBetween(
  dbLike: DbLike,
  userAId: string,
  userBId: string,
) {
  const pairKey = getFriendPairKey(userAId, userBId);
  const [friendship] = await dbLike
    .select({
      id: friendships.id,
      userOneId: friendships.userOneId,
      userTwoId: friendships.userTwoId,
      pairKey: friendships.pairKey,
    })
    .from(friendships)
    .where(eq(friendships.pairKey, pairKey))
    .limit(1);

  return friendship ?? null;
}

export async function ensureDirectRoom(
  dbLike: DbLike,
  userAId: string,
  userBId: string,
) {
  const directKey = getDirectRoomKey(userAId, userBId);

  const [existingRoom] = await dbLike
    .select({
      id: rooms.id,
      name: rooms.name,
      type: rooms.type,
      directKey: rooms.directKey,
    })
    .from(rooms)
    .where(eq(rooms.directKey, directKey))
    .limit(1);

  const room =
    existingRoom ??
    (
      await dbLike
        .insert(rooms)
        .values({
          type: "direct",
          name: directKey,
          description: null,
          ownerId: null,
          directKey,
        })
        .returning({
          id: rooms.id,
          name: rooms.name,
          type: rooms.type,
          directKey: rooms.directKey,
        })
    )[0];

  await dbLike
    .insert(roomMembers)
    .values([
      { roomId: room.id, userId: userAId, role: "member" },
      { roomId: room.id, userId: userBId, role: "member" },
    ])
    .onConflictDoNothing({
      target: [roomMembers.roomId, roomMembers.userId],
    });

  return room;
}

export async function getDirectMessageState(roomId: string, userId: string) {
  const [room] = await db
    .select({
      id: rooms.id,
      type: rooms.type,
      ownerId: rooms.ownerId,
    })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room || room.type !== "direct") {
    return null;
  }

  const members = await db
    .select({
      userId: roomMembers.userId,
      role: roomMembers.role,
    })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId));

  const membership = members.find((member) => member.userId === userId) ?? null;
  const otherUserId = members.find((member) => member.userId !== userId)?.userId ?? null;

  if (!membership || !otherUserId) {
    return {
      room,
      membership,
      otherUserId,
      friendship: null as PermissionFriendship | null,
      bans: [] as PermissionUserBan[],
      canMessage: false,
    };
  }

  const [friendshipRow, bans] = await Promise.all([
    getFriendshipBetween(db, userId, otherUserId),
    getUserBansBetween(db, userId, otherUserId),
  ]);

  const friendship = friendshipRow ? { exists: true } : null;
  const canMessage = canUsersDirectMessage(
    { id: userId },
    { id: otherUserId },
    friendship,
    bans,
  );

  return {
    room,
    membership,
    otherUserId,
    friendship,
    bans,
    canMessage,
  };
}
