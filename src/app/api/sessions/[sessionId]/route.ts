import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { isValidUUID } from "@/lib/validate";
import { sessions } from "@/db/schema/users";
import { getCurrentSession } from "@/server/auth";
import { getIO } from "@/lib/socket-server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const currentSession = await getCurrentSession();
  if (!currentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  if (!isValidUUID(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  if (sessionId === currentSession.session.id) {
    return NextResponse.json(
      { error: "Cannot revoke current session. Use logout instead." },
      { status: 400 },
    );
  }

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, currentSession.user.id),
      ),
    )
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await db.delete(sessions).where(eq(sessions.id, sessionId));

  const io = getIO();
  if (io) {
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      if (socket.data.sessionId === sessionId) {
        socket.emit("session:revoked");
        socket.disconnect(true);
      }
    }
  }

  return NextResponse.json({ success: true });
}
