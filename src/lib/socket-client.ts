import { io, type Socket } from "socket.io-client";

import type { ClientToServerEvents, ServerToClientEvents } from "./socket";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: TypedSocket | null = null;

export function getSocket(): TypedSocket | null {
  if (typeof window === "undefined") return null;
  if (!_socket) {
    _socket = io({
      path: "/socket.io",
      autoConnect: true,
      withCredentials: true,
    });
    _socket.on("connect", () => console.log("[socket] connected, id:", _socket?.id));
    _socket.on("connect_error", (err) => console.error("[socket] connect_error:", err.message));
    _socket.on("disconnect", (reason) => console.log("[socket] disconnected:", reason));
  }
  return _socket;
}
