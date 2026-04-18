"use client"

import { useState } from "react"
import Link from "next/link"
import { Hash, Lock, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <Separator />
      {children}
    </section>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em]">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export default function ComponentsPage() {
  const [inputValue, setInputValue] = useState("Hello world")

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Not available in production.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Component Preview
          </h1>
          <p className="mt-1 text-muted-foreground">
            All shadcn components styled to the Giga design system.
          </p>
        </div>

        {/* Buttons */}
        <Section title="Button">
          <Row label="variants">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="sizes">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Button>
          </Row>
          <Row label="states">
            <Button disabled>Disabled</Button>
            <Button variant="secondary" disabled>
              Disabled secondary
            </Button>
          </Row>
        </Section>

        {/* Badge */}
        <Section title="Badge">
          <Row label="variants">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="outline">Outline</Badge>
          </Row>
          <Row label="with dot">
            <Badge variant="success">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Online
            </Badge>
            <Badge variant="warning">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              AFK
            </Badge>
            <Badge variant="secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Offline
            </Badge>
          </Row>
        </Section>

        {/* Input */}
        <Section title="Input">
          <div className="grid max-w-md gap-4">
            <Row label="default">
              <div className="w-full space-y-1.5">
                <Label htmlFor="agent-name">Agent name</Label>
                <Input
                  id="agent-name"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <p className="text-xs font-mono text-muted-foreground">
                  Used in the agent header
                </p>
              </div>
            </Row>
            <Row label="placeholder">
              <Input className="w-full" placeholder="Enter your email..." />
            </Row>
            <Row label="disabled">
              <Input className="w-full" disabled value="Cannot edit" />
            </Row>
          </div>
        </Section>

        {/* Textarea */}
        <Section title="Textarea">
          <div className="max-w-md space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Tell us about your agent..." />
          </div>
        </Section>

        {/* Card */}
        <Section title="Card">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>
                  Card description with muted text.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Content area. Note the inset top highlight and no drop shadow.
                </p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Action</Button>
                <Button size="sm" variant="ghost">
                  Cancel
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Customer spotlight
                </p>
                <CardTitle className="text-lg">
                  How DoorDash scaled engagement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Giga leveraged usage data to deliver measurable improvements
                  across global teams.
                </p>
              </CardContent>
              <CardFooter>
                <Badge variant="success">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  DWR rate 80%
                </Badge>
              </CardFooter>
            </Card>
          </div>
        </Section>

        {/* Avatar */}
        <Section title="Avatar">
          <Row label="variants">
            <Avatar>
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">SM</AvatarFallback>
            </Avatar>
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-base">LG</AvatarFallback>
            </Avatar>
          </Row>
        </Section>

        {/* Tabs */}
        <Section title="Tabs">
          <Tabs defaultValue="chat" className="max-w-md">
            <TabsList>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="voice">Voice</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="chat">
              <p className="text-sm text-muted-foreground pt-2">
                Chat agent configuration panel.
              </p>
            </TabsContent>
            <TabsContent value="voice">
              <p className="text-sm text-muted-foreground pt-2">
                Voice agent configuration panel.
              </p>
            </TabsContent>
            <TabsContent value="settings">
              <p className="text-sm text-muted-foreground pt-2">
                General settings panel.
              </p>
            </TabsContent>
          </Tabs>
        </Section>

        {/* Dialog */}
        <Section title="Dialog">
          <Row label="open a dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create room</DialogTitle>
                  <DialogDescription>
                    Set up a new chat room for your team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Room name</Label>
                    <Input placeholder="general" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea placeholder="What is this room about?" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost">Cancel</Button>
                  <Button>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Row>
        </Section>

        {/* Dropdown */}
        <Section title="Dropdown Menu">
          <Row label="click to open">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Options</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Active sessions</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Row>
        </Section>

        {/* Separator */}
        <Section title="Separator">
          <div className="space-y-2 max-w-md">
            <p className="text-sm">Content above</p>
            <Separator />
            <p className="text-sm text-muted-foreground">Content below</p>
          </div>
        </Section>

        {/* Color Palette */}
        <Section title="Color Palette">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {[
              ["background", "bg-background", "text-foreground"],
              ["card", "bg-card", "text-card-foreground"],
              ["popover", "bg-popover", "text-popover-foreground"],
              ["primary", "bg-primary", "text-primary-foreground"],
              ["secondary", "bg-secondary", "text-secondary-foreground"],
              ["muted", "bg-muted", "text-muted-foreground"],
              ["accent", "bg-accent", "text-accent-foreground"],
              ["destructive", "bg-destructive", "text-destructive-foreground"],
              ["success", "bg-success", "text-success-foreground"],
              ["warning", "bg-warning", "text-warning-foreground"],
              ["info", "bg-info", "text-info-foreground"],
              ["border", "bg-border", "text-foreground"],
            ].map(([name, bg, fg]) => (
              <div
                key={name}
                className={`${bg} ${fg} rounded-lg border p-3 text-center`}
              >
                <span className="text-[10px] font-mono font-medium">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Eyebrow label
            </p>
            <h1 className="text-4xl font-bold tracking-tight">Display 1</h1>
            <h2 className="text-2xl font-semibold tracking-tight">
              Display 3
            </h2>
            <h3 className="text-xl font-semibold">Display 4</h3>
            <p className="text-sm leading-relaxed">
              Body text at 14px. This is what most content looks like in the
              Giga design system. Dense, functional, documentation-grade.
            </p>
            <p className="text-xs text-muted-foreground">
              Caption text — 12px, muted
            </p>
            <p className="font-mono text-sm text-muted-foreground">
              Monospace: JetBrains Mono
            </p>
          </div>
        </Section>

        {/* Presence Dots */}
        <Section title="Presence Dots">
          <Row label="states">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              <span className="text-sm">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-warning" />
              <span className="text-sm">AFK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="text-sm">Offline</span>
            </div>
          </Row>
        </Section>

        {/* Sidebar Items */}
        <Section title="Sidebar Items">
          <Row label="room items">
            <div className="w-full max-w-xs space-y-0.5 rounded-lg border bg-card p-2">
              {[
                { name: "general", icon: Hash, unread: 3 },
                { name: "engineering", icon: Hash, unread: 0 },
                { name: "core-team", icon: Lock, unread: 1 },
              ].map((room) => (
                <div
                  key={room.name}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <room.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{room.name}</span>
                  {room.unread > 0 && (
                    <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
                      {room.unread}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Row>
          <Row label="contact items">
            <div className="w-full max-w-xs space-y-0.5 rounded-lg border bg-card p-2">
              {[
                { name: "Alice", presence: "bg-success", unread: 0 },
                { name: "Bob", presence: "bg-warning", unread: 0 },
                { name: "Carol", presence: "bg-muted-foreground/40", unread: 2 },
              ].map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${c.presence}`} />
                  <span className="truncate">{c.name}</span>
                  {c.unread > 0 && (
                    <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
                      {c.unread}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Row>
        </Section>

        {/* Member List Items */}
        <Section title="Member List Items">
          <Row label="with roles and presence">
            <div className="w-full max-w-xs space-y-1 rounded-lg border bg-card p-2">
              {[
                { name: "Alice", role: "owner", presence: "bg-success", variant: "warning" as const },
                { name: "Dave", role: "admin", presence: "bg-success", variant: "info" as const },
                { name: "Bob", role: null, presence: "bg-warning", variant: null },
                { name: "Mike", role: null, presence: "bg-muted-foreground/40", variant: null },
              ].map((m) => (
                <div key={m.name} className="flex items-center gap-2 px-3 py-1.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px]">
                      {m.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-[13px]">{m.name}</span>
                  {m.role && (
                    <Badge variant={m.variant!} className="text-[10px] px-1.5 py-0">
                      {m.role}
                    </Badge>
                  )}
                  <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${m.presence}`} />
                </div>
              ))}
            </div>
          </Row>
        </Section>

        {/* Page Links */}
        <Section title="Page Previews">
          <Row label="auth & chat pages">
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/register">Register</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/chat">Chat Layout</Link>
            </Button>
          </Row>
        </Section>

        <div className="pb-16" />
      </div>
    </div>
  )
}
