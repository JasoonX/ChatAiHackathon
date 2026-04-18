export type MessageSender = {
  id: string;
  username: string;
  name: string;
  image: string | null;
};

export type ReplyPreview = {
  id: string;
  content: string | null;
  sender: { username: string };
} | null;

export type AttachmentPayload = {
  id: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  imageWidth: number | null;
  imageHeight: number | null;
  comment: string | null;
};

export type MessagePayload = {
  id: string;
  roomId: string;
  content: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: MessageSender;
  replyTo: ReplyPreview;
  attachments: AttachmentPayload[];
};

export type PresenceStatus = "online" | "afk" | "offline";

export type PresenceUpdate = {
  userId: string;
  status: PresenceStatus;
};

export type PresenceSnapshot = Record<string, PresenceStatus>;

export type InvitationPayload = {
  id: string;
  roomId: string;
  roomName: string;
  inviterUsername: string;
  createdAt: string;
};

export type FriendRequestPayload = {
  requestId: string;
  requesterUserId: string;
  requesterUsername: string;
  message: string | null;
  createdAt: string;
};

export type RoomUpdatedPayload = {
  roomId: string;
  name: string;
  description: string | null;
  type: "public" | "private" | "direct";
};

export type ServerToClientEvents = {
  hello: (payload: { message: string }) => void;
  "room:member-joined": (payload: {
    roomId: string;
    userId: string;
    username: string;
  }) => void;
  "room:member-left": (payload: {
    roomId: string;
    userId: string;
  }) => void;
  "message:new": (payload: MessagePayload) => void;
  "message:updated": (payload: MessagePayload) => void;
  "message:deleted": (payload: { id: string; roomId: string; deletedAt: string }) => void;
  "invitation:received": (payload: InvitationPayload) => void;
  "presence:update": (payload: PresenceUpdate) => void;
  "presence:snapshot": (payload: PresenceSnapshot) => void;
  "friend:request-received": (payload: FriendRequestPayload) => void;
  "friend:accepted": (payload: {
    requestId: string;
    friendUserId: string;
    friendUsername: string;
    directRoomId: string;
  }) => void;
  "friend:removed": (payload: { friendUserId: string }) => void;
  "user:banned": (payload: {
    blockerUserId: string;
    blockedUserId: string;
  }) => void;
  "room:member-banned": (payload: {
    roomId: string;
    userId: string;
    bannedByUserId: string;
    createdAt: string;
  }) => void;
  "room:ban-removed": (payload: {
    roomId: string;
    userId: string;
  }) => void;
  "room:admin-updated": (payload: {
    roomId: string;
    userId: string;
    role: "admin" | "member";
  }) => void;
  "room:updated": (payload: RoomUpdatedPayload) => void;
  "room:deleted": (payload: { roomId: string }) => void;
  "session:revoked": () => void;
};

export type ClientToServerEvents = {
  "message:send": (
    payload: { roomId: string; content: string; replyToMessageId?: string },
    callback: (response: { error?: string; message?: MessagePayload }) => void,
  ) => void;
  /** Tell the server to add this socket to the Socket.io room channel. */
  "room:subscribe": (roomId: string) => void;
  /** Client activity heartbeat for presence tracking. */
  heartbeat: () => void;
  /** Request a fresh presence snapshot from the server. */
  "presence:refresh": () => void;
};
