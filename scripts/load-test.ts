import { performance } from "node:perf_hooks";

import { io, type Socket } from "socket.io-client";

type CliOptions = {
  baseUrl: string;
  users: number;
  roomName: string;
  senders: number;
  messagesPerSender: number;
  password: string;
  prefix: string;
  concurrency: number;
  timeoutMs: number;
};

type UserCredential = {
  email: string;
  username: string;
  password: string;
};

type AuthenticatedUser = UserCredential & {
  cookie: string;
};

type PublicRoomSearchResponse = {
  rooms: Array<{
    id: string;
    name: string;
    isMember: boolean;
    isOwner: boolean;
  }>;
};

type MessagePayload = {
  id: string;
  roomId: string;
  content: string | null;
};

type HeadersWithOptionalGetSetCookie = Headers & {
  getSetCookie?: () => string[];
};

const DEFAULTS: CliOptions = {
  baseUrl: "http://localhost:3000",
  users: 25,
  roomName: "load-test-room",
  senders: 5,
  messagesPerSender: 3,
  password: "password123",
  prefix: "loadtest",
  concurrency: 10,
  timeoutMs: 10_000,
};

function parseArgs(argv: string[]): CliOptions {
  const options = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--base-url":
        options.baseUrl = next ?? options.baseUrl;
        index += 1;
        break;
      case "--users":
        options.users = Number.parseInt(next ?? "", 10) || options.users;
        index += 1;
        break;
      case "--room":
        options.roomName = next ?? options.roomName;
        index += 1;
        break;
      case "--senders":
        options.senders = Number.parseInt(next ?? "", 10) || options.senders;
        index += 1;
        break;
      case "--messages":
        options.messagesPerSender =
          Number.parseInt(next ?? "", 10) || options.messagesPerSender;
        index += 1;
        break;
      case "--password":
        options.password = next ?? options.password;
        index += 1;
        break;
      case "--prefix":
        options.prefix = next ?? options.prefix;
        index += 1;
        break;
      case "--concurrency":
        options.concurrency =
          Number.parseInt(next ?? "", 10) || options.concurrency;
        index += 1;
        break;
      case "--timeout":
        options.timeoutMs = Number.parseInt(next ?? "", 10) || options.timeoutMs;
        index += 1;
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        break;
    }
  }

  if (options.senders > options.users) {
    options.senders = options.users;
  }

  return options;
}

function printHelp() {
  console.log(`Usage: pnpm load:test [options]

Options:
  --base-url <url>       App base URL (default: ${DEFAULTS.baseUrl})
  --users <n>            Number of users to auth/connect (default: ${DEFAULTS.users})
  --room <name>          Public room name to create/reuse (default: ${DEFAULTS.roomName})
  --senders <n>          Number of connected users that send messages (default: ${DEFAULTS.senders})
  --messages <n>         Messages per sender (default: ${DEFAULTS.messagesPerSender})
  --password <value>     Shared password for generated users (default: ${DEFAULTS.password})
  --prefix <value>       Username/email prefix for generated users (default: ${DEFAULTS.prefix})
  --concurrency <n>      Concurrent auth/join workers (default: ${DEFAULTS.concurrency})
  --timeout <ms>         Per-step timeout in ms (default: ${DEFAULTS.timeoutMs})
`);
}

function getSetCookies(headers: HeadersWithOptionalGetSetCookie): string[] {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function extractSessionCookie(headers: Headers): string {
  const cookies = getSetCookies(headers as HeadersWithOptionalGetSetCookie);
  const sessionCookie = cookies
    .map((cookie) => cookie.split(";")[0])
    .find((cookie) => cookie.startsWith("better-auth.session_token="));

  if (!sessionCookie) {
    throw new Error("No better-auth session cookie returned");
  }

  return sessionCookie;
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getBrowserLikeHeaders(baseUrl: string): Record<string, string> {
  const origin = new URL(baseUrl).origin;

  return {
    origin,
    referer: `${origin}/`,
    "user-agent": "load-test-script",
    "x-forwarded-for": "127.0.0.1",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  const parsedSeconds = retryAfter ? Number.parseFloat(retryAfter) : Number.NaN;

  if (Number.isFinite(parsedSeconds) && parsedSeconds >= 0) {
    return parsedSeconds * 1000;
  }

  return Math.min(500 * 2 ** attempt, 5_000);
}

async function fetchWithRateLimitRetry(
  input: string,
  init: RequestInit,
  label: string,
  maxRetries = 5,
) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(input, init);

    if (response.status !== 429 || attempt === maxRetries) {
      return response;
    }

    const delayMs = getRetryDelayMs(response, attempt);
    console.warn(
      `${label} hit rate limit (429). Retrying in ${Math.round(delayMs)}ms...`,
    );
    await sleep(delayMs);
  }

  throw new Error(`${label} failed after retry loop`);
}

async function registerOrLogin(
  baseUrl: string,
  credential: UserCredential,
): Promise<AuthenticatedUser> {
  const signInResponse = await fetchWithRateLimitRetry(
    `${baseUrl}/api/auth/sign-in/email`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...getBrowserLikeHeaders(baseUrl),
      },
      body: JSON.stringify({
        email: credential.email,
        password: credential.password,
        rememberMe: true,
      }),
    },
    `Sign in for ${credential.username}`,
  );

  if (signInResponse.ok) {
    return {
      ...credential,
      cookie: extractSessionCookie(signInResponse.headers),
    };
  }

  const signUpResponse = await fetchWithRateLimitRetry(
    `${baseUrl}/api/auth/sign-up/email`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...getBrowserLikeHeaders(baseUrl),
      },
      body: JSON.stringify({
        email: credential.email,
        password: credential.password,
        name: credential.username,
        username: credential.username,
        displayUsername: credential.username,
      }),
    },
    `Sign up for ${credential.username}`,
  );

  if (signUpResponse.ok) {
    return {
      ...credential,
      cookie: extractSessionCookie(signUpResponse.headers),
    };
  }

  if (signUpResponse.status === 409) {
    const retrySignInResponse = await fetchWithRateLimitRetry(
      `${baseUrl}/api/auth/sign-in/email`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...getBrowserLikeHeaders(baseUrl),
        },
        body: JSON.stringify({
          email: credential.email,
          password: credential.password,
          rememberMe: true,
        }),
      },
      `Retry sign in for ${credential.username}`,
    );

    if (retrySignInResponse.ok) {
      return {
        ...credential,
        cookie: extractSessionCookie(retrySignInResponse.headers),
      };
    }

    const body = await parseJson(retrySignInResponse);
    throw new Error(
      `User ${credential.username} already exists but sign in failed: ${retrySignInResponse.status} ${JSON.stringify(body)}`,
    );
  }

  {
    const body = await parseJson(signUpResponse);
    throw new Error(
      `Sign up failed for ${credential.username}: ${signUpResponse.status} ${JSON.stringify(body)}`,
    );
  }
}

async function ensureRoom(
  baseUrl: string,
  owner: AuthenticatedUser,
  roomName: string,
): Promise<string> {
  const createResponse = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: owner.cookie,
    },
    body: JSON.stringify({
      name: roomName,
      description: "Load test room",
      type: "public",
    }),
  });

  if (createResponse.ok) {
    const body = (await createResponse.json()) as { id: string };
    return body.id;
  }

  if (createResponse.status !== 409) {
    const body = await parseJson(createResponse);
    throw new Error(
      `Create room failed: ${createResponse.status} ${JSON.stringify(body)}`,
    );
  }

  const searchResponse = await fetch(
    `${baseUrl}/api/rooms/public?search=${encodeURIComponent(roomName)}&limit=50`,
    {
      headers: { cookie: owner.cookie },
    },
  );

  if (!searchResponse.ok) {
    const body = await parseJson(searchResponse);
    throw new Error(
      `Room search failed: ${searchResponse.status} ${JSON.stringify(body)}`,
    );
  }

  const body = (await searchResponse.json()) as PublicRoomSearchResponse;
  const match = body.rooms.find((room) => room.name === roomName);

  if (!match) {
    throw new Error(`Room "${roomName}" not found after create conflict`);
  }

  if (!match.isMember && !match.isOwner) {
    const joinResponse = await fetch(`${baseUrl}/api/rooms/${match.id}/join`, {
      method: "POST",
      headers: { cookie: owner.cookie },
    });

    if (!joinResponse.ok && joinResponse.status !== 409) {
      const joinBody = await parseJson(joinResponse);
      throw new Error(
        `Owner join failed: ${joinResponse.status} ${JSON.stringify(joinBody)}`,
      );
    }
  }

  return match.id;
}

async function joinRoom(
  baseUrl: string,
  user: AuthenticatedUser,
  roomId: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: { cookie: user.cookie },
  });

  if (!response.ok && response.status !== 409) {
    const body = await parseJson(response);
    throw new Error(
      `Join failed for ${user.username}: ${response.status} ${JSON.stringify(body)}`,
    );
  }
}

async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarizeLatencies(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    count: values.length,
    minMs: sorted[0] ?? 0,
    avgMs: values.length > 0 ? sum / values.length : 0,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

function createSocketConnection(
  baseUrl: string,
  cookie: string,
  timeoutMs: number,
): Promise<{ socket: Socket; connectedInMs: number }> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const socket = io(baseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      extraHeaders: { cookie },
      forceNew: true,
    });

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Socket connect timeout"));
    }, timeoutMs);

    socket.on("connect", () => {
      clearTimeout(timeout);
      resolve({
        socket,
        connectedInMs: performance.now() - startedAt,
      });
    });

    socket.on("connect_error", (error) => {
      clearTimeout(timeout);
      socket.close();
      reject(error);
    });
  });
}

async function waitForDelivery(
  sockets: Socket[],
  expectedRecipients: number,
  content: string,
  roomId: string,
  timeoutMs: number,
): Promise<number> {
  return await new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let remaining = expectedRecipients;
    const seen = new Set<string>();
    const cleanupCallbacks: Array<() => void> = [];

    const timer = setTimeout(() => {
      cleanupCallbacks.forEach((cleanup) => cleanup());
      reject(
        new Error(
          `Delivery timeout for "${content}" (${expectedRecipients - remaining}/${expectedRecipients} received)`,
        ),
      );
    }, timeoutMs);

    for (const socket of sockets) {
      const handler = (message: MessagePayload) => {
        if (message.roomId !== roomId || message.content !== content) {
          return;
        }

        const socketId = socket.id;

        if (!socketId || seen.has(socketId)) {
          return;
        }

        seen.add(socketId);
        remaining -= 1;

        if (remaining === 0) {
          clearTimeout(timer);
          cleanupCallbacks.forEach((cleanup) => cleanup());
          resolve(performance.now() - startedAt);
        }
      };

      socket.on("message:new", handler);
      cleanupCallbacks.push(() => socket.off("message:new", handler));
    }
  });
}

async function sendMeasuredMessage(
  sender: Socket,
  listeners: Socket[],
  roomId: string,
  content: string,
  timeoutMs: number,
) {
  const ackStartedAt = performance.now();
  const deliveryPromise = waitForDelivery(
    listeners,
    listeners.length,
    content,
    roomId,
    timeoutMs,
  );

  const ackLatencyMs = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Ack timeout for "${content}"`));
    }, timeoutMs);

    sender.emit("message:send", { roomId, content }, (response: { error?: string }) => {
      clearTimeout(timer);
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(performance.now() - ackStartedAt);
    });
  });

  const deliveryLatencyMs = listeners.length > 0 ? await deliveryPromise : 0;

  return {
    ackLatencyMs,
    deliveryLatencyMs,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log("Load test options:");
  console.log(JSON.stringify(options, null, 2));

  const credentials = Array.from({ length: options.users }, (_, index) => ({
    email: `${options.prefix}-${index + 1}@example.com`,
    username: `${options.prefix}_${index + 1}`,
    password: options.password,
  }));

  const authenticatedUsers: AuthenticatedUser[] = new Array(options.users);

  console.log(`Authenticating ${options.users} users...`);
  await withConcurrency(credentials, options.concurrency, async (credential, index) => {
    authenticatedUsers[index] = await registerOrLogin(options.baseUrl, credential);
  });

  const roomId = await ensureRoom(
    options.baseUrl,
    authenticatedUsers[0],
    options.roomName,
  );
  console.log(`Using room ${options.roomName} (${roomId})`);

  console.log("Ensuring room membership...");
  await withConcurrency(
    authenticatedUsers,
    options.concurrency,
    async (user) => joinRoom(options.baseUrl, user, roomId),
  );

  console.log("Connecting sockets...");
  const socketResults: Array<{ socket: Socket; connectedInMs: number }> = new Array(
    authenticatedUsers.length,
  );
  await withConcurrency(
    authenticatedUsers,
    options.concurrency,
    async (user, index) => {
      socketResults[index] = await createSocketConnection(
        options.baseUrl,
        user.cookie,
        options.timeoutMs,
      );
    },
  );

  const sockets = socketResults.map((result) => result.socket);
  const connectSummary = summarizeLatencies(
    socketResults.map((result) => result.connectedInMs),
  );

  console.log("Connect summary:");
  console.log(JSON.stringify(connectSummary, null, 2));

  const ackLatencies: number[] = [];
  const deliveryLatencies: number[] = [];
  const senderCount = Math.min(options.senders, sockets.length);

  console.log(
    `Sending ${options.messagesPerSender} messages from ${senderCount} sender(s)...`,
  );

  for (let senderIndex = 0; senderIndex < senderCount; senderIndex += 1) {
    const senderSocket = sockets[senderIndex];
    const recipientSockets = sockets.filter((_, index) => index !== senderIndex);

    for (let messageIndex = 0; messageIndex < options.messagesPerSender; messageIndex += 1) {
      const content = `load-test sender=${senderIndex + 1} message=${messageIndex + 1} ts=${Date.now()}`;
      const result = await sendMeasuredMessage(
        senderSocket,
        recipientSockets,
        roomId,
        content,
        options.timeoutMs,
      );

      ackLatencies.push(result.ackLatencyMs);
      deliveryLatencies.push(result.deliveryLatencyMs);
    }
  }

  const ackSummary = summarizeLatencies(ackLatencies);
  const deliverySummary = summarizeLatencies(deliveryLatencies);

  console.log("Message ack summary:");
  console.log(JSON.stringify(ackSummary, null, 2));

  console.log("Message delivery summary:");
  console.log(JSON.stringify(deliverySummary, null, 2));

  console.log("Done.");

  for (const socket of sockets) {
    socket.close();
  }
}

main().catch((error: unknown) => {
  console.error("Load test failed:", error);
  process.exit(1);
});
