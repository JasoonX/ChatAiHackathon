"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authClient } from "@/lib/auth-client";

type UnreadMap = Record<string, number>;

type UnreadContextValue = {
  unreadMap: UnreadMap;
  getUnreadCount: (roomId: string | null | undefined) => number;
  setUnreadCounts: (entries: Array<{ roomId: string; unreadCount: number }>) => void;
  incrementUnread: (roomId: string) => void;
  clearUnread: (roomId: string) => void;
  refreshUnread: () => Promise<void>;
};

const UnreadContext = createContext<UnreadContextValue | null>(null);

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadMap, setUnreadMap] = useState<UnreadMap>({});
  const { data: session } = authClient.useSession();

  const setUnreadCounts = useCallback(
    (entries: Array<{ roomId: string; unreadCount: number }>) => {
      const next: UnreadMap = {};
      for (const entry of entries) {
        if (entry.unreadCount > 0) {
          next[entry.roomId] = entry.unreadCount;
        }
      }
      setUnreadMap(next);
    },
    [],
  );

  const refreshUnread = useCallback(async () => {
    if (!session?.user?.id) {
      setUnreadMap({});
      return;
    }

    const response = await fetch("/api/rooms/unread");
    if (!response.ok) {
      if (response.status === 401) {
        setUnreadMap({});
        return;
      }
      throw new Error("Failed to load unread counts");
    }

    const payload = (await response.json()) as {
      unread: Array<{ roomId: string; unreadCount: number }>;
    };
    setUnreadCounts(payload.unread);
  }, [session?.user?.id, setUnreadCounts]);

  useEffect(() => {
    void refreshUnread().catch(() => {
      setUnreadMap({});
    });
  }, [refreshUnread]);

  const incrementUnread = useCallback((roomId: string) => {
    setUnreadMap((current) => ({
      ...current,
      [roomId]: (current[roomId] ?? 0) + 1,
    }));
  }, []);

  const clearUnread = useCallback((roomId: string) => {
    setUnreadMap((current) => {
      if (!(roomId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[roomId];
      return next;
    });
  }, []);

  const getUnreadCount = useCallback(
    (roomId: string | null | undefined) => {
      if (!roomId) {
        return 0;
      }
      return unreadMap[roomId] ?? 0;
    },
    [unreadMap],
  );

  const value = useMemo(
    () => ({
      unreadMap,
      getUnreadCount,
      setUnreadCounts,
      incrementUnread,
      clearUnread,
      refreshUnread,
    }),
    [clearUnread, getUnreadCount, incrementUnread, refreshUnread, setUnreadCounts, unreadMap],
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error("useUnread must be used within UnreadProvider");
  }
  return context;
}
