"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
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

const PLACEHOLDER_MEMBERS: {
  name: string;
  role: "owner" | "admin" | "member";
  presence: Presence;
}[] = [
  { name: "Alice", role: "owner", presence: "online" },
  { name: "Bob", role: "admin", presence: "online" },
  { name: "Carol", role: "member", presence: "afk" },
  { name: "Dave", role: "admin", presence: "online" },
  { name: "Mike", role: "member", presence: "offline" },
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
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
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

function RoomsSidebar() {
  const queryClient = useQueryClient();
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

  const publicRooms =
    myRoomsData?.rooms.filter((r) => r.type === "public") ?? [];
  const privateRooms =
    myRoomsData?.rooms.filter((r) => r.type === "private") ?? [];

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

          <SidebarSection title="Private Rooms">
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

function ContextPanel() {
  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-l bg-card">
      <div className="p-4 space-y-1">
        <h3 className="text-sm font-semibold">Room info</h3>
        <p className="text-[12px] text-muted-foreground">Public room</p>
        <p className="text-[12px] text-muted-foreground">
          Owner: <span className="text-foreground">alice</span>
        </p>
      </div>

      <Separator />

      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Members ({PLACEHOLDER_MEMBERS.length})
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {PLACEHOLDER_MEMBERS.map((member) => (
            <MemberItem
              key={member.name}
              name={member.name}
              role={member.role}
              presence={member.presence}
            />
          ))}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3 space-y-2">
        <Button variant="secondary" size="sm" className="w-full text-[13px]">
          Invite user
        </Button>
        <Button variant="ghost" size="sm" className="w-full text-[13px]">
          Manage room
        </Button>
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <RoomsSidebar />}

        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>

        <ContextPanel />
      </div>
    </div>
  );
}
