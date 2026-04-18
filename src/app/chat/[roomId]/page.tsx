"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Hash,
  MoreHorizontal,
  Pencil,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useSocket } from "@/hooks/use-socket";
import { authClient } from "@/lib/auth-client";
import type { MessagePayload } from "@/lib/socket";

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  currentUserId,
  isRoomAdminOrOwner,
  onReply,
  onEdit,
  onDelete,
}: {
  message: MessagePayload;
  currentUserId: string | undefined;
  isRoomAdminOrOwner: boolean;
  onReply: (msg: MessagePayload) => void;
  onEdit: (msg: MessagePayload) => void;
  onDelete: (msg: MessagePayload) => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const initials = (message.sender.name || message.sender.username)
    .slice(0, 2)
    .toUpperCase();

  const isDeleted = !!message.deletedAt;
  const isAuthor = currentUserId === message.sender.id;
  const canEdit = isAuthor && !isDeleted;
  const canDelete = (isAuthor || isRoomAdminOrOwner) && !isDeleted;
  const canReply = !isDeleted;
  const showMenu = canEdit || canDelete || canReply;

  if (isDeleted) {
    return (
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[13px] font-semibold text-foreground">
              {message.sender.name || message.sender.username}
            </span>
            <span className="text-[11px] text-muted-foreground">{time}</span>
          </div>
          <p className="text-[13px] italic text-muted-foreground">
            This message was deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex items-start gap-3">
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
          {message.editedAt && (
            <span className="text-[11px] text-muted-foreground">(edited)</span>
          )}
        </div>

        {message.replyTo && (
          <div className="mb-1.5 flex items-center gap-1.5 pl-3 border-l-2 border-muted-foreground/30 text-[12px] text-muted-foreground max-w-md">
            <span className="font-medium shrink-0">
              {message.replyTo.sender.username}:
            </span>
            <span className="truncate">
              {message.replyTo.content ?? "Original message deleted"}
            </span>
          </div>
        )}

        <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
          {message.content ?? ""}
        </p>
      </div>

      {showMenu && (
        <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {canReply && (
                <DropdownMenuItem onClick={() => onReply(message)}>
                  <Reply className="mr-2 h-4 w-4" />
                  Reply
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(message)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(message)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline edit form
// ---------------------------------------------------------------------------

function InlineEditForm({
  message,
  onSave,
  onCancel,
}: {
  message: MessagePayload;
  onSave: (messageId: string, content: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(message.content ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    // Move cursor to end
    const len = textareaRef.current?.value.length ?? 0;
    textareaRef.current?.setSelectionRange(len, len);
  }, []);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === (message.content ?? "").trim()) {
      onCancel();
      return;
    }
    setSaving(true);
    await onSave(message.id, trimmed);
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="min-h-[40px] max-h-32 resize-none text-[13px]"
        rows={1}
        disabled={saving}
      />
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px] text-muted-foreground">
          Escape to cancel · Enter to save
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 text-[11px] px-2"
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => void handleSave()}
          className="h-6 text-[11px] px-2"
          disabled={saving || !value.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable message wrapper
// ---------------------------------------------------------------------------

function EditableMessage({
  message,
  currentUserId,
  isRoomAdminOrOwner,
  editingId,
  onReply,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  message: MessagePayload;
  currentUserId: string | undefined;
  isRoomAdminOrOwner: boolean;
  editingId: string | null;
  onReply: (msg: MessagePayload) => void;
  onStartEdit: (msg: MessagePayload) => void;
  onSaveEdit: (messageId: string, content: string) => void;
  onCancelEdit: () => void;
  onDelete: (msg: MessagePayload) => void;
}) {
  if (editingId === message.id) {
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
            <AvatarImage
              src={message.sender.image}
              alt={message.sender.name}
            />
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
          <InlineEditForm
            message={message}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        </div>
      </div>
    );
  }

  return (
    <MessageBubble
      message={message}
      currentUserId={currentUserId}
      isRoomAdminOrOwner={isRoomAdminOrOwner}
      onReply={onReply}
      onEdit={onStartEdit}
      onDelete={onDelete}
    />
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
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;

  const [msgs, setMsgs] = useState<MessagePayload[]>([]);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const initialLoadedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get room info from sidebar query (reactive)
  const { data: cachedRooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms/my");
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json() as Promise<{
        rooms: { id: string; name: string; type: string; role: string; ownerId?: string | null }[];
      }>;
    },
    staleTime: 30_000,
  });
  const room = cachedRooms?.rooms.find((r) => r.id === roomId);
  const roomName = room?.name;

  // Check if current user is room admin/owner (for delete permissions)
  const isRoomAdminOrOwner = currentUserId
    ? room?.ownerId === currentUserId
    : false;

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
    setEditingId(null);
    setReplyTo(null);
    initialLoadedRef.current = false;
    isAtBottomRef.current = true;

    if (!socket) return;
    socket.emit("room:subscribe", roomId);
  }, [roomId, socket]);

  // Populate messages from initial fetch
  useEffect(() => {
    if (!initialData) return;
    setMsgs(initialData.messages);
    setHasMore(initialData.hasMore);
    setOldestCursor(initialData.nextCursor);
    initialLoadedRef.current = false;
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
      if (msg.roomId !== roomId) return;
      setMsgs((prev) => {
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

    const onUpdated = (msg: MessagePayload) => {
      if (msg.roomId !== roomId) return;
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, content: msg.content, editedAt: msg.editedAt }
            : m,
        ),
      );
    };

    const onDeleted = ({
      id,
      roomId: deletedRoomId,
      deletedAt,
    }: {
      id: string;
      roomId: string;
      deletedAt: string;
    }) => {
      if (deletedRoomId !== roomId) return;
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, deletedAt, content: null } : m,
        ),
      );
    };

    socket.on("message:new", onMessage);
    socket.on("message:updated", onUpdated);
    socket.on("message:deleted", onDeleted);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("message:updated", onUpdated);
      socket.off("message:deleted", onDeleted);
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

    const replyToMessageId = replyTo?.id;
    // Capture reply preview client-side so the sender always sees it,
    // even if the server doesn't populate it (e.g. stale server.ts).
    const clientReplyPreview = replyTo
      ? {
          id: replyTo.id,
          content: replyTo.content,
          sender: { username: replyTo.sender.username },
        }
      : null;
    setReplyTo(null);

    socket.emit(
      "message:send",
      { roomId, content, replyToMessageId },
      (response) => {
        setSending(false);
        if (response.error) {
          toast.error(response.error);
          setInput(content);
        } else if (response.message) {
          const msg = response.message;
          // Attach client-side reply preview if server didn't provide it
          if (!msg.replyTo && clientReplyPreview) {
            msg.replyTo = clientReplyPreview;
          }
          setMsgs((prev) => {
            const existing = prev.find((m) => m.id === msg.id);
            if (existing) {
              // Broadcast may have arrived first without replyTo — patch it
              if (!existing.replyTo && msg.replyTo) {
                return prev.map((m) =>
                  m.id === msg.id ? { ...m, replyTo: msg.replyTo } : m,
                );
              }
              return prev;
            }
            return [...prev, msg];
          });
          if (isAtBottomRef.current) {
            requestAnimationFrame(() => {
              if (viewportRef.current) {
                viewportRef.current.scrollTop =
                  viewportRef.current.scrollHeight;
              }
            });
          }
        }
      },
    );
  }, [socket, roomId, input, sending, replyTo]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Escape" && replyTo) {
      setReplyTo(null);
    }
  };

  // -------------------------------------------------------------------------
  // Edit message
  // -------------------------------------------------------------------------

  const handleSaveEdit = useCallback(
    async (messageId: string, content: string) => {
      try {
        const res = await fetch(`/api/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          toast.error(data.error ?? "Failed to edit message");
          return;
        }
        const updated = (await res.json()) as MessagePayload;
        setMsgs((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: updated.content, editedAt: updated.editedAt }
              : m,
          ),
        );
      } catch {
        toast.error("Failed to edit message");
      } finally {
        setEditingId(null);
      }
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Delete message
  // -------------------------------------------------------------------------

  const handleDelete = useCallback(async (msg: MessagePayload) => {
    try {
      const res = await fetch(`/api/messages/${msg.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to delete message");
        return;
      }
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, deletedAt: new Date().toISOString(), content: null }
            : m,
        ),
      );
    } catch {
      toast.error("Failed to delete message");
    }
  }, []);

  // -------------------------------------------------------------------------
  // Reply
  // -------------------------------------------------------------------------

  const handleReply = useCallback((msg: MessagePayload) => {
    setReplyTo(msg);
    setEditingId(null);
    // Focus the input
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

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
              Loading older messages...
            </p>
          )}
          {isLoading && (
            <p className="py-8 text-center text-[12px] text-muted-foreground">
              Loading...
            </p>
          )}
          {!isLoading && msgs.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No messages yet. Say hello!
            </p>
          )}
          {msgs.map((msg) => (
            <EditableMessage
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              isRoomAdminOrOwner={isRoomAdminOrOwner}
              editingId={editingId}
              onReply={handleReply}
              onStartEdit={(m) => {
                setEditingId(m.id);
                setReplyTo(null);
              }}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditingId(null)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {/* Reply bar */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border/60 shrink-0 flex items-center gap-2 bg-card">
          <Reply className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0 text-[12px] text-muted-foreground truncate">
            Replying to{" "}
            <span className="font-medium text-foreground">
              {replyTo.sender.username}
            </span>
            {replyTo.content && (
              <>
                :{" "}
                <span className="truncate">{replyTo.content}</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setReplyTo(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border/60 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
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
