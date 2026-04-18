import { io, type Socket } from "socket.io-client";

import type { ClientToServerEvents, PresenceSnapshot, ServerToClientEvents } from "./socket";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: TypedSocket | null = null;
let _presenceCache: PresenceSnapshot = {};

/** Returns the most recent presence snapshot received from the server. */
export function getCachedPresence(): PresenceSnapshot {
  return _presenceCache;
}

/** Disconnect and destroy the socket singleton (call on logout). */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
    _presenceCache = {};
  }
}

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
    // Cache the snapshot so components that mount after the event still get it.
    _socket.on("presence:snapshot", (snapshot) => {
      _presenceCache = snapshot;
    });
    _socket.on("presence:update", ({ userId, status }) => {
      _presenceCache = { ..._presenceCache, [userId]: status };
    });
  }
  return _socket;
}
