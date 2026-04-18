import { createServer } from "node:http";

import { count, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { sessions, users } from "../db/schema";
import { handleAuthRequest } from "./auth";
import { db, resetDb } from "../../tests/setup/integration";

type RouteHandler = (request: Request) => Promise<Response>;

const handlers: Record<string, RouteHandler | undefined> = {
  DELETE: handleAuthRequest,
  GET: handleAuthRequest,
  PATCH: handleAuthRequest,
  POST: handleAuthRequest,
  PUT: handleAuthRequest,
};

const server = createServer(async (req, res) => {
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

async function registerUser(agent = request.agent(server), overrides?: {
  email?: string;
  password?: string;
  username?: string;
}) {
  const email = overrides?.email ?? "alice@example.com";
  const password = overrides?.password ?? "password123";
  const username = overrides?.username ?? "alice";

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

  return {
    agent,
    email,
    password,
    response,
    username,
  };
}

describe("auth integration", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    if (!server.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("register creates user + session in DB", async () => {
    const { email, response, username } = await registerUser();

    expect([200, 201]).toContain(response.status);

    const createdUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    const [sessionCount] = await db
      .select({ value: count() })
      .from(sessions)
      .where(eq(sessions.userId, createdUser!.id));

    expect(createdUser).toMatchObject({
      email,
      username,
    });
    expect(sessionCount?.value).toBe(1);
  });

  it("login with correct credentials returns valid session", async () => {
    await registerUser(undefined, {
      email: "login@example.com",
      password: "password123",
      username: "login_user",
    });

    const agent = request.agent(server);
    const loginResponse = await agent
      .post("/api/auth/sign-in/email")
      .set("x-forwarded-for", "127.0.0.1")
      .set("user-agent", "vitest")
      .send({
        email: "login@example.com",
        password: "password123",
        rememberMe: true,
      });

    expect(loginResponse.status).toBe(200);

    const sessionResponse = await agent.get("/api/auth/get-session");

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.user.email).toBe("login@example.com");
    expect(sessionResponse.body.session.token).toBeTruthy();
  });

  it("login with wrong credentials returns error", async () => {
    await registerUser(undefined, {
      email: "wrong@example.com",
      password: "password123",
      username: "wrong_user",
    });

    const response = await request(server).post("/api/auth/sign-in/email").send({
      email: "wrong@example.com",
      password: "not-the-password",
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body.error?.message ?? response.body.message).toBeTruthy();
  });

  it("logout deletes session row from DB", async () => {
    const { agent, email } = await registerUser(undefined, {
      email: "logout@example.com",
      password: "password123",
      username: "logout_user",
    });

    const createdUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    const logoutResponse = await agent.post("/api/auth/sign-out").send({});

    expect(logoutResponse.status).toBe(200);

    const [sessionCount] = await db
      .select({ value: count() })
      .from(sessions)
      .where(eq(sessions.userId, createdUser!.id));

    expect(sessionCount?.value).toBe(0);
  });

  it("duplicate email returns 409", async () => {
    await registerUser(undefined, {
      email: "duplicate@example.com",
      password: "password123",
      username: "first_user",
    });

    const response = await request(server).post("/api/auth/sign-up/email").send({
      email: "duplicate@example.com",
      password: "password123",
      name: "second_user",
      username: "second_user",
      displayUsername: "second_user",
    });

    expect(response.status).toBe(409);
  });

  it("duplicate username returns 409", async () => {
    await registerUser(undefined, {
      email: "first@example.com",
      password: "password123",
      username: "duplicate_user",
    });

    const response = await request(server).post("/api/auth/sign-up/email").send({
      email: "second@example.com",
      password: "password123",
      name: "duplicate_user",
      username: "duplicate_user",
      displayUsername: "duplicate_user",
    });

    expect(response.status).toBe(409);
  });
});
