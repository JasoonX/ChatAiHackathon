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
  Lock,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { useActivityHeartbeat } from "@/hooks/use-activity";
import { useSocket } from "@/hooks/use-socket";
import { authClient } from "@/lib/auth-client";
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

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["public", "private"]),
});

type CreateRoomForm = z.infer<typeof createRoomSchema>;

// ---------------------------------------------------------------------------
// Placeholder data (contacts + members — not yet wired)
// ---------------------------------------------------------------------------

const PLACEHOLDER_CONTACTS: {
  name: string;
  presence: Presence;
  unread: number;
}[] = [
  { name: "Alice", presence: "online", unread: 0 },
  { name: "Bob", presence: "afk", unread: 0 },
  { name: "Carol", presence: "offline", unread: 2 },
];

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
      <div className="flex items-center gap-1 px-3 py-1.5">
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
}: {
  id: string;
  name: string;
  isPrivate?: boolean;
  unread?: number;
  isActive?: boolean;
}) {
  return (
    <Link
      href={`/chat/${id}`}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {isPrivate ? (
        <Lock className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Hash className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="truncate">{name}</span>
      {unread > 0 && (
        <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
          {unread}
        </Badge>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar contact item
// ---------------------------------------------------------------------------

function ContactItem({
  name,
  presence,
  unread,
}: {
  name: string;
  presence: Presence;
  unread: number;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      <PresenceDot status={presence} />
      <span className="truncate">{name}</span>
      {unread > 0 && (
        <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
          {unread}
        </Badge>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Member item (right panel)
// ---------------------------------------------------------------------------

function MemberItem({
  name,
  role,
  presence,
}: {
  name: string;
  role: "owner" | "admin" | "member";
  presence: Presence;
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
      <span className="flex-1 truncate text-[13px]">{name}</span>
      {role !== "member" && (
        <Badge variant={roleVariant} className="text-[10px] px-1.5 py-0">
          {role}
        </Badge>
      )}
      <PresenceDot status={presence} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Room Dialog
// ---------------------------------------------------------------------------

function CreateRoomDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateRoomForm>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { name: "", description: "", type: "public" },
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
        <Button variant="secondary" size="sm" className="w-full gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create room
        </Button>
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

function BrowseRoomsDialog({ onJoined }: { onJoined: () => void }) {
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
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Browse public rooms"
        >
          <Globe className="h-3 w-3" />
        </button>
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
                  <p className="text-[13px] font-medium truncate">{room.name}</p>
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
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {invitations.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {invitations.length}
            </span>
          )}
        </Button>
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
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Invite user to room"
          >
            <Plus className="h-3 w-3" />
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
            {error && (
              <p className="text-[12px] text-destructive">{error}</p>
            )}
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
            <Button type="submit" size="sm" disabled={submitting || !username.trim()}>
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

const NAV_LINKS = [
  { label: "Public Rooms", href: "/chat" },
  { label: "Private Rooms", href: "/chat" },
  { label: "Contacts", href: "/chat" },
  { label: "Sessions", href: "/chat" },
];

function TopNav({
  sidebarOpen,
  onToggleSidebar,
  socket,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  socket: ReturnType<typeof useSocket>["socket"];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/80 backdrop-blur-[12px] px-4 gap-4">
      <Link href="/chat" className="flex items-center gap-2 shrink-0">
        <MessageSquare className="h-5 w-5 text-primary" />
        <span className="text-base font-semibold tracking-tight">Giga</span>
      </Link>

      <nav className="hidden md:flex items-center gap-1 ml-4">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <InvitationBell socket={socket} />
        <Button variant="ghost" size="sm" className="gap-1.5">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline text-[13px]">Profile</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
        <LogoutButton />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Left sidebar
// ---------------------------------------------------------------------------

function RoomsSidebar({ myRooms }: { myRooms: MyRoom[] }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const activeRoomId = pathname.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const publicRooms = myRooms.filter((r) => r.type === "public");
  const privateRooms = myRooms.filter((r) => r.type === "private");

  const invalidateRooms = () =>
    queryClient.invalidateQueries({ queryKey: ["my-rooms"] });

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r bg-card">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search…" className="h-8 pl-8 text-[13px]" />
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="py-2 space-y-3">
          <SidebarSection
            title="Public Rooms"
            action={<BrowseRoomsDialog onJoined={invalidateRooms} />}
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
                  isActive={activeRoomId === room.id}
                />
              ))
            )}
          </SidebarSection>

          <SidebarSection
            title="Private Rooms"
            action={
              activeRoomId &&
              privateRooms.some((r) => r.id === activeRoomId) ? (
                <InviteUserDialog roomId={activeRoomId} trigger="icon" />
              ) : undefined
            }
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
                  isActive={activeRoomId === room.id}
                />
              ))
            )}
          </SidebarSection>

          <Separator className="mx-3" />

          <SidebarSection title="Contacts">
            {PLACEHOLDER_CONTACTS.map((contact) => (
              <ContactItem
                key={contact.name}
                name={contact.name}
                presence={contact.presence}
                unread={contact.unread}
              />
            ))}
          </SidebarSection>
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3">
        <CreateRoomDialog onSuccess={invalidateRooms} />
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
}: {
  activeRoomId: string | null;
  myRooms: MyRoom[];
  socket: ReturnType<typeof useSocket>["socket"];
}) {
  const queryClient = useQueryClient();
  const activeRoom = myRooms.find((r) => r.id === activeRoomId);
  const [presence, setPresence] = useState<PresenceSnapshot>({});
  const { data: session } = authClient.useSession();

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

    const handleSnapshot = (snapshot: PresenceSnapshot) => setPresence(snapshot);
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

    return () => {
      socket.off("presence:snapshot", handleSnapshot);
      socket.off("presence:update", handleUpdate);
    };
  }, [socket]);

  const activeMembers =
    roomData?.members.map((member) => ({
      name: member.username,
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
        <h3 className="text-sm font-semibold">Room info</h3>
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

      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Members ({activeMembers.length})
        </span>
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
                key={`${member.role}:${member.name}`}
                name={member.name}
                role={member.role}
                presence={member.presence}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3 space-y-2">
        {activeRoom?.type === "private" && activeRoomId && (
          <InviteUserDialog roomId={activeRoomId} />
        )}
        {canOpenManageRoom && activeRoomId && (
          <RoomManagementModal
            roomId={activeRoomId}
            onDeleted={() => {
              if (session?.user?.id) {
                void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
              }
            }}
            trigger={
              <Button variant="ghost" size="sm" className="w-full text-[13px]">
                Manage room
              </Button>
            }
          />
        )}
      </div>
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = authClient.useSession();
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
    if (!socket) {
      return;
    }

    const refreshRoom = (roomId?: string) => {
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      if (roomId) {
        void queryClient.invalidateQueries({ queryKey: ["room-management", roomId] });
        void queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      }
    };

    const onMemberJoined = ({ roomId }: { roomId: string }) => refreshRoom(roomId);
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
    const onAdminUpdated = ({ roomId }: { roomId: string }) => refreshRoom(roomId);
    const onBanRemoved = ({ roomId }: { roomId: string }) => refreshRoom(roomId);
    const onRoomUpdated = ({ roomId }: { roomId: string }) => refreshRoom(roomId);
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

    return () => {
      socket.off("room:member-joined", onMemberJoined);
      socket.off("room:member-left", onMemberLeft);
      socket.off("room:admin-updated", onAdminUpdated);
      socket.off("room:ban-removed", onBanRemoved);
      socket.off("room:updated", onRoomUpdated);
      socket.off("room:deleted", onRoomDeleted);
      socket.off("room:member-banned", onMemberBanned);
    };
  }, [activeRoomId, queryClient, router, session?.user?.id, socket]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        socket={socket}
      />

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <RoomsSidebar myRooms={myRooms} />}

        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>

        <ContextPanel activeRoomId={activeRoomId} myRooms={myRooms} socket={socket} />
      </div>
    </div>
  );
}
