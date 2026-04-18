import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { roomInvitations, rooms } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: roomInvitations.id,
      roomId: roomInvitations.roomId,
      roomName: rooms.name,
      inviterUsername: users.username,
      status: roomInvitations.status,
      createdAt: roomInvitations.createdAt,
    })
    .from(roomInvitations)
    .innerJoin(rooms, eq(roomInvitations.roomId, rooms.id))
    .leftJoin(users, eq(roomInvitations.inviterUserId, users.id))
    .where(
      and(
        eq(roomInvitations.inviteeUserId, user.id),
        eq(roomInvitations.status, "pending"),
      ),
    )
    .orderBy(desc(roomInvitations.createdAt));

  const invitations = rows.map((r) => ({
    id: r.id,
    roomId: r.roomId,
    roomName: r.roomName,
    inviterUsername: r.inviterUsername ?? "Unknown",
    createdAt: r.createdAt.toISOString(),
  }));

  return Response.json({ invitations });
}
