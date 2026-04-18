import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { friendRequests } from "@/db/schema/friends";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: friendRequests.id,
      requesterUserId: friendRequests.requesterUserId,
      requesterUsername: users.username,
      requesterName: users.name,
      requesterImage: users.image,
      createdAt: friendRequests.createdAt,
    })
    .from(friendRequests)
    .innerJoin(users, eq(users.id, friendRequests.requesterUserId))
    .where(
      and(
        eq(friendRequests.addresseeUserId, user.id),
        eq(friendRequests.status, "pending"),
      ),
    )
    .orderBy(desc(friendRequests.createdAt));

  return NextResponse.json({
    requests: rows.map((row) => ({
      id: row.id,
      requesterUserId: row.requesterUserId,
      requesterUsername: row.requesterUsername,
      requesterName: row.requesterName,
      requesterImage: row.requesterImage,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
