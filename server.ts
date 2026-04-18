import { createServer } from "node:http";
import { parse } from "node:url";

import next from "next";
import { Server as SocketIOServer } from "socket.io";

import { db } from "./src/db";
import { roomMembers } from "./src/db/schema/rooms";
import { socketAuthMiddleware } from "./src/lib/socket-auth";
import { setIO } from "./src/lib/socket-server";
import { eq } from "drizzle-orm";

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

  io.on("connection", async (socket) => {
    const { userId, username } = socket.data;
    console.log(`User connected: ${userId} (${username})`);

    // Auto-join socket.io rooms for all rooms the user is a member of
    const memberships = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, userId));

    for (const { roomId } of memberships) {
      await socket.join(roomId);
    }

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId} (${username})`);
    });
  });

  const close = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);

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
