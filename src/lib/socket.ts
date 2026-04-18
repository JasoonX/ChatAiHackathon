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
  sender: MessageSender;
  replyTo: ReplyPreview;
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
};

export type ClientToServerEvents = {
  "message:send": (
    payload: { roomId: string; content: string },
    callback: (response: { error?: string; message?: MessagePayload }) => void,
  ) => void;
  /** Tell the server to add this socket to the Socket.io room channel. */
  "room:subscribe": (roomId: string) => void;
};
