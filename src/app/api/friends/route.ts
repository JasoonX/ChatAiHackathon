import { and, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { friendships } from "@/db/schema/friends";
import { messages } from "@/db/schema/messages";
import { roomMembers, rooms } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/server/auth";
import { getDirectRoomKey } from "@/server/friends";
import { getSnapshot } from "@/server/presence";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const friendshipRows = await db
    .select({
      id: friendships.id,
      userOneId: friendships.userOneId,
      userTwoId: friendships.userTwoId,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .where(or(eq(friendships.userOneId, user.id), eq(friendships.userTwoId, user.id)))
    .orderBy(desc(friendships.createdAt));

  const friendIds = friendshipRows.map((row) =>
    row.userOneId === user.id ? row.userTwoId : row.userOneId,
  );

  if (friendIds.length === 0) {
    return NextResponse.json({ friends: [] });
  }

  const [friendUsers, directRooms] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        image: users.image,
      })
      .from(users)
      .where(inArray(users.id, friendIds)),
    db
      .select({
        id: rooms.id,
        directKey: rooms.directKey,
      })
      .from(rooms)
      .where(
        inArray(
          rooms.directKey,
          friendIds.map((friendId) => getDirectRoomKey(user.id, friendId)),
        ),
      ),
  ]);

  const directRoomIds = directRooms.map((room) => room.id);
  const membershipRows =
    directRoomIds.length > 0
      ? await db
          .select({
            roomId: roomMembers.roomId,
            lastReadAt: roomMembers.lastReadAt,
          })
          .from(roomMembers)
          .where(
            and(eq(roomMembers.userId, user.id), inArray(roomMembers.roomId, directRoomIds)),
          )
      : [];

  const friendMap = new Map(friendUsers.map((friendUser) => [friendUser.id, friendUser]));
  const directRoomMap = new Map(
    directRooms.map((room) => [room.directKey ?? "", room.id]),
  );
  const membershipMap = new Map(
    membershipRows.map((membership) => [membership.roomId, membership]),
  );
  const presenceSnapshot = getSnapshot();

  const friends = await Promise.all(
    friendshipRows.map(async (row) => {
      const friendId = row.userOneId === user.id ? row.userTwoId : row.userOneId;
      const friendUser = friendMap.get(friendId);
      const directRoomId = directRoomMap.get(getDirectRoomKey(user.id, friendId)) ?? null;
      const membership = directRoomId ? membershipMap.get(directRoomId) ?? null : null;

      let unreadCount = 0;

      if (directRoomId && membership) {
        const [unread] = await db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(messages)
          .where(
            and(
              eq(messages.roomId, directRoomId),
              gt(messages.createdAt, membership.lastReadAt),
              isNull(messages.deletedAt),
              ne(messages.senderUserId, user.id),
            ),
          );

        unreadCount = Number(unread?.count ?? 0);
      }

      return {
        friendshipId: row.id,
        userId: friendId,
        username: friendUser?.username ?? "Unknown",
        name: friendUser?.name ?? "Unknown",
        image: friendUser?.image ?? null,
        directRoomId,
        presence: presenceSnapshot[friendId] ?? "offline",
        unreadCount,
      };
    }),
  );

  friends.sort((a, b) => a.username.localeCompare(b.username));

  return NextResponse.json({ friends });
}
