"use client";

import { useEffect, useRef } from "react";

import type { TypedSocket } from "@/lib/socket-client";

const DEBOUNCE_MS = 2_000;

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
  "focus",
];

export function useActivityHeartbeat(socket: TypedSocket | null): void {
  const lastEmitRef = useRef(0);

  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      const now = Date.now();
      if (now - lastEmitRef.current < DEBOUNCE_MS) return;
      lastEmitRef.current = now;
      socket.emit("heartbeat");
    };

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handler, { passive: true });
    }

    // Emit an initial heartbeat on mount
    handler();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handler);
      }
    };
  }, [socket]);
}
