import type { Server as SocketIOServer } from "socket.io";

import type {
  PresenceSnapshot,
  PresenceStatus,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../lib/socket";

type SocketEntry = {
  socketId: string;
  lastHeartbeat: number;
};

type TypedIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

// userId -> Set of socket entries
const presenceMap = new Map<string, Set<SocketEntry>>();

// userId -> last computed status (for change detection)
const lastStatus = new Map<string, PresenceStatus>();

const HEARTBEAT_TIMEOUT_MS = 60_000;
const SWEEP_INTERVAL_MS = 5_000;

let sweepTimer: ReturnType<typeof setInterval> | null = null;

function deriveStatus(entries: Set<SocketEntry> | undefined): PresenceStatus {
  if (!entries || entries.size === 0) return "offline";
  const now = Date.now();
  for (const entry of entries) {
    if (now - entry.lastHeartbeat < HEARTBEAT_TIMEOUT_MS) {
      return "online";
    }
  }
  return "afk";
}

export function addSocket(userId: string, socketId: string): void {
  let entries = presenceMap.get(userId);
  if (!entries) {
    entries = new Set();
    presenceMap.set(userId, entries);
  }
  entries.add({ socketId, lastHeartbeat: Date.now() });
}

export function removeSocket(userId: string, socketId: string): void {
  const entries = presenceMap.get(userId);
  if (!entries) return;
  for (const entry of entries) {
    if (entry.socketId === socketId) {
      entries.delete(entry);
      break;
    }
  }
  if (entries.size === 0) {
    presenceMap.delete(userId);
  }
}

export function recordHeartbeat(userId: string, socketId: string): void {
  const entries = presenceMap.get(userId);
  if (!entries) return;
  for (const entry of entries) {
    if (entry.socketId === socketId) {
      entry.lastHeartbeat = Date.now();
      return;
    }
  }
}

export function getSnapshot(): PresenceSnapshot {
  const snapshot: PresenceSnapshot = {};
  for (const [userId, entries] of presenceMap) {
    snapshot[userId] = deriveStatus(entries);
  }
  return snapshot;
}

export function startPresenceSweep(io: TypedIO): void {
  if (sweepTimer) return;

  sweepTimer = setInterval(() => {
    for (const [userId, entries] of presenceMap) {
      const current = deriveStatus(entries);
      const previous = lastStatus.get(userId);

      if (current !== previous) {
        lastStatus.set(userId, current);
        io.emit("presence:update", { userId, status: current });
      }
    }

    // Check users who went fully offline (removed from map but still in lastStatus)
    for (const [userId, prev] of lastStatus) {
      if (!presenceMap.has(userId) && prev !== "offline") {
        lastStatus.set(userId, "offline");
        io.emit("presence:update", { userId, status: "offline" });
      }
    }
  }, SWEEP_INTERVAL_MS);
}

export function stopPresenceSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
