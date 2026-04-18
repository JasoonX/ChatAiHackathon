export type PermissionUser = {
  id: string;
};

export type PermissionMessage = {
  authorId: string;
};

export type PermissionRoom = {
  adminUserIds: string[];
};

export function canUserDeleteMessage(
  _user: PermissionUser,
  _message: PermissionMessage,
  _room: PermissionRoom,
) {
  throw new Error("not implemented");
}
