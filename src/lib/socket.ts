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
};

export type ClientToServerEvents = Record<string, never>;
