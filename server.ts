import { createServer } from "node:http";
import { parse } from "node:url";

import next from "next";
import { Server as SocketIOServer } from "socket.io";

import { db } from "./src/db";
import { roomMembers, rooms } from "./src/db/schema/rooms";
import { messages } from "./src/db/schema/messages";
import { users } from "./src/db/schema/users";
import { socketAuthMiddleware } from "./src/lib/socket-auth";
import { setIO } from "./src/lib/socket-server";
import { canUserPostInRoom } from "./src/lib/permissions";
import type { MessagePayload } from "./src/lib/socket";
import { getDirectMessageState } from "./src/server/friends";
import {
  addSocket,
  removeSocket,
  recordHeartbeat,
  getSnapshot,
  startPresenceSweep,
  stopPresenceSweep,
} from "./src/server/presence";
import { and, eq } from "drizzle-orm";

const dev = process.env.NODE_ENV !== "production";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let shuttingDown = false;

async function bootstrap() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    void handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  setIO(io);
  startPresenceSweep(io);

  io.on("connection", (socket) => {
    const { userId, username } = socket.data;
    console.log(`User connected: ${userId} (${username})`);

    // Presence: track this socket
    addSocket(userId, socket.id);

    // Send current presence snapshot to newly connected client
    socket.emit("presence:snapshot", getSnapshot());

    // Auto-join: run async but don't block handler registration.
    // Handlers MUST be registered synchronously so buffered client events
    // are not dropped while the DB query is in flight.
    void db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, userId))
      .then((memberships) =>
        Promise.all(memberships.map(({ roomId }) => socket.join(roomId))),
      );

    socket.on(
      "message:send",
      async (
        { roomId, content, replyToMessageId }: { roomId: string; content: string; replyToMessageId?: string },
        callback: (response: { error?: string; message?: MessagePayload }) => void,
      ) => {
        // 1. Validate content
        if (
          typeof content !== "string" ||
          content.trim().length === 0 ||
          Buffer.byteLength(content, "utf8") > 3072
        ) {
          callback({ error: "Message too long (max 3KB)" });
          return;
        }

        // 2. Check membership and fetch room in parallel
        const [membershipRows, roomRows] = await Promise.all([
          db
            .select()
            .from(roomMembers)
            .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
            .limit(1),
          db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1),
        ]);

        const membership = membershipRows[0];
        const room = roomRows[0];

        if (!room || !membership) {
          callback({ error: "Not a member of this room" });
          return;
        }

        // 3. Permission check
        const user = { id: userId };
        const permRoom = { id: room.id, type: room.type, ownerId: room.ownerId };
        const permMembership = { userId, role: membership.role };

        if (!canUserPostInRoom(user, permRoom, permMembership)) {
          callback({ error: "Not a member of this room" });
          return;
        }

        if (room.type === "direct") {
          const directState = await getDirectMessageState(roomId, userId);
          if (!directState?.canMessage) {
            callback({ error: "You cannot message this user" });
            return;
          }
        }

        // 4. Insert message
        const [message] = await db
          .insert(messages)
          .values({
            roomId,
            senderUserId: userId,
            body: content,
            replyToMessageId: replyToMessageId ?? null,
          })
          .returning();

        // 5. Fetch sender + reply-to data in parallel
        const senderPromise = db
          .select({
            id: users.id,
            username: users.username,
            name: users.name,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        let replyTo: MessagePayload["replyTo"] = null;

        if (message.replyToMessageId) {
          const replyPromise = db
            .select({
              id: messages.id,
              body: messages.body,
              deletedAt: messages.deletedAt,
              senderUsername: users.username,
            })
            .from(messages)
            .innerJoin(users, eq(messages.senderUserId, users.id))
            .where(eq(messages.id, message.replyToMessageId))
            .limit(1);

          const [[sender], replyRows] = await Promise.all([senderPromise, replyPromise]);
          const reply = replyRows[0];

          if (reply) {
            replyTo = {
              id: reply.id,
              content: reply.deletedAt ? null : reply.body,
              sender: { username: reply.senderUsername },
            };
          }

          // 6. Build payload
          const payload: MessagePayload = {
            id: message.id,
            roomId: message.roomId,
            content: message.body,
            createdAt: message.createdAt.toISOString(),
            editedAt: null,
            deletedAt: null,
            sender: {
              id: sender.id,
              username: sender.username,
              name: sender.name,
              image: sender.image,
            },
            replyTo,
            attachments: [],
          };

          await socket.join(roomId);
          console.log(`[message:send] userId=${userId} roomId=${roomId} msgId=${message.id}`);
          io.to(roomId).emit("message:new", payload);
          callback({ message: payload });
          return;
        }

        const [sender] = await senderPromise;

        // 6. Build payload
        const payload: MessagePayload = {
          id: message.id,
          roomId: message.roomId,
          content: message.body,
          createdAt: message.createdAt.toISOString(),
          editedAt: null,
          deletedAt: null,
          sender: {
            id: sender.id,
            username: sender.username,
            name: sender.name,
            image: sender.image,
          },
          replyTo: null,
          attachments: [],
        };

        // 7. Ensure sender's socket is in the channel, then broadcast
        await socket.join(roomId);
        console.log(`[message:send] userId=${userId} roomId=${roomId} msgId=${message.id}`);
        io.to(roomId).emit("message:new", payload);
        callback({ message: payload });
      },
    );

    // Allow clients to (re-)subscribe to a room channel after joining mid-session.
    socket.on("room:subscribe", async (roomId: string) => {
      console.log(`[room:subscribe] userId=${userId} roomId=${roomId}`);
      // Validate membership before joining the channel
      const [member] = await db
        .select({ id: roomMembers.id })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
        .limit(1);
      if (member) {
        await socket.join(roomId);
        console.log(`[room:subscribe] joined. socket.rooms:`, Array.from(socket.rooms));
      } else {
        console.log(`[room:subscribe] NOT a member — skipped join`);
      }
    });

    socket.on("heartbeat", () => {
      recordHeartbeat(userId, socket.id);
    });

    socket.on("presence:refresh", () => {
      socket.emit("presence:snapshot", getSnapshot());
    });

    socket.on("disconnect", () => {
      removeSocket(userId, socket.id);
      console.log(`User disconnected: ${userId} (${username})`);
    });
  });

  const close = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);
    stopPresenceSweep();

    await new Promise<void>((resolve, reject) => {
      io.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        httpServer.close((serverError) => {
          if (serverError) {
            reject(serverError);
            return;
          }

          resolve();
        });
      });
    });

    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void close("SIGTERM");
  });

  process.on("SIGINT", () => {
    void close("SIGINT");
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
