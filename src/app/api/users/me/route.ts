import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import { getIO } from "@/lib/socket-server";
import { getCurrentUser } from "@/server/auth";
import { deleteUserAccount } from "@/server/account-deletion";

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Collect affected data before deletion for socket broadcasts.
  const { ownedRoomIds, dmRoomIds, memberRoomIds, friendUserIds } =
    await deleteUserAccount(user.id);

  // Broadcast to affected users after the transaction has committed.
  const io = getIO();
  if (io) {
    // Notify rooms the user owned or DM rooms — they've been deleted.
    for (const roomId of [...ownedRoomIds, ...dmRoomIds]) {
      io.to(roomId).emit("room:deleted", { roomId });
    }

    // Notify rooms the user was a member of — refresh member lists.
    for (const roomId of memberRoomIds) {
      io.to(roomId).emit("room:member-left", {
        roomId,
        userId: user.id,
      });
    }

    // Notify friends — friendship removed.
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      if (friendUserIds.includes(socket.data.userId)) {
        socket.emit("friend:removed", { friendUserId: user.id });
      }
    }

    // Disconnect the deleted user's own sockets.
    for (const socket of sockets) {
      if (socket.data.userId === user.id) {
        socket.disconnect(true);
      }
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
