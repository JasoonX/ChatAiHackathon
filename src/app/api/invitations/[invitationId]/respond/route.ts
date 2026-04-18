import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { roomBans, roomInvitations, roomMembers, rooms } from "@/db/schema/rooms";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invitationId } = await params;

  const body = (await req.json()) as { action?: string };
  if (body.action !== "accept" && body.action !== "reject") {
    return Response.json(
      { error: "action must be 'accept' or 'reject'" },
      { status: 400 },
    );
  }

  // Fetch invitation
  const [invitation] = await db
    .select()
    .from(roomInvitations)
    .where(eq(roomInvitations.id, invitationId))
    .limit(1);

  if (!invitation) {
    return Response.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.inviteeUserId !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invitation.status !== "pending") {
    return Response.json(
      { error: "Invitation already responded to" },
      { status: 409 },
    );
  }

  // Verify room still exists
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, invitation.roomId), isNull(rooms.deletedAt)))
    .limit(1);

  if (!room) {
    return Response.json({ error: "Room no longer exists" }, { status: 404 });
  }

  const newStatus = body.action === "accept" ? "accepted" : "rejected";

  if (body.action === "accept") {
    const [existingBan] = await db
      .select({ id: roomBans.id })
      .from(roomBans)
      .where(
        and(
          eq(roomBans.roomId, invitation.roomId),
          eq(roomBans.userId, user.id),
        ),
      )
      .limit(1);

    if (existingBan) {
      return Response.json(
        { error: "You are banned from this room and cannot accept the invitation" },
        { status: 403 },
      );
    }

    const [existingMembership] = await db
      .select({ id: roomMembers.id })
      .from(roomMembers)
      .where(
        and(
          eq(roomMembers.roomId, invitation.roomId),
          eq(roomMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (!existingMembership) {
      await db
        .insert(roomMembers)
        .values({
          roomId: invitation.roomId,
          userId: user.id,
          role: "member",
        })
        .onConflictDoNothing();
    }
  }

  // Update invitation status
  await db
    .update(roomInvitations)
    .set({ status: newStatus, respondedAt: new Date() })
    .where(eq(roomInvitations.id, invitationId));

  if (body.action === "accept") {
    // Socket: join room channel + broadcast
    const io = getIO();
    if (io) {
      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        if (s.data.userId === user.id) {
          await s.join(invitation.roomId);
        }
      }

      io.to(invitation.roomId).emit("room:member-joined", {
        roomId: invitation.roomId,
        userId: user.id,
        username: user.name ?? user.username ?? "",
      });
    }
  }

  return Response.json({ success: true }, { status: 200 });
}
