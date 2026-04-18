"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Hash,
  Lock,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoutButton } from "@/components/logout-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Placeholder data
// ---------------------------------------------------------------------------

type Presence = "online" | "afk" | "offline";

const PLACEHOLDER_ROOMS = {
  public: [
    { name: "general", unread: 3 },
    { name: "engineering", unread: 0 },
    { name: "random", unread: 0 },
  ],
  private: [
    { name: "core-team", unread: 1 },
    { name: "ops", unread: 0 },
  ],
};

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
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {title}
      </button>
      {open && <div className="space-y-0.5 px-1">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar room item
// ---------------------------------------------------------------------------

function RoomItem({
  name,
  isPrivate,
  unread,
}: {
  name: string;
  isPrivate?: boolean;
  unread: number;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
    </button>
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
// Right sidebar (rooms + contacts)
// ---------------------------------------------------------------------------

function RoomsSidebar() {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r bg-card">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-8 pl-8 text-[13px]"
          />
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="py-2 space-y-3">
          <SidebarSection title="Public Rooms">
            {PLACEHOLDER_ROOMS.public.map((room) => (
              <RoomItem key={room.name} name={room.name} unread={room.unread} />
            ))}
          </SidebarSection>

          <SidebarSection title="Private Rooms">
            {PLACEHOLDER_ROOMS.private.map((room) => (
              <RoomItem
                key={room.name}
                name={room.name}
                isPrivate
                unread={room.unread}
              />
            ))}
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
        <Button variant="secondary" size="sm" className="w-full gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create room
        </Button>
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
