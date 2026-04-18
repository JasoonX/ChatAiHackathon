import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { messages } from "@/db/schema/messages";
import { roomMembers, rooms } from "@/db/schema/rooms";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db
    .select({
      roomId: roomMembers.roomId,
      lastReadAt: roomMembers.lastReadAt,
    })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(and(eq(roomMembers.userId, user.id), isNull(rooms.deletedAt)));

  const unread = await Promise.all(
    memberships.map(async (membership) => {
      const [row] = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(messages)
        .where(
          and(
            eq(messages.roomId, membership.roomId),
            gt(messages.createdAt, membership.lastReadAt),
            isNull(messages.deletedAt),
            ne(messages.senderUserId, user.id),
          ),
        );

      return {
        roomId: membership.roomId,
        unreadCount: Number(row?.count ?? 0),
      };
    }),
  );

  return NextResponse.json({ unread });
}
