import { createServer, type Server as HttpServer } from "node:http";
import { type AddressInfo } from "node:net";

import { eq } from "drizzle-orm";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { Server as SocketIOServer } from "socket.io";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { sessions } from "../db/schema";
import { handleAuthRequest } from "../lib/auth";
import { SESSION_COOKIE_NAME } from "../lib/auth-constants";
import { socketAuthMiddleware } from "../lib/socket-auth";
import { db, resetDb } from "../../tests/setup/integration";

type RouteHandler = (request: Request) => Promise<Response>;

const handlers: Record<string, RouteHandler | undefined> = {
  DELETE: handleAuthRequest,
  GET: handleAuthRequest,
  PATCH: handleAuthRequest,
  POST: handleAuthRequest,
  PUT: handleAuthRequest,
};

const authServer = createServer(async (req, res) => {
  const handler = handlers[req.method ?? "GET"];

  if (!handler) {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1:3000");
  const requestHeaders = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        requestHeaders.append(key, item);
      }
      continue;
    }

    if (value !== undefined) {
      requestHeaders.set(key, value);
    }
  }

  const webRequest = new Request(requestUrl, {
    method: req.method,
    headers: requestHeaders,
    body,
  });

  const response = await handler(webRequest);

  res.statusCode = response.status;

  const setCookies = response.headers.getSetCookie?.() ?? [];

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }

    res.setHeader(key, value);
  });

  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }

  res.end(Buffer.from(await response.arrayBuffer()));
});

let socketServer: HttpServer;
let io: SocketIOServer;
let socketPort: number;
const clientSockets: ClientSocket[] = [];

function createSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    socketServer = createServer();
    io = new SocketIOServer(socketServer, {
      cors: { origin: true, credentials: true },
    });
    io.use(socketAuthMiddleware);

    socketServer.listen(0, "127.0.0.1", () => {
      socketPort = (socketServer.address() as AddressInfo).port;
      resolve();
    });
  });
}

function connectClient(extraHeaders?: Record<string, string>): ClientSocket {
  const client = ioClient(`http://127.0.0.1:${socketPort}`, {
    autoConnect: false,
    transports: ["websocket"],
    extraHeaders,
  });
  clientSockets.push(client);
  return client;
}

async function registerAndGetCookie(overrides?: {
  email?: string;
  password?: string;
  username?: string;
}): Promise<string> {
  const email = overrides?.email ?? "socketuser@example.com";
  const password = overrides?.password ?? "password123";
  const username = overrides?.username ?? "socketuser";

  const agent = request.agent(authServer);
  const response = await agent
    .post("/api/auth/sign-up/email")
    .set("x-forwarded-for", "127.0.0.1")
    .set("user-agent", "vitest")
    .send({
      email,
      password,
      name: username,
      username,
      displayUsername: username,
    });

  expect([200, 201]).toContain(response.status);

  const setCookies: string[] = response.headers["set-cookie"] ?? [];
  const sessionCookie = setCookies
    .map((c: string) => c.split(";")[0])
    .find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

  expect(sessionCookie).toBeTruthy();
  return sessionCookie!;
}

describe("socket auth middleware", () => {
  beforeEach(async () => {
    await resetDb();
    await createSocketServer();
  });

  afterEach(async () => {
    for (const client of clientSockets) {
      client.disconnect();
    }
    clientSockets.length = 0;

    await new Promise<void>((resolve, reject) => {
      io.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  afterAll(async () => {
    if (authServer.listening) {
      await new Promise<void>((resolve, reject) => {
        authServer.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("connects with valid session cookie and attaches user data", async () => {
    const cookie = await registerAndGetCookie();

    const client = connectClient({ cookie });

    const connected = await new Promise<boolean>((resolve, reject) => {
      client.on("connect", () => resolve(true));
      client.on("connect_error", (err) =>
        reject(new Error(`connect_error: ${err.message}`)),
      );
      client.connect();
    });

    expect(connected).toBe(true);

    const sockets = await io.fetchSockets();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].data.userId).toBeTruthy();
    expect(sockets[0].data.username).toBe("socketuser");
    expect(sockets[0].data.sessionId).toBeTruthy();
  });

  it("rejects connection without cookie", async () => {
    const client = connectClient();

    const error = await new Promise<Error>((resolve) => {
      client.on("connect", () =>
        resolve(new Error("should not have connected")),
      );
      client.on("connect_error", (err) => resolve(err));
      client.connect();
    });

    expect(error.message).toBe("unauthorized");
  });

  it("rejects connection with expired session", async () => {
    const cookie = await registerAndGetCookie({
      email: "expired@example.com",
      username: "expireduser",
    });

    // Expire the session by setting expiresAt to the past
    await db
      .update(sessions)
      .set({ expiresAt: new Date("2000-01-01") })
      .where(eq(sessions.userId, sessions.userId));

    const client = connectClient({ cookie });

    const error = await new Promise<Error>((resolve) => {
      client.on("connect", () =>
        resolve(new Error("should not have connected")),
      );
      client.on("connect_error", (err) => resolve(err));
      client.connect();
    });

    expect(error.message).toBe("unauthorized");
  });
});
