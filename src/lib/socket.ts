export type ServerToClientEvents = {
  hello: (payload: { message: string }) => void;
};

export type ClientToServerEvents = Record<string, never>;
