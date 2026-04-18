import { db } from "@/db";
import { roomMembers, rooms } from "@/db/schema/rooms";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import { and, eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.ownerId === user.id) {
    return Response.json(
      { error: "Owner cannot leave the room. Delete the room instead." },
      { status: 400 }
    );
  }

  await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)));

  getIO()?.to(roomId).emit("room:member-left", { roomId, userId: user.id });

  return Response.json({ success: true }, { status: 200 });
}
