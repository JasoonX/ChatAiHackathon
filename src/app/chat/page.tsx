import { redirect } from "next/navigation";
import { Hash, MessageSquare } from "lucide-react";

import { db } from "@/db";
import { rooms, roomMembers } from "@/db/schema/rooms";
import { getCurrentUser } from "@/server/auth";
import { and, asc, eq, isNull } from "drizzle-orm";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await db
    .select({ id: rooms.id, name: rooms.name, type: rooms.type })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(and(eq(roomMembers.userId, user.id), isNull(rooms.deletedAt)))
    .orderBy(asc(rooms.name))
    .limit(1);

  if (rows.length > 0) {
    redirect(`/chat/${rows[0].id}`);
  }

  // No rooms yet — show onboarding empty state
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-medium">No conversations yet</p>
        <p className="text-[13px] text-muted-foreground">
          Join a public room or accept a friend request to get started.
        </p>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Hash className="h-3.5 w-3.5" />
        <span>Use the sidebar to browse public rooms</span>
      </div>
    </div>
  );
}
