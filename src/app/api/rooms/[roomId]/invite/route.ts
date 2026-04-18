import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { roomInvitations, roomMembers, rooms } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import { canUserInviteToRoom } from "@/lib/permissions";
import { getIO } from "@/lib/socket-server";
import type { InvitationPayload } from "@/lib/socket";
import { getCurrentUser } from "@/server/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  const body = (await req.json()) as { username?: string };
  const username = body.username?.trim().toLowerCase();

  if (!username) {
    return Response.json(
      { error: "Username is required" },
      { status: 400 },
    );
  }

  // Fetch room
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt)))
    .limit(1);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.type !== "private") {
    return Response.json(
      { error: "Only private rooms support invitations" },
      { status: 400 },
    );
  }

  // Check inviter membership
  const [membership] = await db
    .select()
    .from(roomMembers)
    .where(
      and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)),
    )
    .limit(1);

  if (
    !canUserInviteToRoom(
      user,
      { type: room.type, ownerId: room.ownerId },
      membership ? { userId: membership.userId, role: membership.role } : null,
    )
  ) {
    return Response.json(
      { error: "You must be a member to invite" },
      { status: 403 },
    );
  }

  // Resolve invitee
  const [invitee] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!invitee) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (invitee.id === user.id) {
    return Response.json(
      { error: "Cannot invite yourself" },
      { status: 400 },
    );
  }

  // Check if invitee is already a member
  const [existingMembership] = await db
    .select({ id: roomMembers.id })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, invitee.id),
      ),
    )
    .limit(1);

  if (existingMembership) {
    return Response.json(
      { error: "User is already a member" },
      { status: 409 },
    );
  }

  // Check for existing pending invitation
  const [existingInvite] = await db
    .select({ id: roomInvitations.id })
    .from(roomInvitations)
    .where(
      and(
        eq(roomInvitations.roomId, roomId),
        eq(roomInvitations.inviteeUserId, invitee.id),
        eq(roomInvitations.status, "pending"),
      ),
    )
    .limit(1);

  if (existingInvite) {
    return Response.json(
      { error: "Invitation already pending" },
      { status: 409 },
    );
  }

  // Insert invitation
  const [invitation] = await db
    .insert(roomInvitations)
    .values({
      roomId,
      inviteeUserId: invitee.id,
      inviterUserId: user.id,
      status: "pending",
    })
    .returning();

  // Emit to invitee's sockets
  const io = getIO();
  if (io) {
    const payload: InvitationPayload = {
      id: invitation.id,
      roomId: room.id,
      roomName: room.name,
      inviterUsername: user.name ?? user.username ?? "",
      createdAt: invitation.createdAt.toISOString(),
    };

    // Find sockets belonging to invitee
    const sockets = await io.fetchSockets();
    for (const s of sockets) {
      if (s.data.userId === invitee.id) {
        s.emit("invitation:received", payload);
      }
    }
  }

  return Response.json({ success: true }, { status: 200 });
}
