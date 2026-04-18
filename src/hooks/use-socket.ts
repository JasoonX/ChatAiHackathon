"use client";

import { useEffect, useRef, useState } from "react";

import { getSocket, type TypedSocket } from "@/lib/socket-client";

export function useSocket(): { socket: TypedSocket | null; connected: boolean } {
  const socketRef = useRef<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);

  // Lazily create the socket on first client-side render
  if (!socketRef.current && typeof window !== "undefined") {
    socketRef.current = getSocket();
  }

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket: socketRef.current, connected };
}
