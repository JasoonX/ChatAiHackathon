"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  Download,
  FileIcon,
  Hash,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Reply,
  Info,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useUnread } from "@/components/unread-provider";
import { useContextPanel } from "@/components/context-panel-context";
import { useSocket } from "@/hooks/use-socket";
import { authClient } from "@/lib/auth-client";
import type { AttachmentPayload, MessagePayload } from "@/lib/socket";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Attachment display (inside message bubble)
// ---------------------------------------------------------------------------

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function AttachmentDisplay({ attachment }: { attachment: AttachmentPayload }) {
  const isImage = attachment.mimeType.startsWith("image/");
  const downloadUrl = `/api/attachments/${attachment.id}`;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (isImage) {
    return (
      <div className="mt-1.5">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block w-fit rounded-md overflow-hidden border border-border/60 hover:border-border transition-colors cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={downloadUrl}
            alt={attachment.originalFilename}
            className="max-h-60 max-w-xs w-auto object-contain"
            loading="lazy"
          />
        </button>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {attachment.originalFilename} · {formatFileSize(attachment.byteSize)}
        </p>
        {lightboxOpen && (
          <ImageLightbox
            src={downloadUrl}
            alt={attachment.originalFilename}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 max-w-xs">
      <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate">
          {attachment.originalFilename}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatFileSize(attachment.byteSize)}
        </p>
      </div>
      <a
        href={downloadUrl}
        download={attachment.originalFilename}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachment preview (before sending)
// ---------------------------------------------------------------------------

function AttachmentPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith("image/");
  const [preview, setPreview] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      {isImage && preview ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="shrink-0 cursor-zoom-in rounded overflow-hidden"
          title="Preview image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={file.name}
            className="h-10 w-10 rounded object-cover"
          />
        </button>
      ) : (
        <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate">{file.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      {lightboxOpen && preview && (
        <ImageLightbox
          src={preview}
          alt={file.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date separator
// ---------------------------------------------------------------------------

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - target.getTime();
  const oneDay = 86_400_000;

  if (diff === 0) return "Today";
  if (diff === oneDay) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 border-t border-border/40" />
      <span className="text-[11px] font-medium text-muted-foreground shrink-0">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  currentUserId,
  isRoomAdminOrOwner,
  grouped = false,
  onReply,
  onEdit,
  onDelete,
}: {
  message: MessagePayload;
  currentUserId: string | undefined;
  isRoomAdminOrOwner: boolean;
  grouped?: boolean;
  onReply: (msg: MessagePayload) => void;
  onEdit: (msg: MessagePayload) => void;
  onDelete: (msg: MessagePayload) => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isDeleted = !!message.deletedAt;
  const isAuthor = currentUserId === message.sender.id;
  const canEdit = isAuthor && !isDeleted;
  const canDelete = (isAuthor || isRoomAdminOrOwner) && !isDeleted;
  const canReply = !isDeleted;
  const showMenu = canEdit || canDelete || canReply;

  if (isDeleted) {
    return (
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
    );
  }

  if (grouped) {
    return (
      <div className="group relative flex items-start">
        <div className="flex-1 min-w-0">
          {message.content && (
            <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
              {message.content}
              <span className="ml-2 text-[10px] text-muted-foreground align-baseline">{time}</span>
            </p>
          )}
          {message.attachments?.map((att) => (
            <AttachmentDisplay key={att.id} attachment={att} />
          ))}
        </div>
        {showMenu && (
          <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
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
                  <DropdownMenuItem onClick={() => onDelete(message)} className="text-destructive focus:text-destructive">
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

  return (
    <div className="group relative flex items-start">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[13px] font-semibold text-foreground">
            {message.sender.name || message.sender.username}
            {isAuthor && (
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">(you)</span>
            )}
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

        {message.content && (
          <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {message.attachments?.map((att) => (
          <AttachmentDisplay key={att.id} attachment={att} />
        ))}
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
  grouped = false,
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
  grouped?: boolean;
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

    return (
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
    );
  }

  return (
    <MessageBubble
      message={message}
      currentUserId={currentUserId}
      isRoomAdminOrOwner={isRoomAdminOrOwner}
      grouped={grouped}
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

type Friend = {
  friendshipId: string;
  userId: string;
  username: string;
  directRoomId: string | null;
};

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const { clearUnread } = useUnread();
  const { open: panelOpen, toggle: togglePanel, available: panelAvailable } = useContextPanel();

  const [msgs, setMsgs] = useState<MessagePayload[]>([]);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const [showNewMsgPill, setShowNewMsgPill] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const initialLoadedRef = useRef(false);
  const pendingScrollRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get room info from sidebar query (reactive)
  const { data: cachedRooms } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms/my");
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json() as Promise<{
        rooms: {
          id: string;
          name: string;
          type: string;
          role: "member" | "admin";
          ownerId?: string | null;
        }[];
      }>;
    },
    staleTime: 30_000,
  });
  const room = cachedRooms?.rooms.find((r) => r.id === roomId);
  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json() as Promise<{ friends: Friend[] }>;
    },
    staleTime: 30_000,
  });
  const friends = friendsData?.friends ?? [];
  const directFriend = friends.find((friend) => friend.directRoomId === roomId);
  const isDirectRoom = room?.type === "direct";
  const canMessageDirect = !isDirectRoom || Boolean(directFriend);
  const roomName =
    isDirectRoom ? directFriend?.username ?? "Direct message" : room?.name;

  // Check if current user is room admin/owner (for delete permissions)
  const isRoomAdminOrOwner = currentUserId
    ? room?.ownerId === currentUserId || room?.role === "admin"
    : false;

  // -------------------------------------------------------------------------
  // Initial fetch
  // -------------------------------------------------------------------------

  const { data: initialData, isLoading, error: messagesError } = useQuery({
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

  // Reset local state when navigating to a different room.
  // Intentionally only depends on roomId so that a socket reconnect does NOT
  // clear messages (which would lose loaded data until the next refetch).
  useEffect(() => {
    setMsgs([]);
    setOldestCursor(null);
    setHasMore(false);
    setEditingId(null);
    setReplyTo(null);
    setShowNewMsgPill(false);
    initialLoadedRef.current = false;
    pendingScrollRef.current = false;
    isAtBottomRef.current = true;
  }, [roomId]);

  // Subscribe the socket to this room's channel.
  // Runs on roomId change AND when socket first connects / reconnects.
  useEffect(() => {
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
    pendingScrollRef.current = true;
  }, [initialData]);

  // Scroll to bottom once messages are actually in the DOM after initial load.
  // useLayoutEffect fires synchronously after DOM mutations and BEFORE the
  // browser paints and before IntersectionObserver callbacks.  This prevents
  // the top-sentinel observer from seeing scrollTop=0 and triggering loadOlder
  // before we've had a chance to jump to the bottom.
  useLayoutEffect(() => {
    if (pendingScrollRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      pendingScrollRef.current = false;
      initialLoadedRef.current = true;
    }
  }, [msgs]);

  useEffect(() => {
    let cancelled = false;

    async function markAsRead() {
      const res = await fetch(`/api/rooms/${roomId}/read`, { method: "POST" });
      if (!res.ok || cancelled) {
        return;
      }
      clearUnread(roomId);
    }

    void markAsRead();

    return () => {
      cancelled = true;
    };
  }, [clearUnread, roomId]);



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
      } else {
        setShowNewMsgPill(true);
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
  // Scroll tracking + infinite scroll (IntersectionObserver)
  // -------------------------------------------------------------------------

  const loadOlderRef = useRef<(() => Promise<void>) | null>(null);

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

  loadOlderRef.current = loadOlder;

  // Top sentinel: triggers loading older messages
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const viewport = viewportRef.current;
    if (!sentinel || !viewport) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void loadOlderRef.current?.();
        }
      },
      { root: viewport, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Bottom sentinel: tracks whether user is at the bottom
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const viewport = viewportRef.current;
    if (!sentinel || !viewport) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const atBottom = entries[0].isIntersecting;
        isAtBottomRef.current = atBottom;
        if (atBottom) {
          setShowNewMsgPill(false);
        }
      },
      { root: viewport, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      setShowNewMsgPill(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || sending || !socket || !canMessageDirect) return;
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
  }, [socket, roomId, input, sending, replyTo, canMessageDirect]);

  // -------------------------------------------------------------------------
  // Upload attachment
  // -------------------------------------------------------------------------

  const uploadFiles = useCallback(async () => {
    if (pendingFiles.length === 0 || uploading || !canMessageDirect) return;
    setUploading(true);

    const formData = new FormData();
    for (const file of pendingFiles) {
      formData.append("files", file);
    }
    const comment = input.trim();
    if (comment) formData.append("comment", comment);

    try {
      const res = await fetch(`/api/rooms/${roomId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Upload failed");
        return;
      }

      // The upload endpoint broadcasts via socket, so the message will
      // appear via the message:new listener. Just clear the input.
      setInput("");
      setPendingFiles([]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }, [pendingFiles, uploading, input, roomId, canMessageDirect]);

  const handleSend = useCallback(() => {
    if (pendingFiles.length > 0) {
      void uploadFiles();
    } else {
      sendMessage();
    }
  }, [pendingFiles, uploadFiles, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      if (pendingFiles.length > 0) {
        setPendingFiles([]);
      } else if (replyTo) {
        setReplyTo(null);
      }
    }
  };

  // -------------------------------------------------------------------------
  // Paste handler (auto-attach images)
  // -------------------------------------------------------------------------

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        setPendingFiles((prev) => [...prev, ...imageFiles]);
      }
    },
    [],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length > 0) {
        setPendingFiles((prev) => [...prev, ...selected]);
      }
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [],
  );

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

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (messagesError) {
    const is403 = messagesError.message === "Not a room member";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Hash className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-[15px] font-medium">
            {is403 ? "Room not found" : "Something went wrong"}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {is403
              ? "This room doesn't exist or you don't have access to it."
              : messagesError.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0 bg-background/80 backdrop-blur-sm">
        <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-semibold text-[15px] flex-1 truncate">
          {roomName ?? roomId}
        </span>
        {panelAvailable && (
          <Button
            variant={panelOpen ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={togglePanel}
            title={panelOpen ? "Hide room info" : "Show room info"}
          >
            <Info className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages viewport */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-y-auto"
      >
        <div className="px-4 py-4">
          {/* Top sentinel for infinite scroll */}
          <div ref={topSentinelRef} className="h-px" />

          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">
                Loading history...
              </span>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">
                Loading...
              </span>
            </div>
          )}

          {!isLoading && msgs.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No messages yet. Say hello!
            </p>
          )}

          {msgs.map((msg, i) => {
            const prevMsg = i > 0 ? msgs[i - 1] : null;
            const msgDate = new Date(msg.createdAt);
            const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;

            const showDateSep =
              !prevDate ||
              msgDate.getFullYear() !== prevDate.getFullYear() ||
              msgDate.getMonth() !== prevDate.getMonth() ||
              msgDate.getDate() !== prevDate.getDate();

            const grouped =
              !showDateSep &&
              !!prevMsg &&
              prevMsg.sender.id === msg.sender.id &&
              !prevMsg.deletedAt &&
              msgDate.getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000;

            return (
              <div key={msg.id} className={grouped ? "mt-0.5" : "mt-3"}>
                {showDateSep && <DateSeparator date={msgDate} />}
                <EditableMessage
                  message={msg}
                  currentUserId={currentUserId}
                  isRoomAdminOrOwner={isRoomAdminOrOwner}
                  editingId={editingId}
                  grouped={grouped}
                  onReply={handleReply}
                  onStartEdit={(m) => {
                    setEditingId(m.id);
                    setReplyTo(null);
                  }}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={handleDelete}
                />
              </div>
            );
          })}

          {/* Bottom sentinel for tracking "at bottom" state */}
          <div ref={bottomSentinelRef} className="h-px" />
        </div>

        {/* "New messages" pill */}
        {showNewMsgPill && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          >
            New messages
            <ArrowDown className="h-3 w-3" />
          </button>
        )}
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

      {/* Attachment previews */}
      {pendingFiles.length > 0 && (
        <div className="px-4 pt-2 shrink-0 flex flex-col gap-1">
          {pendingFiles.map((file, i) => (
            <AttachmentPreview
              key={`${file.name}-${i}`}
              file={file}
              onRemove={() =>
                setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
              }
            />
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border/60 shrink-0">
        {isDirectRoom && !canMessageDirect && (
          <div className="mb-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-muted-foreground">
            You cannot message this user.
          </div>
        )}
        <div className="flex flex-col rounded-md border border-input bg-secondary focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/25 transition-[border-color,box-shadow] duration-[120ms]">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={pendingFiles.length > 0 ? "Add a comment…" : "Message..."}
            className="min-h-[36px] max-h-48 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-0 overflow-y-auto py-2 px-3"
            rows={1}
            disabled={sending || uploading || !canMessageDirect}
          />
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Attach file"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              disabled={
                (!input.trim() && pendingFiles.length === 0) ||
                sending ||
                uploading ||
                !canMessageDirect
              }
              onClick={handleSend}
              className="h-7 w-7"
              title="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for newline · Paste or attach multiple files
        </p>
      </div>
    </div>
  );
}
