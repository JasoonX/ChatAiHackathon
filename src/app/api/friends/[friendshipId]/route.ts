import { or, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { friendships } from "@/db/schema/friends";
import { getCurrentUser } from "@/server/auth";

type RouteContext = { params: Promise<{ friendshipId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { friendshipId } = await params;
  if (!isValidUUID(friendshipId)) {
    return NextResponse.json({ error: "Invalid friendship ID" }, { status: 400 });
  }

  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);

  if (!friendship) {
    return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
  }

  if (friendship.userOneId !== user.id && friendship.userTwoId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(friendships).where(eq(friendships.id, friendshipId));

  return NextResponse.json({ success: true });
}
