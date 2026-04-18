import { NextResponse } from "next/server";

import { db } from "@/db";
import { rooms, roomMembers } from "@/db/schema/rooms";
import { getCurrentUser } from "@/server/auth";
import { and, asc, eq, isNull } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      type: rooms.type,
      role: roomMembers.role,
      ownerId: rooms.ownerId,
      description: rooms.description,
    })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(and(eq(roomMembers.userId, user.id), isNull(rooms.deletedAt)))
    .orderBy(asc(rooms.name));

  return NextResponse.json({ rooms: rows });
}
