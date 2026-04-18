import { NextResponse } from "next/server";

import { db } from "@/db";
import { messages } from "@/db/schema/messages";
import { rooms, roomMembers } from "@/db/schema/rooms";
import { getCurrentUser } from "@/server/auth";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lastActivityAt = sql<Date>`coalesce(max(${messages.createdAt}), ${rooms.createdAt})`;

  const rows = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      type: rooms.type,
      role: roomMembers.role,
      ownerId: rooms.ownerId,
      description: rooms.description,
      lastActivityAt,
    })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .leftJoin(
      messages,
      and(eq(messages.roomId, rooms.id), isNull(messages.deletedAt)),
    )
    .where(and(eq(roomMembers.userId, user.id), isNull(rooms.deletedAt)))
    .groupBy(
      rooms.id,
      rooms.name,
      rooms.type,
      roomMembers.role,
      rooms.ownerId,
      rooms.description,
      rooms.createdAt,
    )
    .orderBy(desc(lastActivityAt), rooms.name);

  return NextResponse.json({ rooms: rows });
}
