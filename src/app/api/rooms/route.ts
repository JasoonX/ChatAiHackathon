import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms, roomMembers } from "@/db/schema/rooms";
import { getCurrentUser } from "@/server/auth";

const createRoomSchema = z.object({
  name: z.string().min(1).trim(),
  description: z.string().optional(),
  type: z.enum(["public", "private"]),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { fieldErrors: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const { name, description, type } = parsed.data;

  const existing = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.name, name))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Room name already taken" },
      { status: 409 }
    );
  }

  const [room] = await db
    .insert(rooms)
    .values({ name, description, type, ownerId: user.id })
    .returning();

  await db
    .insert(roomMembers)
    .values({ roomId: room.id, userId: user.id, role: "admin" });

  return NextResponse.json(room, { status: 201 });
}
