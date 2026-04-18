import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { rooms, roomMembers } from "@/db/schema/rooms";
import { getCurrentUser } from "@/server/auth";
import { and, desc, eq, ilike, isNull, lt, or, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;
  const rawLimit = searchParams.get("limit");
  const limit = Math.min(rawLimit ? parseInt(rawLimit, 10) : 20, 50);

  // Build base conditions: public + non-deleted
  const baseConditions = and(
    eq(rooms.type, "public"),
    isNull(rooms.deletedAt),
  );

  // Optional search filter
  const searchCondition = search
    ? ilike(rooms.name, `%${search}%`)
    : undefined;

  // Cursor-based keyset pagination
  let cursorCondition: ReturnType<typeof or> | undefined;
  if (cursor) {
    const [cursorRoom] = await db
      .select({ createdAt: rooms.createdAt, id: rooms.id })
      .from(rooms)
      .where(eq(rooms.id, cursor))
      .limit(1);

    if (cursorRoom) {
      cursorCondition = or(
        lt(rooms.createdAt, cursorRoom.createdAt),
        and(
          eq(rooms.createdAt, cursorRoom.createdAt),
          lt(rooms.id, cursorRoom.id),
        ),
      );
    }
  }

  const whereClause = and(baseConditions, searchCondition, cursorCondition);

  const rows = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      description: rooms.description,
      type: rooms.type,
      createdAt: rooms.createdAt,
      memberCount: sql<number>`count(${roomMembers.id})::int`,
    })
    .from(rooms)
    .leftJoin(roomMembers, eq(roomMembers.roomId, rooms.id))
    .where(whereClause)
    .groupBy(rooms.id)
    .orderBy(desc(rooms.createdAt), desc(rooms.id))
    .limit(limit + 1);

  let nextCursor: string | null = null;
  if (rows.length === limit + 1) {
    nextCursor = rows[rows.length - 1].id;
    rows.splice(limit);
  }

  return NextResponse.json({ rooms: rows, nextCursor });
}
