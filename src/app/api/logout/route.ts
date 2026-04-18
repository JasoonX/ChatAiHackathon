import { NextResponse } from "next/server";

import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";

/**
 * POST /api/logout
 *
 * Disconnects all sockets for the current user server-side before the client
 * invalidates the session. This ensures presence goes to "offline" immediately
 * rather than staying AFK until a browser refresh.
 *
 * Call this BEFORE authClient.signOut() while the session is still valid.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const io = getIO();
  if (io) {
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      if (socket.data.userId === user.id) {
        socket.disconnect(true);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
