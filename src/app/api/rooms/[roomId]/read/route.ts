import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { messages } from "@/db/schema/messages";
import { roomMembers, rooms } from "@/db/schema/rooms";
import { getCurrentUser } from "@/server/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  if (!isValidUUID(roomId)) {
    return NextResponse.json({ error: "Invalid room ID" }, { status: 400 });
  }

  const [membership] = await db
    .select({ id: roomMembers.id })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(
      and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, user.id),
        isNull(rooms.deletedAt),
      ),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a room member" }, { status: 403 });
  }

  const [latestMessage] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.roomId, roomId), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(1);

  await db
    .update(roomMembers)
    .set({
      lastReadAt: new Date(),
      lastReadMessageId: latestMessage?.id ?? null,
    })
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)));

  return NextResponse.json({
    success: true,
    roomId,
    lastReadMessageId: latestMessage?.id ?? null,
  });
}
