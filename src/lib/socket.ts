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

export type MessagePayload = {
  id: string;
  roomId: string;
  content: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: MessageSender;
  replyTo: ReplyPreview;
};

export type PresenceStatus = "online" | "afk" | "offline";

export type PresenceUpdate = {
  userId: string;
  status: PresenceStatus;
};

export type PresenceSnapshot = Record<string, PresenceStatus>;

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
  "presence:update": (payload: PresenceUpdate) => void;
  "presence:snapshot": (payload: PresenceSnapshot) => void;
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
};
