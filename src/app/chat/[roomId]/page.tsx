"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Send } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSocket } from "@/hooks/use-socket";
import type { MessagePayload } from "@/lib/socket";

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: MessagePayload }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const initials = (message.sender.name || message.sender.username)
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        {message.sender.image && (
          <AvatarImage src={message.sender.image} alt={message.sender.name} />
        )}
        <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[13px] font-semibold text-foreground">
            {message.sender.name || message.sender.username}
          </span>
          <span className="text-[11px] text-muted-foreground">{time}</span>
        </div>

        {message.replyTo && (
          <div className="mb-1.5 flex items-center gap-1.5 pl-3 border-l-2 border-muted-foreground/30 text-[12px] text-muted-foreground max-w-md">
            <span className="font-medium shrink-0">
              {message.replyTo.sender.username}:
            </span>
            <span className="truncate">
              {message.replyTo.content ?? "[attachment]"}
            </span>
          </div>
        )}

        <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
          {message.content ?? ""}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat page
// ---------------------------------------------------------------------------

type MessagesResponse = {
  messages: MessagePayload[];
  hasMore: boolean;
  nextCursor: string | null;
};

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  const [msgs, setMsgs] = useState<MessagePayload[]>([]);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const initialLoadedRef = useRef(false);

  // Get room name from sidebar cache
  const cachedRooms = queryClient.getQueryData<{
    rooms: { id: string; name: string; type: string }[];
  }>(["my-rooms"]);
  const roomName = cachedRooms?.rooms.find((r) => r.id === roomId)?.name;

  // -------------------------------------------------------------------------
  // Initial fetch
  // -------------------------------------------------------------------------

  const { data: initialData, isLoading } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/messages?limit=50`);
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to fetch messages");
      }
      return res.json() as Promise<MessagesResponse>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  // Subscribe socket to this room's channel and reset state on room change
  useEffect(() => {
    setMsgs([]);
    setOldestCursor(null);
    setHasMore(false);
    initialLoadedRef.current = false;
    isAtBottomRef.current = true;

    if (!socket) return;
    // Ensure the server-side socket is joined to this room's channel.
    // The auto-join on connection only covers rooms the user was already in;
    // rooms joined mid-session need an explicit subscribe.
    console.log("[room:subscribe] emitting for roomId:", roomId, "connected:", socket.connected);
    socket.emit("room:subscribe", roomId);
  }, [roomId, socket]);

  // Populate messages from initial fetch
  useEffect(() => {
    if (!initialData) return;
    setMsgs(initialData.messages);
    setHasMore(initialData.hasMore);
    setOldestCursor(initialData.nextCursor);
    initialLoadedRef.current = false; // will scroll in next effect
  }, [initialData]);

  // Scroll to bottom after initial messages render
  useEffect(() => {
    if (initialData && !initialLoadedRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      initialLoadedRef.current = true;
    }
  }, [msgs, initialData]);

  // -------------------------------------------------------------------------
  // Socket: real-time messages
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: MessagePayload) => {
      console.log("[message:new] received:", msg.id, "roomId:", msg.roomId, "current:", roomId);
      if (msg.roomId !== roomId) return;
      setMsgs((prev) => {
        // Deduplicate — the ack callback may have already added this message
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      if (isAtBottomRef.current) {
        requestAnimationFrame(() => {
          if (viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
          }
        });
      }
    };

    socket.on("message:new", onMessage);
    return () => {
      socket.off("message:new", onMessage);
    };
  }, [socket, roomId]);

  // -------------------------------------------------------------------------
  // Scroll tracking + infinite scroll
  // -------------------------------------------------------------------------

  const loadOlder = useCallback(async () => {
    if (!oldestCursor || !hasMore || loadingMore) return;
    const el = viewportRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/rooms/${roomId}/messages?cursor=${oldestCursor}&limit=50`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as MessagesResponse;
      setMsgs((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      setOldestCursor(data.nextCursor);

      // Restore scroll position so the user stays at the same message
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        }
      });
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, oldestCursor, hasMore, loadingMore]);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    if (el.scrollTop < 150 && hasMore && !loadingMore) {
      void loadOlder();
    }
  }, [hasMore, loadingMore, loadOlder]);

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || sending || !socket) return;
    setSending(true);
    setInput("");

    socket.emit("message:send", { roomId, content }, (response) => {
      console.log("[message:send] ack:", response);
      setSending(false);
      if (response.error) {
        toast.error(response.error);
        setInput(content);
      } else if (response.message) {
        // Belt-and-suspenders: add from ack so the sender always sees
        // their own message even if the room broadcast hasn't arrived.
        setMsgs((prev) => {
          if (prev.some((m) => m.id === response.message!.id)) return prev;
          return [...prev, response.message!];
        });
        if (isAtBottomRef.current) {
          requestAnimationFrame(() => {
            if (viewportRef.current) {
              viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
            }
          });
        }
      }
    });
  }, [socket, roomId, input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0 bg-background/80 backdrop-blur-sm">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-[15px]">
          {roomName ?? roomId}
        </span>
      </div>

      {/* Messages viewport */}
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="px-4 py-4 space-y-5">
          {loadingMore && (
            <p className="py-2 text-center text-[12px] text-muted-foreground">
              Loading older messages…
            </p>
          )}
          {isLoading && (
            <p className="py-8 text-center text-[12px] text-muted-foreground">
              Loading…
            </p>
          )}
          {!isLoading && msgs.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No messages yet. Say hello!
            </p>
          )}
          {msgs.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border/60 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            className="min-h-[40px] max-h-32 resize-none flex-1"
            rows={1}
            disabled={sending}
          />
          <Button
            size="icon"
            disabled={!input.trim() || sending}
            onClick={sendMessage}
            className="h-10 w-10 shrink-0"
            title="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
