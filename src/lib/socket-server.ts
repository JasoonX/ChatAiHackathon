import type { Server } from "socket.io";

import type { ClientToServerEvents, ServerToClientEvents } from "./socket";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;

const g = globalThis as unknown as { __socketIO?: IOServer };

export function setIO(io: IOServer): void {
  g.__socketIO = io;
}

export function getIO(): IOServer | null {
  return g.__socketIO ?? null;
}
