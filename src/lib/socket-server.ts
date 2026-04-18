import type { Server } from "socket.io";

import type { ClientToServerEvents, ServerToClientEvents } from "./socket";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;

let _io: IOServer | null = null;

export function setIO(io: IOServer): void {
  _io = io;
}

export function getIO(): IOServer | null {
  return _io;
}
