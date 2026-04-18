import { or, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { friendships } from "@/db/schema/friends";
import { getIO } from "@/lib/socket-server";
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

  // Notify the other party in real-time
  const otherUserId =
    friendship.userOneId === user.id ? friendship.userTwoId : friendship.userOneId;

  const io = getIO();
  if (io) {
    const sockets = await io.fetchSockets();
    for (const s of sockets) {
      if (s.data.userId === otherUserId) {
        s.emit("friend:removed", { friendUserId: user.id });
      }
    }
    // Also notify the actor so other tabs update immediately
    for (const s of sockets) {
      if (s.data.userId === user.id) {
        s.emit("friend:removed", { friendUserId: otherUserId });
      }
    }
  }

  return NextResponse.json({ success: true });
}
