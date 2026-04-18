export type PermissionUser = {
  id: string;
};

export type PermissionRoom = {
  id?: string;
  type: "public" | "private" | "direct";
  ownerId?: string | null;
  adminUserIds?: string[];
  hasInvitation?: boolean;
};

export type PermissionMembership = {
  userId: string;
  role: "member" | "admin";
};

export type PermissionBan = {
  userId: string;
};

export type PermissionMessage = {
  id?: string;
  authorId: string;
};

export type PermissionFriendship = {
  exists: boolean;
};

export type PermissionUserBan = {
  blockerUserId: string;
  blockedUserId: string;
};

export function canUserJoinRoom(
  user: PermissionUser,
  room: PermissionRoom,
  membership: PermissionMembership | null,
  ban: PermissionBan | null,
) {
  if (ban?.userId === user.id) {
    return false;
  }

  if (membership?.userId === user.id) {
    return false;
  }

  if (room.type === "private") {
    return room.hasInvitation === true;
  }

  return room.type === "public";
}

export function canUserPostInRoom(
  _user: PermissionUser,
  _room: PermissionRoom,
  membership: PermissionMembership | null,
) {
  return membership !== null;
}

export function canUserDeleteMessage(
  user: PermissionUser,
  message: PermissionMessage,
  room: PermissionRoom,
) {
  if (message.authorId === user.id) {
    return true;
  }

  if (room.type === "direct") {
    return false;
  }

  if (room.ownerId === user.id) {
    return true;
  }

  return room.adminUserIds?.includes(user.id) ?? false;
}

export function canUserManageMembers(
  user: PermissionUser,
  room: PermissionRoom,
  membership: PermissionMembership | null,
) {
  if (room.ownerId === user.id) {
    return true;
  }

  return membership?.role === "admin";
}

export function canUserDeleteRoom(user: PermissionUser, room: PermissionRoom) {
  return room.ownerId === user.id;
}

export function canUserDownloadAttachment(
  _user: PermissionUser,
  roomMembership: PermissionMembership | null,
) {
  return roomMembership !== null;
}

export function canUsersDirectMessage(
  userA: PermissionUser,
  userB: PermissionUser,
  friendship: PermissionFriendship | null,
  bans: PermissionUserBan[],
) {
  if (!friendship?.exists) {
    return false;
  }

  return !bans.some(
    (ban) =>
      (ban.blockerUserId === userA.id && ban.blockedUserId === userB.id) ||
      (ban.blockerUserId === userB.id && ban.blockedUserId === userA.id),
  );
}

export function canUserInviteToRoom(
  _user: PermissionUser,
  room: PermissionRoom,
  membership: PermissionMembership | null,
) {
  if (room.type !== "private") {
    return false;
  }

  return membership !== null;
}

export function canUserRemoveAdmin(
  actingUser: PermissionUser,
  targetUser: PermissionUser,
  room: PermissionRoom,
) {
  return room.ownerId === actingUser.id && room.ownerId !== targetUser.id;
}
