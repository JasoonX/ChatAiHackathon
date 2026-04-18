"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Globe,
  Hash,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Smartphone,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { useActivityHeartbeat } from "@/hooks/use-activity";
import { useSocket } from "@/hooks/use-socket";
import { authClient } from "@/lib/auth-client";
import { getCachedPresence, disconnectSocket } from "@/lib/socket-client";
import { useUnread } from "@/components/unread-provider";
import { ContextPanelContext } from "@/components/context-panel-context";
import type { InvitationPayload } from "@/lib/socket";
import type { PresenceSnapshot, PresenceStatus } from "@/lib/socket";
import { RoomManagementModal } from "@/components/room-management-modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LogoutButton } from "@/components/logout-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Presence = "online" | "afk" | "offline";

type MyRoom = {
  id: string;
  name: string;
  type: "public" | "private" | "direct";
  role: "member" | "admin";
  ownerId?: string | null;
  description?: string | null;
};

type PublicRoom = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
};

type Friend = {
  friendshipId: string;
  userId: string;
  username: string;
  name: string;
  image: string | null;
  directRoomId: string | null;
  presence: Presence;
  unreadCount: number;
};

type FriendRequest = {
  id: string;
  requesterUserId: string;
  requesterUsername: string;
  requesterName: string;
  requesterImage: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["public", "private"]),
});

type CreateRoomForm = z.infer<typeof createRoomSchema>;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------------------
// Placeholder data
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Presence dot
// ---------------------------------------------------------------------------

function PresenceDot({ status }: { status: Presence }) {
  const color = {
    online: "bg-success",
    afk: "bg-warning",
    offline: "bg-muted-foreground/40",
  }[status];

  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
      title={status}
    />
  );
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function SidebarSection({
  title,
  defaultOpen = true,
  action,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center gap-1 pl-3 pr-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {title}
        </button>
        {action}
      </div>
      {open && <div className="space-y-0.5 px-1">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar room item
// ---------------------------------------------------------------------------

function RoomItem({
  id,
  name,
  isPrivate,
  unread = 0,
  isActive = false,
  action,
}: {
  id: string;
  name: string;
  isPrivate?: boolean;
  unread?: number;
  isActive?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`group/room flex w-full items-center rounded-md text-[13px] transition-colors ${
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Link
        href={`/chat/${id}`}
        className="flex flex-1 items-center gap-2 min-w-0 px-2 py-1.5"
      >
        {isPrivate ? (
          <Lock className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Hash className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{name}</span>
      </Link>
      {unread > 0 && (
        <Badge variant="default" className="text-[10px] px-1.5 py-0 mr-1">
          {unread}
        </Badge>
      )}
      {action && (
        <div className="flex items-center opacity-0 group-hover/room:opacity-100 transition-opacity shrink-0 pr-1">
          {action}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar contact item
// ---------------------------------------------------------------------------

function ContactItem({
  href,
  name,
  presence,
  unread,
  isActive = false,
  action,
}: {
  href: string;
  name: string;
  presence: Presence;
  unread: number;
  isActive?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`group/contact flex w-full items-center rounded-md text-[13px] transition-colors ${isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
    >
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5"
      >
        <PresenceDot status={presence} />
        <span className="truncate">{name}</span>
      </Link>
      {unread > 0 && (
        <Badge variant="default" className="text-[10px] px-1.5 py-0 mr-1">
          {unread}
        </Badge>
      )}
      {action && (
        <div className="shrink-0 opacity-0 transition-opacity group-hover/contact:opacity-100 pr-1">
          {action}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Member item (right panel)
// ---------------------------------------------------------------------------

function MemberItem({
  userId,
  name,
  role,
  presence,
  canShowActions = false,
  isFriend = false,
  isCurrentUser = false,
  onAddFriend,
  onRemoveFriend,
  onBanUser,
}: {
  userId: string;
  name: string;
  role: "owner" | "admin" | "member";
  presence: Presence;
  canShowActions?: boolean;
  isFriend?: boolean;
  isCurrentUser?: boolean;
  onAddFriend?: (userId: string) => void;
  onRemoveFriend?: (userId: string) => void;
  onBanUser?: (userId: string) => void;
}) {
  const roleVariant =
    role === "owner"
      ? "warning"
      : role === "admin"
        ? "info"
        : ("secondary" as const);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Avatar className="h-7 w-7">
        <AvatarFallback className="text-[11px]">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 truncate text-[13px]">
        {name}
        {isCurrentUser && (
          <span className="ml-1 text-[11px] text-muted-foreground">(you)</span>
        )}
      </span>
      {role !== "member" && (
        <Badge variant={roleVariant} className="text-[10px] px-1.5 py-0">
          {role}
        </Badge>
      )}
      <PresenceDot status={presence} />
      {canShowActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {isFriend ? (
              <DropdownMenuItem onClick={() => onRemoveFriend?.(userId)}>
                <UserMinus className="h-4 w-4" />
                Remove friend
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onAddFriend?.(userId)}>
                <UserPlus className="h-4 w-4" />
                Add friend
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onBanUser?.(userId)}
            >
              <UserX className="h-4 w-4" />
              Ban user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Room Dialog
// ---------------------------------------------------------------------------

function CreateRoomDialog({
  onSuccess,
  trigger = "button",
  defaultType = "public",
}: {
  onSuccess: () => void;
  trigger?: "button" | "icon";
  defaultType?: "public" | "private";
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateRoomForm>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { name: "", description: "", type: defaultType },
  });

  const onSubmit = async (data: CreateRoomForm) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: unknown };
        if (res.status === 409) {
          form.setError("name", { message: "Room name already taken" });
          return;
        }
        toast.error(
          typeof err.error === "string" ? err.error : "Failed to create room",
        );
        return;
      }

      toast.success("Room created!");
      form.reset();
      setOpen(false);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "icon" ? (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Create room"
          >
            <Plus className="h-3 w-3" />
          </button>
        ) : (
          <Button variant="secondary" size="sm" className="w-full gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Create room
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Room</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. general" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <div className="flex gap-4">
                      {(["public", "private"] as const).map((t) => (
                        <label
                          key={t}
                          className="flex items-center gap-2 cursor-pointer text-[13px]"
                        >
                          <input
                            type="radio"
                            value={t}
                            checked={field.value === t}
                            onChange={() => field.onChange(t)}
                            className="accent-primary"
                          />
                          {t === "public" ? (
                            <span className="flex items-center gap-1">
                              <Globe className="h-3.5 w-3.5" /> Public
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3.5 w-3.5" /> Private
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Browse Public Rooms Dialog
// ---------------------------------------------------------------------------

function BrowseRoomsDialog({
  onJoined,
  trigger = "inline",
}: {
  onJoined: () => void;
  trigger?: "inline" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["public-rooms", deferredSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "30" });
      if (deferredSearch) params.set("search", deferredSearch);
      const res = await fetch(`/api/rooms/public?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json() as Promise<{
        rooms: PublicRoom[];
        nextCursor: string | null;
      }>;
    },
    enabled: open,
    staleTime: 10_000,
  });

  const [joiningId, setJoiningId] = useState<string | null>(null);

  const join = async (roomId: string) => {
    setJoiningId(roomId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        toast.error(err.error ?? "Failed to join room");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      toast.success("Joined!");
      setOpen(false);
      onJoined();
      router.push(`/chat/${roomId}`);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "icon" ? (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Browse public rooms"
          >
            <Search className="h-3 w-3" />
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>Browse rooms</span>
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Public Rooms</DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rooms…"
            className="h-8 pl-8 text-[13px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="h-80">
          {isLoading && (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Loading…
            </p>
          )}
          {!isLoading && data?.rooms.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No rooms found
            </p>
          )}
          <div className="space-y-2 pr-2">
            {data?.rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center gap-3 rounded-md border bg-card p-3"
              >
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">
                    {room.name}
                  </p>
                  {room.description && (
                    <p className="text-[12px] text-muted-foreground truncate">
                      {room.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {room.memberCount} member{room.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-[12px] shrink-0"
                  disabled={joiningId === room.id}
                  onClick={() => join(room.id)}
                >
                  {joiningId === room.id ? "Joining…" : "Join"}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Invitation types
// ---------------------------------------------------------------------------

type Invitation = {
  id: string;
  roomId: string;
  roomName: string;
  inviterUsername: string;
  createdAt: string;
};

function AddFriendDialog({
  onSuccess,
  trigger = "button",
}: {
  onSuccess?: () => void;
  trigger?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setError(err.error ?? "Failed to send friend request");
        return;
      }

      toast.success(`Friend request sent to ${username.trim()}`);
      setUsername("");
      setOpen(false);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "icon" ? (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Add friend"
          >
            <Plus className="h-3 w-3" />
          </button>
        ) : (
          <Button variant="secondary" size="sm" className="w-full gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Add friend
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="friend-username"
              className="text-[13px] font-medium"
            >
              Username
            </label>
            <Input
              id="friend-username"
              placeholder="Enter username…"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
            />
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !username.trim()}
            >
              {submitting ? "Sending…" : "Send request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Invitation bell (top nav)
// ---------------------------------------------------------------------------

function InvitationBell({
  socket,
}: {
  socket: ReturnType<typeof useSocket>["socket"];
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const res = await fetch("/api/invitations");
      if (!res.ok) throw new Error("Failed to fetch invitations");
      return res.json() as Promise<{ invitations: Invitation[] }>;
    },
    staleTime: 30_000,
  });

  // Listen for real-time invitation events
  useEffect(() => {
    if (!socket) return;
    const handler = (_payload: InvitationPayload) => {
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    };
    socket.on("invitation:received", handler);
    return () => {
      socket.off("invitation:received", handler);
    };
  }, [socket, queryClient]);

  const invitations = data?.invitations ?? [];

  const respond = useMutation({
    mutationFn: async ({
      invitationId,
      action,
    }: {
      invitationId: string;
      action: "accept" | "reject";
    }) => {
      const res = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error ?? "Failed to respond");
      }
      return { invitationId, action };
    },
    onSuccess: ({ action }, { invitationId }) => {
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      if (action === "accept") {
        const inv = invitations.find((i) => i.id === invitationId);
        toast.success(`Joined ${inv?.roomName ?? "room"}!`);
        if (inv) {
          socket?.emit("room:subscribe", inv.roomId);
          router.push(`/chat/${inv.roomId}`);
        }
        setOpen(false);
      } else {
        toast.success("Invitation declined");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Invitations</span>
          {invitations.length > 0 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              {invitations.length}
            </Badge>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitations</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          {invitations.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No pending invitations
            </p>
          ) : (
            <div className="space-y-2 pr-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 rounded-md border bg-card p-3"
                >
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">
                      {inv.roomName}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Invited by {inv.inviterUsername}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      className="text-[12px] h-7 px-2"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({
                          invitationId: inv.id,
                          action: "accept",
                        })
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[12px] h-7 px-2"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({
                          invitationId: inv.id,
                          action: "reject",
                        })
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function FriendRequestsBell({
  socket,
}: {
  socket: ReturnType<typeof useSocket>["socket"];
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["friend-requests"],
    queryFn: async () => {
      const res = await fetch("/api/friends/requests");
      if (!res.ok) throw new Error("Failed to fetch friend requests");
      return res.json() as Promise<{ requests: FriendRequest[] }>;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!socket) {
      return;
    }

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
    };

    socket.on("friend:request-received", invalidate);
    socket.on("friend:accepted", invalidate);
    socket.on("user:banned", invalidate);

    return () => {
      socket.off("friend:request-received", invalidate);
      socket.off("friend:accepted", invalidate);
      socket.off("user:banned", invalidate);
    };
  }, [queryClient, socket]);

  const requests = data?.requests ?? [];

  const respond = useMutation({
    mutationFn: async ({
      requestId,
      action,
    }: {
      requestId: string;
      action: "accept" | "reject";
    }) => {
      const res = await fetch(`/api/friends/request/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to respond");
      }
      return (await res.json()) as { directRoomId?: string };
    },
    onSuccess: (payload, { action }) => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      if (action === "accept") {
        toast.success("Friend request accepted");
        if (payload.directRoomId) {
          router.push(`/chat/${payload.directRoomId}`);
        }
        setOpen(false);
      } else {
        toast.success("Friend request rejected");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Friend requests</span>
          {requests.length > 0 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              {requests.length}
            </Badge>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Friend Requests</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          {requests.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No pending friend requests
            </p>
          ) : (
            <div className="space-y-2 pr-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-3 rounded-md border bg-card p-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-[11px]">
                      {request.requesterUsername.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">
                      {request.requesterUsername}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      {request.requesterName}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="h-7 px-2 text-[12px]"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({
                          requestId: request.id,
                          action: "accept",
                        })
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[12px]"
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({
                          requestId: request.id,
                          action: "reject",
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const onSubmit = async (values: ChangePasswordForm) => {
    setSubmitting(true);
    form.clearErrors("root");

    try {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: false,
      });

      if (error) {
        form.setError("root", {
          message: error.message || "Failed to change password",
        });
        return;
      }

      toast.success("Password changed");
      form.reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          form.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="current-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="new-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmNewPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="new-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Saving…" : "Change password"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [confirmValue, setConfirmValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canDelete = confirmValue === "DELETE";

  const handleDelete = async () => {
    if (!canDelete) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(payload?.error ?? "Failed to delete account");
        return;
      }

      toast.success("Account deleted");
      onOpenChange(false);
      router.replace("/login");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setConfirmValue("");
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete your account, all rooms you own, and
            all messages in those rooms. This cannot be undone.
          </p>

          <div className="space-y-2">
            <label
              htmlFor="delete-account-confirm"
              className="text-sm font-medium"
            >
              Type DELETE to confirm
            </label>
            <Input
              id="delete-account-confirm"
              value={confirmValue}
              onChange={(event) => setConfirmValue(event.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={!canDelete || submitting}
            >
              {submitting ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sessions dialog
// ---------------------------------------------------------------------------

type SessionInfo = {
  id: string;
  ipAddress: string | null;
  browser: string;
  os: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
};

function DeviceIcon({ os }: { os: string }) {
  if (os === "Android" || os === "iOS") {
    return <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function SessionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json() as Promise<{ sessions: SessionInfo[] }>;
    },
    enabled: open,
    staleTime: 0,
  });

  const handleRevoke = async (sessionId: string) => {
    setRevoking(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to revoke session");
        return;
      }
      toast.success("Session revoked");
      setConfirmRevokeId(null);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } finally {
      setRevoking(false);
    }
  };

  const sessions = data?.sessions ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Active Sessions</DialogTitle>
          </DialogHeader>

          {isLoading && (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Loading…
            </p>
          )}
          {error && (
            <p className="py-8 text-center text-[13px] text-destructive">
              Failed to load sessions
            </p>
          )}

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border bg-card p-3"
                >
                  <DeviceIcon os={s.os} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">
                        {s.browser} on {s.os}
                      </span>
                      {s.isCurrent && (
                        <Badge
                          variant="default"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {s.ipAddress ?? "Unknown IP"} · Last active{" "}
                      {formatRelativeTime(s.lastActiveAt)}
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-[12px] h-7 px-2 shrink-0"
                      onClick={() => setConfirmRevokeId(s.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmRevokeId !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmRevokeId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke session?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            This will immediately log out the device using that session.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRevokeId(null)}
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={revoking}
              onClick={() => {
                if (confirmRevokeId) void handleRevoke(confirmRevokeId);
              }}
            >
              {revoking ? "Revoking…" : "Revoke"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileMenu({ iconOnly = false }: { iconOnly?: boolean }) {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {iconOnly ? (
            <button
              type="button"
              title="Profile settings"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <User className="h-3.5 w-3.5 shrink-0" />
            <span>Profile</span>
          </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-52">
          <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSessionsOpen(true)}>
            <Laptop className="h-4 w-4" />
            Active sessions
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive data-[highlighted]:text-destructive"
            onClick={() => setDeleteAccountOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      <DeleteAccountDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />
      <SessionsDialog open={sessionsOpen} onOpenChange={setSessionsOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Invite user dialog (context panel for private rooms)
// ---------------------------------------------------------------------------

function InviteUserDialog({
  roomId,
  trigger = "button",
}: {
  roomId: string;
  trigger?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        setError(err.error ?? "Failed to invite");
        return;
      }
      toast.success(`Invitation sent to ${username.trim()}`);
      setUsername("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "icon" ? (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Invite user to room"
          >
            <UserPlus className="h-3 w-3" />
          </button>
        ) : (
          <Button variant="secondary" size="sm" className="w-full text-[13px]">
            Invite user
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="invite-username"
              className="text-[13px] font-medium"
            >
              Username
            </label>
            <Input
              id="invite-username"
              placeholder="Enter username…"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
            />
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !username.trim()}
            >
              {submitting ? "Sending…" : "Send Invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Top nav
// ---------------------------------------------------------------------------

function TopNav({
  socket,
}: {
  socket: ReturnType<typeof useSocket>["socket"];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/80 backdrop-blur-[12px] px-4 gap-4">
      <Link href="/chat" className="flex items-center gap-2 shrink-0">
        <MessageSquare className="h-5 w-5 text-primary" />
        <span className="text-base font-semibold tracking-tight">Chatty</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <FriendRequestsBell socket={socket} />
        <InvitationBell socket={socket} />
        <ProfileMenu />
        <LogoutButton />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Left sidebar
// ---------------------------------------------------------------------------

function RoomsSidebar({
  myRooms,
  socket,
}: {
  myRooms: MyRoom[];
  socket: ReturnType<typeof useSocket>["socket"];
}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { getUnreadCount } = useUnread();
  const { data: session } = authClient.useSession();
  const currentUsername = session?.user?.name ?? "";
  const currentEmail = session?.user?.email ?? "";
  const activeRoomId = pathname.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const [presence, setPresence] = useState<PresenceSnapshot>(() =>
    getCachedPresence(),
  );

  const publicRooms = myRooms.filter((r) => r.type === "public");
  const privateRooms = myRooms.filter((r) => r.type === "private");

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
  const removeFriendMutation = useMutation({
    mutationFn: async ({
      friendshipId,
      username,
    }: {
      friendshipId: string;
      username: string;
    }) => {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? "Failed to remove friend");
      }

      return { username };
    },
    onSuccess: async ({ username }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["my-rooms"] }),
      ]);
      toast.success(`${username} was removed from friends`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async ({
      userId,
      username,
    }: {
      userId: string;
      username: string;
    }) => {
      const res = await fetch(`/api/users/${userId}/ban`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to ban user");
      }
      return { username };
    },
    onSuccess: async ({ username }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["my-rooms"] }),
      ]);
      toast.success(`${username} was banned`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const invalidateRooms = () =>
    queryClient.invalidateQueries({ queryKey: ["my-rooms"] });

  useEffect(() => {
    if (!socket) {
      return;
    }

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
    };

    const handleSnapshot = (snapshot: PresenceSnapshot) =>
      setPresence(snapshot);
    const handleUpdate = ({
      userId,
      status,
    }: {
      userId: string;
      status: PresenceStatus;
    }) => {
      setPresence((prev) => ({ ...prev, [userId]: status }));
    };

    socket.on("friend:request-received", invalidate);
    socket.on("friend:accepted", invalidate);
    socket.on("user:banned", invalidate);
    socket.on("presence:snapshot", handleSnapshot);
    socket.on("presence:update", handleUpdate);
    // Sync with cache in case the snapshot arrived before this effect ran.
    setPresence(getCachedPresence());

    return () => {
      socket.off("friend:request-received", invalidate);
      socket.off("friend:accepted", invalidate);
      socket.off("user:banned", invalidate);
      socket.off("presence:snapshot", handleSnapshot);
      socket.off("presence:update", handleUpdate);
    };
  }, [queryClient, socket]);

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-tight">Chatty</span>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="py-2 space-y-3">
          <SidebarSection
            title="Public Rooms"
            action={
              <CreateRoomDialog onSuccess={invalidateRooms} trigger="icon" />
            }
          >
            {publicRooms.length === 0 ? (
              <p className="px-2 py-1 text-[12px] text-muted-foreground">
                No rooms yet
              </p>
            ) : (
              publicRooms.map((room) => (
                <RoomItem
                  key={room.id}
                  id={room.id}
                  name={room.name}
                  unread={getUnreadCount(room.id)}
                  isActive={activeRoomId === room.id}
                />
              ))
            )}
            <BrowseRoomsDialog onJoined={invalidateRooms} />
          </SidebarSection>

          <SidebarSection
            title="Private Rooms"
            action={<CreateRoomDialog onSuccess={invalidateRooms} trigger="icon" defaultType="private" />}
          >
            {privateRooms.length === 0 ? (
              <p className="px-2 py-1 text-[12px] text-muted-foreground">
                No rooms yet
              </p>
            ) : (
              privateRooms.map((room) => (
                <RoomItem
                  key={room.id}
                  id={room.id}
                  name={room.name}
                  isPrivate
                  unread={getUnreadCount(room.id)}
                  isActive={activeRoomId === room.id}
                  action={<InviteUserDialog roomId={room.id} trigger="icon" />}
                />
              ))
            )}
          </SidebarSection>

          <Separator />

          <SidebarSection
            title="Contacts"
            action={
              <AddFriendDialog
                trigger="icon"
                onSuccess={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ["friend-requests"],
                  });
                }}
              />
            }
          >
            {friends.length === 0 ? (
              <p className="px-2 py-1 text-[12px] text-muted-foreground">
                No friends yet
              </p>
            ) : (
              friends.map((friend) => (
                <ContactItem
                  key={friend.friendshipId}
                  href={
                    friend.directRoomId
                      ? `/chat/${friend.directRoomId}`
                      : "/chat"
                  }
                  name={friend.username}
                  presence={presence[friend.userId] ?? friend.presence}
                  isActive={
                    !!friend.directRoomId &&
                    activeRoomId === friend.directRoomId
                  }
                  unread={
                    getUnreadCount(friend.directRoomId) || friend.unreadCount
                  }
                  action={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() =>
                            removeFriendMutation.mutate({
                              friendshipId: friend.friendshipId,
                              username: friend.username,
                            })
                          }
                        >
                          <UserMinus className="h-4 w-4" />
                          Remove friend
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            banUserMutation.mutate({
                              userId: friend.userId,
                              username: friend.username,
                            })
                          }
                        >
                          <UserX className="h-4 w-4" />
                          Ban user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              ))
            )}
          </SidebarSection>
        </div>
      </ScrollArea>

      <Separator />
      <div className="py-2 px-1 space-y-0.5">
        <FriendRequestsBell socket={socket} />
        <InvitationBell socket={socket} />
        <Separator className="my-1 -mx-1 w-auto" />
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12px] font-semibold text-primary">
            {(currentUsername || currentEmail).slice(0, 1).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            {currentUsername && (
              <span className="truncate text-[13px] font-medium leading-tight">{currentUsername}</span>
            )}
            {currentEmail && (
              <span className="truncate text-[11px] text-muted-foreground leading-tight">{currentEmail}</span>
            )}
          </div>
          <ProfileMenu iconOnly />
          <LogoutButton iconOnly />
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Right panel (room info + members)
// ---------------------------------------------------------------------------

function ContextPanel({
  activeRoomId,
  myRooms,
  socket,
  onCollapse,
}: {
  activeRoomId: string | null;
  myRooms: MyRoom[];
  socket: ReturnType<typeof useSocket>["socket"];
  onCollapse: () => void;
}) {
  const queryClient = useQueryClient();
  const activeRoom = myRooms.find((r) => r.id === activeRoomId);
  const [presence, setPresence] = useState<PresenceSnapshot>(() =>
    getCachedPresence(),
  );
  const { data: session } = authClient.useSession();

  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json() as Promise<{ friends: Friend[] }>;
    },
    staleTime: 30_000,
  });
  const friendUserIds = new Set((friendsData?.friends ?? []).map((f) => f.userId));

  const { data: roomData, isLoading } = useQuery({
    queryKey: ["room-management", activeRoomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${activeRoomId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch room");
      }
      return res.json() as Promise<{
        room: {
          id: string;
          name: string;
          description: string | null;
          type: "public" | "private" | "direct";
          ownerId: string | null;
          canManageMembers: boolean;
          canDeleteRoom: boolean;
        };
        members: Array<{
          userId: string;
          username: string;
          role: "member" | "admin";
          isOwner: boolean;
        }>;
      }>;
    },
    enabled: !!activeRoomId,
    staleTime: 0,
  });

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleSnapshot = (snapshot: PresenceSnapshot) =>
      setPresence(snapshot);
    const handleUpdate = ({
      userId,
      status,
    }: {
      userId: string;
      status: PresenceStatus;
    }) => {
      setPresence((current) => ({ ...current, [userId]: status }));
    };

    socket.on("presence:snapshot", handleSnapshot);
    socket.on("presence:update", handleUpdate);
    // Sync with cache in case the snapshot arrived before this effect ran.
    setPresence(getCachedPresence());

    return () => {
      socket.off("presence:snapshot", handleSnapshot);
      socket.off("presence:update", handleUpdate);
    };
  }, [socket]);

  const runMemberAction = useCallback(
    async ({
      url,
      method = "POST",
      body,
      successMessage,
    }: {
      url: string;
      method?: "POST" | "DELETE";
      body?: unknown;
      successMessage: string;
    }) => {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(error?.error ?? "Request failed");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["friend-requests"] }),
        queryClient.invalidateQueries({
          queryKey: ["room-management", activeRoomId],
        }),
      ]);

      toast.success(successMessage);
    },
    [activeRoomId, queryClient],
  );

  const activeMembers =
    roomData?.members.map((member) => ({
      userId: member.userId,
      username: member.username,
      role: (member.isOwner ? "owner" : member.role) as
        | "owner"
        | "admin"
        | "member",
      presence: presence[member.userId] ?? "offline",
    })) ?? [];

  const canOpenManageRoom = Boolean(
    activeRoomId &&
    activeRoom?.type !== "direct" &&
    (roomData?.room.canManageMembers || roomData?.room.canDeleteRoom),
  );

  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-l bg-card">
      <div className="p-4 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold">Room info</h3>
          {canOpenManageRoom && activeRoomId && (
            <RoomManagementModal
              roomId={activeRoomId}
              onDeleted={() => {
                if (session?.user?.id) {
                  void queryClient.invalidateQueries({
                    queryKey: ["my-rooms"],
                  });
                }
              }}
              trigger={
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                  title="Manage room"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              }
            />
          )}
        </div>
        <p className="text-[12px] text-muted-foreground">
          {roomData?.room.type === "private"
            ? "Private room"
            : roomData?.room.type === "direct"
              ? "Direct message"
              : "Public room"}
        </p>
        {roomData?.room.description && (
          <p className="text-[12px] text-muted-foreground">
            {roomData.room.description}
          </p>
        )}
      </div>

      <Separator />

      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Members ({activeMembers.length})
        </span>
        {activeRoom?.type === "private" && activeRoomId && (
          <InviteUserDialog roomId={activeRoomId} trigger="icon" />
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {!activeRoomId ? (
            <p className="px-4 py-6 text-[12px] text-muted-foreground">
              Select a room to see members
            </p>
          ) : isLoading ? (
            <p className="px-4 py-6 text-[12px] text-muted-foreground">
              Loading members…
            </p>
          ) : (
            activeMembers.map((member) => (
              <MemberItem
                key={`${member.role}:${member.userId}`}
                userId={member.userId}
                name={member.username}
                role={member.role}
                presence={member.presence}
                isCurrentUser={session?.user?.id === member.userId}
                canShowActions={session?.user?.id !== member.userId}
                isFriend={friendUserIds.has(member.userId)}
                onAddFriend={() => {
                  void runMemberAction({
                    url: "/api/friends/request",
                    body: { username: member.username },
                    successMessage: `Friend request sent to ${member.username}`,
                  }).catch((error: Error) => {
                    toast.error(error.message);
                  });
                }}
                onRemoveFriend={() => {
                  const friend = friendsData?.friends.find((f) => f.userId === member.userId);
                  if (!friend) return;
                  void runMemberAction({
                    url: `/api/friends/${friend.friendshipId}`,
                    method: "DELETE",
                    successMessage: `${member.username} removed from friends`,
                  }).catch((error: Error) => {
                    toast.error(error.message);
                  });
                }}
                onBanUser={(userId) => {
                  void runMemberAction({
                    url: `/api/users/${userId}/ban`,
                    successMessage: `${member.username} was banned`,
                  }).catch((error: Error) => {
                    toast.error(error.message);
                  });
                }}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { socket } = useSocket();
  useActivityHeartbeat(socket);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { incrementUnread, clearUnread, refreshUnread } = useUnread();
  const pathname = usePathname();
  const activeRoomId = pathname.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const { data: myRoomsData } = useQuery({
    queryKey: ["my-rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms/my");
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json() as Promise<{ rooms: MyRoom[] }>;
    },
    staleTime: 30_000,
  });

  const myRooms = myRoomsData?.rooms ?? [];

  useEffect(() => {
    void refreshUnread().catch(() => {
      // best-effort; keep existing client state on transient failure
    });
  }, [refreshUnread]);

  useEffect(() => {
    if (!socket) return;
    const handleSessionRevoked = () => {
      disconnectSocket();
      router.push("/login");
    };
    socket.on("session:revoked", handleSessionRevoked);
    return () => {
      socket.off("session:revoked", handleSessionRevoked);
    };
  }, [router, socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const refreshRoom = (roomId?: string) => {
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      if (roomId) {
        void queryClient.invalidateQueries({
          queryKey: ["room-management", roomId],
        });
        void queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      }
    };

    const onMemberJoined = ({ roomId }: { roomId: string }) =>
      refreshRoom(roomId);
    const onMemberLeft = ({
      roomId,
      userId,
    }: {
      roomId: string;
      userId: string;
    }) => {
      refreshRoom(roomId);
      if (activeRoomId === roomId && session?.user?.id === userId) {
        toast.error("You were removed from this room");
        router.push("/chat");
      }
    };
    const onAdminUpdated = ({ roomId }: { roomId: string }) =>
      refreshRoom(roomId);
    const onBanRemoved = ({ roomId }: { roomId: string }) =>
      refreshRoom(roomId);
    const onRoomUpdated = ({ roomId }: { roomId: string }) =>
      refreshRoom(roomId);
    const onFriendEvent = () => {
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
    };
    const onNewMessage = ({ roomId }: { roomId: string }) => {
      if (roomId === activeRoomId) {
        clearUnread(roomId);
        return;
      }

      incrementUnread(roomId);
    };
    const onRoomDeleted = ({ roomId }: { roomId: string }) => {
      refreshRoom(roomId);
      if (activeRoomId === roomId) {
        router.push("/chat");
      }
    };
    const onMemberBanned = ({
      roomId,
      userId,
    }: {
      roomId: string;
      userId: string;
    }) => {
      refreshRoom(roomId);
      if (activeRoomId === roomId && session?.user?.id === userId) {
        toast.error("You were removed from this room");
        router.push("/chat");
      }
    };

    socket.on("room:member-joined", onMemberJoined);
    socket.on("room:member-left", onMemberLeft);
    socket.on("room:admin-updated", onAdminUpdated);
    socket.on("room:ban-removed", onBanRemoved);
    socket.on("room:updated", onRoomUpdated);
    socket.on("room:deleted", onRoomDeleted);
    socket.on("room:member-banned", onMemberBanned);
    socket.on("friend:request-received", onFriendEvent);
    socket.on("friend:accepted", onFriendEvent);
    socket.on("user:banned", onFriendEvent);
    socket.on("message:new", onNewMessage);

    return () => {
      socket.off("room:member-joined", onMemberJoined);
      socket.off("room:member-left", onMemberLeft);
      socket.off("room:admin-updated", onAdminUpdated);
      socket.off("room:ban-removed", onBanRemoved);
      socket.off("room:updated", onRoomUpdated);
      socket.off("room:deleted", onRoomDeleted);
      socket.off("room:member-banned", onMemberBanned);
      socket.off("friend:request-received", onFriendEvent);
      socket.off("friend:accepted", onFriendEvent);
      socket.off("user:banned", onFriendEvent);
      socket.off("message:new", onNewMessage);
    };
  }, [
    activeRoomId,
    clearUnread,
    incrementUnread,
    queryClient,
    router,
    session?.user?.id,
    socket,
  ]);

  const activeRoom = myRooms.find((r) => r.id === activeRoomId);
  const isDirect = activeRoom?.type === "direct";
  const contextPanelAvailable = !!activeRoomId && !isDirect;

  return (
    <ContextPanelContext.Provider
      value={{
        open: contextPanelOpen,
        toggle: () => setContextPanelOpen((o) => !o),
        available: contextPanelAvailable,
      }}
    >
      <div className="flex h-screen bg-background">
        <RoomsSidebar myRooms={myRooms} socket={socket} />

        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>

        {contextPanelAvailable && contextPanelOpen && (
          <ContextPanel
            activeRoomId={activeRoomId}
            myRooms={myRooms}
            socket={socket}
            onCollapse={() => setContextPanelOpen(false)}
          />
        )}
      </div>
    </ContextPanelContext.Provider>
  );
}
