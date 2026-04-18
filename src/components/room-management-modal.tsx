"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Shield, ShieldOff, Trash2, UserMinus, UserX } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  canUserManageMembers,
  canUserRemoveAdmin,
  type PermissionMembership,
} from "@/lib/permissions";
import type { PresenceSnapshot, PresenceStatus } from "@/lib/socket";
import { useSocket } from "@/hooks/use-socket";
import { PresenceDot } from "@/components/presence-dot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type RoomManagementResponse = {
  room: {
    id: string;
    name: string;
    description: string | null;
    type: "public" | "private" | "direct";
    ownerId: string | null;
    currentUserRole: "member" | "admin";
    canManageMembers: boolean;
    canDeleteRoom: boolean;
  };
  members: Array<{
    userId: string;
    username: string;
    name: string;
    image: string | null;
    role: "member" | "admin";
    isOwner: boolean;
    joinedAt: string;
  }>;
  admins: Array<{
    userId: string;
    username: string;
    name: string;
    image: string | null;
    role: "member" | "admin";
    isOwner: boolean;
    joinedAt: string;
  }>;
  bans: Array<{
    userId: string;
    username: string;
    name: string;
    bannedByUserId: string | null;
    bannedByUsername: string | null;
    createdAt: string;
  }>;
  invitations: Array<{
    id: string;
    inviteeUserId: string;
    inviteeUsername: string;
    status: "pending" | "accepted" | "rejected" | "revoked";
    createdAt: string;
  }>;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function parseActionError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export function RoomManagementModal({
  roomId,
  trigger,
  onDeleted,
}: {
  roomId: string;
  trigger: React.ReactNode;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { socket } = useSocket();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [presence, setPresence] = useState<PresenceSnapshot>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["room-management", roomId],
    queryFn: async () => {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (!response.ok) {
        throw new Error(await parseActionError(response));
      }
      return (await response.json()) as RoomManagementResponse;
    },
    enabled: open,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    setRoomName(data.room.name);
    setRoomDescription(data.room.description ?? "");
    setVisibility(data.room.type === "private" ? "private" : "public");
  }, [data]);

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

  const currentMembership = useMemo<PermissionMembership | null>(() => {
    if (!data || !session?.user?.id) {
      return null;
    }

    const row = data.members.find((member) => member.userId === session.user.id);
    if (!row) {
      return null;
    }

    return {
      userId: row.userId,
      role: row.role,
    };
  }, [data, session?.user?.id]);

  const permissionRoom = useMemo(() => {
    if (!data) {
      return null;
    }

    return {
      id: data.room.id,
      type: data.room.type,
      ownerId: data.room.ownerId,
      adminUserIds: data.admins
        .filter((member) => !member.isOwner)
        .map((member) => member.userId),
    } as const;
  }, [data]);

  const canManageMembersInUi =
    session?.user?.id && permissionRoom
      ? canUserManageMembers(
          { id: session.user.id },
          permissionRoom,
          currentMembership,
        )
      : false;

  const refreshRoomState = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["my-rooms"] }),
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] }),
    ]);
  };

  const actionMutation = useMutation({
    mutationFn: async ({
      url,
      method,
      body,
      successMessage,
      redirectAfterDelete = false,
    }: {
      url: string;
      method: "POST" | "PATCH" | "DELETE";
      body?: unknown;
      successMessage: string;
      redirectAfterDelete?: boolean;
    }) => {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(await parseActionError(response));
      }

      if (redirectAfterDelete) {
        setOpen(false);
        onDeleted?.();
        router.push("/chat");
      } else {
        await refreshRoomState();
      }

      toast.success(successMessage);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/rooms/${roomId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inviteUsername.trim() }),
      });

      if (!response.ok) {
        throw new Error(await parseActionError(response));
      }

      await refreshRoomState();
      setInviteUsername("");
      toast.success("Invitation sent");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const filteredMembers = useMemo(() => {
    if (!data) {
      return [];
    }

    const query = memberSearch.trim().toLowerCase();
    if (!query) {
      return data.members;
    }

    return data.members.filter((member) => {
      return (
        member.username.toLowerCase().includes(query) ||
        member.name.toLowerCase().includes(query)
      );
    });
  }, [data, memberSearch]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Manage Room: {data?.room.name ?? "Loading…"}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading room settings…
          </div>
        ) : (
          <Tabs defaultValue="members" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="admins">Admins</TabsTrigger>
              <TabsTrigger value="banned">Banned users</TabsTrigger>
              {data.room.type === "private" && (
                <TabsTrigger value="invitations">Invitations</TabsTrigger>
              )}
              {data.room.type !== "direct" && (
                <TabsTrigger value="settings">Settings</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="members" className="space-y-4">
              <Input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search member"
              />

              <ScrollArea className="h-[420px] rounded-md border">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[2fr_120px_120px_2fr] gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <span>Username</span>
                    <span>Status</span>
                    <span>Role</span>
                    <span>Actions</span>
                  </div>
                  {filteredMembers.map((member) => {
                    const status = presence[member.userId] ?? "offline";
                    const canRemoveAdminForTarget =
                      session?.user?.id && permissionRoom
                        ? canUserRemoveAdmin(
                            { id: session.user.id },
                            { id: member.userId },
                            permissionRoom,
                          )
                        : false;

                    return (
                      <div
                        key={member.userId}
                        className="grid grid-cols-[2fr_120px_120px_2fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.username}</span>
                          {session?.user?.id === member.userId && (
                            <span className="text-[11px] text-muted-foreground">(you)</span>
                          )}
                          {member.isOwner && <Badge variant="secondary">Owner</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <PresenceDot status={status} />
                          <span className="capitalize">{status}</span>
                        </div>
                        <span className="capitalize">
                          {member.isOwner ? "Owner" : member.role}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {member.isOwner ? (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          ) : (
                            <>
                              {member.role === "member" && canManageMembersInUi && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  onClick={() =>
                                    actionMutation.mutate({
                                      url: `/api/rooms/${roomId}/admin/${member.userId}`,
                                      method: "POST",
                                      successMessage: `${member.username} is now an admin`,
                                    })
                                  }
                                >
                                  <Shield className="h-3.5 w-3.5" />
                                  Make admin
                                </button>
                              )}
                              {member.role === "admin" && canRemoveAdminForTarget && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  onClick={() =>
                                    actionMutation.mutate({
                                      url: `/api/rooms/${roomId}/admin/${member.userId}`,
                                      method: "DELETE",
                                      successMessage: `${member.username} is now a member`,
                                    })
                                  }
                                >
                                  <ShieldOff className="h-3.5 w-3.5" />
                                  Remove admin
                                </button>
                              )}
                              {canManageMembersInUi && member.role === "member" && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  onClick={() =>
                                    actionMutation.mutate({
                                      url: `/api/rooms/${roomId}/member/${member.userId}`,
                                      method: "DELETE",
                                      successMessage: `${member.username} was removed from the room`,
                                    })
                                  }
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                  Remove
                                </button>
                              )}
                              {canManageMembersInUi && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-destructive transition-colors hover:bg-accent"
                                  onClick={() =>
                                    actionMutation.mutate({
                                      url: `/api/rooms/${roomId}/ban`,
                                      method: "POST",
                                      body: { userId: member.userId },
                                      successMessage: `${member.username} was banned`,
                                    })
                                  }
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  Ban
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="admins" className="space-y-4">
              <ScrollArea className="h-[420px] rounded-md border">
                <div className="space-y-3 p-4">
                  {data.admins.map((admin) => {
                    const canRemove =
                      session?.user?.id && permissionRoom
                        ? canUserRemoveAdmin(
                            { id: session.user.id },
                            { id: admin.userId },
                            permissionRoom,
                          )
                        : false;

                    return (
                      <div
                        key={admin.userId}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {admin.username}
                            {session?.user?.id === admin.userId && (
                              <span className="ml-1 text-[11px] font-normal text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {admin.isOwner
                              ? "Owner, cannot lose admin rights"
                              : "Admin"}
                          </p>
                        </div>
                        {admin.isOwner ? (
                          <Badge variant="secondary">Owner</Badge>
                        ) : canRemove ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              actionMutation.mutate({
                                url: `/api/rooms/${roomId}/admin/${admin.userId}`,
                                method: "DELETE",
                                successMessage: `${admin.username} is now a member`,
                              })
                            }
                          >
                            Remove admin
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No permission
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="banned" className="space-y-4">
              <ScrollArea className="h-[420px] rounded-md border">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[2fr_2fr_180px_120px] gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <span>Username</span>
                    <span>Banned by</span>
                    <span>Date / time</span>
                    <span>Actions</span>
                  </div>
                  {data.bans.length === 0 && (
                    <div className="px-4 py-10 text-sm text-muted-foreground">
                      No banned users
                    </div>
                  )}
                  {data.bans.map((ban) => (
                    <div
                      key={ban.userId}
                      className="grid grid-cols-[2fr_2fr_180px_120px] gap-3 border-b px-4 py-3 text-sm last:border-b-0"
                    >
                      <span>{ban.username}</span>
                      <span>{ban.bannedByUsername ?? "Unknown"}</span>
                      <span>{formatDateTime(ban.createdAt)}</span>
                      <div>
                        {canManageMembersInUi ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              actionMutation.mutate({
                                url: `/api/rooms/${roomId}/ban/${ban.userId}`,
                                method: "DELETE",
                                successMessage: `${ban.username} was unbanned`,
                              })
                            }
                          >
                            Unban
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">No permission</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {data.room.type === "private" && (
              <TabsContent value="invitations" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    value={inviteUsername}
                    onChange={(event) => setInviteUsername(event.target.value)}
                    placeholder="Invite by username"
                  />
                  <Button
                    disabled={!inviteUsername.trim() || inviteMutation.isPending}
                    onClick={() => inviteMutation.mutate()}
                  >
                    {inviteMutation.isPending ? "Sending…" : "Send invite"}
                  </Button>
                </div>

                <ScrollArea className="h-[360px] rounded-md border">
                  {data.invitations.length === 0 ? (
                    <div className="px-4 py-10 text-sm text-muted-foreground">
                      No pending invitations
                    </div>
                  ) : (
                    <div className="space-y-3 p-4">
                      {data.invitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {invitation.inviteeUsername}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sent {formatDateTime(invitation.createdAt)}
                            </p>
                          </div>
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            )}

            {data.room.type !== "direct" && (
              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Room name</label>
                  <Input
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    disabled={!data.room.canDeleteRoom}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={roomDescription}
                    onChange={(event) => setRoomDescription(event.target.value)}
                    rows={4}
                    disabled={!data.room.canDeleteRoom}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Visibility</label>
                  <div className="flex gap-4 text-sm">
                    {(["public", "private"] as const).map((value) => (
                      <label key={value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={visibility === value}
                          disabled={!data.room.canDeleteRoom}
                          onChange={() => setVisibility(value)}
                        />
                        <span className="capitalize">{value}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    disabled={actionMutation.isPending || !data.room.canDeleteRoom}
                    onClick={() =>
                      actionMutation.mutate({
                        url: `/api/rooms/${roomId}`,
                        method: "PATCH",
                        body: {
                          name: roomName,
                          description: roomDescription,
                          visibility,
                        },
                        successMessage: "Room settings updated",
                      })
                    }
                  >
                    Save changes
                  </Button>

                  {data.room.canDeleteRoom && (
                    <Dialog
                      open={confirmDeleteOpen}
                      onOpenChange={setConfirmDeleteOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete room
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Delete room?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          This permanently deletes the room, its messages, and its
                          attachments.
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setConfirmDeleteOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            disabled={actionMutation.isPending}
                            onClick={() =>
                              actionMutation.mutate({
                                url: `/api/rooms/${roomId}`,
                                method: "DELETE",
                                successMessage: "Room deleted",
                                redirectAfterDelete: true,
                              })
                            }
                          >
                            Confirm delete
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
