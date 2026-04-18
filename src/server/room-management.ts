import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { roomBans, roomInvitations, roomMembers, rooms } from "@/db/schema/rooms";
import { users } from "@/db/schema/users";
import {
  canUserDeleteRoom,
  canUserManageMembers,
  canUserRemoveAdmin,
  type PermissionMembership,
  type PermissionRoom,
  type PermissionUser,
} from "@/lib/permissions";

export type RoomPermissionContext = {
  actor: PermissionUser;
  actorMembership: PermissionMembership | null;
  adminUserIds: string[];
  permissionRoom: PermissionRoom;
  room: typeof rooms.$inferSelect;
};

export async function getRoomPermissionContext(
  roomId: string,
  userId: string,
): Promise<RoomPermissionContext | null> {
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt)))
    .limit(1);

  if (!room) {
    return null;
  }

  const [actorMembership, adminRows] = await Promise.all([
    db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
      .limit(1),
    db
      .select({ userId: roomMembers.userId })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.role, "admin"))),
  ]);

  return {
    actor: { id: userId },
    actorMembership: actorMembership[0]
      ? {
          userId: actorMembership[0].userId,
          role: actorMembership[0].role,
        }
      : null,
    adminUserIds: adminRows.map((row) => row.userId),
    permissionRoom: {
      id: room.id,
      type: room.type,
      ownerId: room.ownerId,
      adminUserIds: adminRows.map((row) => row.userId),
    },
    room,
  };
}

export async function getRoomManagementSnapshot(roomId: string, userId: string) {
  const context = await getRoomPermissionContext(roomId, userId);

  if (!context || !context.actorMembership) {
    return null;
  }

  const [memberRows, bannedRows, invitationRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        username: users.username,
        name: users.name,
        image: users.image,
        role: roomMembers.role,
        joinedAt: roomMembers.joinedAt,
      })
      .from(roomMembers)
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .where(eq(roomMembers.roomId, roomId)),
    db
      .select({
        userId: roomBans.userId,
        username: users.username,
        name: users.name,
        bannedByUserId: roomBans.bannedByUserId,
        createdAt: roomBans.createdAt,
        bannedByUsername: users.username,
      })
      .from(roomBans)
      .innerJoin(users, eq(users.id, roomBans.userId))
      .where(eq(roomBans.roomId, roomId)),
    context.room.type === "private"
      ? db
          .select({
            id: roomInvitations.id,
            inviteeUserId: roomInvitations.inviteeUserId,
            inviteeUsername: users.username,
            createdAt: roomInvitations.createdAt,
            status: roomInvitations.status,
          })
          .from(roomInvitations)
          .innerJoin(users, eq(users.id, roomInvitations.inviteeUserId))
          .where(
            and(
              eq(roomInvitations.roomId, roomId),
              eq(roomInvitations.status, "pending"),
            ),
          )
      : Promise.resolve([]),
  ]);

  const bannedByIds = bannedRows
    .map((row) => row.bannedByUserId)
    .filter((value): value is string => value !== null);

  const bannedByUsers =
    bannedByIds.length > 0
      ? await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, bannedByIds))
      : [];

  const bannedByMap = new Map(bannedByUsers.map((row) => [row.id, row.username]));

  const members = memberRows
    .map((row) => ({
      userId: row.userId,
      username: row.username,
      name: row.name,
      image: row.image,
      role: row.role,
      isOwner: context.room.ownerId === row.userId,
      joinedAt: row.joinedAt.toISOString(),
    }))
    .sort((a, b) => {
      if (a.isOwner !== b.isOwner) {
        return a.isOwner ? -1 : 1;
      }
      if (a.role !== b.role) {
        return a.role === "admin" ? -1 : 1;
      }
      return a.username.localeCompare(b.username);
    });

  return {
    room: {
      id: context.room.id,
      name: context.room.name,
      description: context.room.description,
      type: context.room.type,
      ownerId: context.room.ownerId,
      currentUserRole: context.actorMembership.role,
      canManageMembers: canUserManageMembers(
        context.actor,
        context.permissionRoom,
        context.actorMembership,
      ),
      canDeleteRoom: canUserDeleteRoom(context.actor, context.permissionRoom),
    },
    members,
    admins: members.filter((member) => member.isOwner || member.role === "admin"),
    bans: bannedRows.map((row) => ({
      userId: row.userId,
      username: row.username,
      name: row.name,
      bannedByUserId: row.bannedByUserId,
      bannedByUsername: row.bannedByUserId
        ? bannedByMap.get(row.bannedByUserId) ?? null
        : null,
      createdAt: row.createdAt.toISOString(),
    })),
    invitations: invitationRows.map((row) => ({
      id: row.id,
      inviteeUserId: row.inviteeUserId,
      inviteeUsername: row.inviteeUsername,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export function canActorManageMembers(context: RoomPermissionContext) {
  return canUserManageMembers(
    context.actor,
    context.permissionRoom,
    context.actorMembership,
  );
}

export function canActorDeleteRoom(context: RoomPermissionContext) {
  return canUserDeleteRoom(context.actor, context.permissionRoom);
}

export function canActorRemoveAdmin(
  context: RoomPermissionContext,
  targetUserId: string,
) {
  return canUserRemoveAdmin(context.actor, { id: targetUserId }, context.permissionRoom);
}
