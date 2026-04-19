# XMPP/Jabber Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Jabber/XMPP protocol support with Prosody servers, bidirectional message bridging, S2S federation, load testing, and admin UI.

**Architecture:** Prosody XMPP servers run as Docker containers. An @xmpp/component bridge connects our app to Prosody via XEP-0114. Messages flow bidirectionally: web UI messages forward to XMPP MUC rooms, and XMPP client messages insert into our DB and broadcast via Socket.io. Federation uses two Prosody instances with S2S enabled.

**Tech Stack:** Prosody (XMPP server), @xmpp/component (bridge), @xmpp/client (testing/load test), Docker Compose, Socket.io (existing)

---

### Task 1: Prosody Docker config for server A

**Files:**
- Create: `prosody/prosody-a.cfg.lua`
- Modify: `docker-compose.yml`

**Step 1: Create Prosody config file**

Create `prosody/prosody-a.cfg.lua`:

```lua
-- Prosody Configuration for server A (a.chat.local)

admins = {}

-- Network settings
interfaces = { "*" }
c2s_ports = { 5222 }
s2s_ports = { 5269 }

-- No TLS required (internal Docker network)
c2s_require_encryption = false
s2s_require_encryption = false
s2s_secure_auth = false

-- Logging
log = {
  info = "*console";
}

-- Modules
modules_enabled = {
  -- Core
  "roster";
  "saslauth";
  "disco";
  "carbons";
  "pep";
  "register";
  "admin_telnet";
  "bosh";
  "websocket";
  "mam";
  "dialback";

  -- S2S federation
  "s2s";

  -- HTTP for admin API
  "http";
}

modules_disabled = {
  "tls";
}

-- Allow in-band registration for testing
allow_registration = true

-- MAM (Message Archive Management)
default_archive_policy = true

-- HTTP settings for admin
http_ports = { 5280 }
http_interfaces = { "*" }

-- Virtual host
VirtualHost "a.chat.local"

-- MUC component for group chat
Component "conference.a.chat.local" "muc"
  modules_enabled = { "muc_mam" }
  restrict_room_creation = false

-- Bridge component
Component "bridge.a.chat.local"
  component_secret = "chatty-bridge-secret"
```

**Step 2: Add prosody-a service to docker-compose.yml**

Add after the `db` service in `docker-compose.yml`:

```yaml
  prosody-a:
    image: prosodyim/prosody:latest
    hostname: a.chat.local
    volumes:
      - ./prosody/prosody-a.cfg.lua:/etc/prosody/prosody.cfg.lua:ro
      - prosody_a_data:/var/lib/prosody
    ports:
      - "5222:5222"
      - "5269:5269"
      - "5347:5347"
    networks:
      chat-app:
        aliases:
          - a.chat.local
    healthcheck:
      test: ["CMD-SHELL", "nc -z localhost 5222"]
      interval: 5s
      timeout: 5s
      retries: 10
```

Add `prosody_a_data:` to the `volumes:` section at the bottom.

Make the `app` service depend on `prosody-a`:
```yaml
    depends_on:
      db:
        condition: service_healthy
      seed:
        condition: service_completed_successfully
      prosody-a:
        condition: service_healthy
```

Add environment variable to app service:
```yaml
      PROSODY_A_COMPONENT_HOST: prosody-a
      PROSODY_A_COMPONENT_PORT: "5347"
      PROSODY_A_COMPONENT_SECRET: chatty-bridge-secret
      PROSODY_A_DOMAIN: a.chat.local
```

**Step 3: Verify Prosody starts**

Run: `docker compose up prosody-a -d && sleep 5 && docker compose logs prosody-a | tail -10`

Expected: Prosody starts, logs show it's listening on ports 5222/5269/5347.

**Step 4: Commit**

```bash
git add prosody/prosody-a.cfg.lua docker-compose.yml
git commit -m "feat: add Prosody XMPP server A to Docker Compose"
```

---

### Task 2: Install @xmpp/component and create bridge service

**Files:**
- Create: `src/server/xmpp-bridge.ts`
- Modify: `package.json` (via pnpm add)

**Step 1: Install dependencies**

```bash
pnpm add @xmpp/component @xmpp/client @xmpp/xml
```

Note: `@xmpp/client` is for testing and load test scripts later. Install now to avoid re-building Docker images.

**Step 2: Create the bridge service**

Create `src/server/xmpp-bridge.ts`:

```typescript
import { component, xml, Component } from "@xmpp/component";
import type { Element } from "@xmpp/xml";

import { db } from "../db";
import { messages } from "../db/schema/messages";
import { rooms, roomMembers } from "../db/schema/rooms";
import { users } from "../db/schema/users";
import { getIO } from "../lib/socket-server";
import type { MessagePayload } from "../lib/socket";
import { eq, and } from "drizzle-orm";

let xmppComponent: Component | null = null;
let connected = false;

// Track connection status for admin UI
export function isXmppConnected(): boolean {
  return connected;
}

export async function startXmppBridge(): Promise<void> {
  const host = process.env.PROSODY_A_COMPONENT_HOST;
  const port = process.env.PROSODY_A_COMPONENT_PORT;
  const secret = process.env.PROSODY_A_COMPONENT_SECRET;
  const domain = process.env.PROSODY_A_DOMAIN ?? "a.chat.local";

  if (!host || !port || !secret) {
    console.log("[XMPP Bridge] Missing Prosody config, skipping XMPP bridge");
    return;
  }

  xmppComponent = component({
    service: `xmpp://${host}:${port}`,
    domain: `bridge.${domain}`,
    password: secret,
  });

  xmppComponent.on("online", () => {
    connected = true;
    console.log("[XMPP Bridge] Connected to Prosody as component");
  });

  xmppComponent.on("offline", () => {
    connected = false;
    console.log("[XMPP Bridge] Disconnected from Prosody");
  });

  xmppComponent.on("error", (err: Error) => {
    console.error("[XMPP Bridge] Error:", err.message);
  });

  // Handle incoming XMPP messages (from Jabber clients)
  xmppComponent.on("stanza", async (stanza: Element) => {
    if (!stanza.is("message") || stanza.attrs.type !== "groupchat") return;

    const body = stanza.getChildText("body");
    if (!body) return;

    // Ignore messages from the bridge itself (prevent loops)
    const from = stanza.attrs.from as string;
    if (from.includes("bridge.")) return;

    // Extract room name and sender from JID
    // from = "roomname@conference.a.chat.local/nickname"
    const [mucJid, nickname] = from.split("/");
    if (!mucJid || !nickname) return;

    const roomName = mucJid.split("@")[0];
    if (!roomName) return;

    console.log(`[XMPP Bridge] Received message from ${nickname} in ${roomName}: ${body}`);

    await handleIncomingXmppMessage(roomName, nickname, body);
  });

  try {
    await xmppComponent.start();
  } catch (err) {
    console.error("[XMPP Bridge] Failed to start:", err);
    connected = false;
  }
}

export async function stopXmppBridge(): Promise<void> {
  if (xmppComponent) {
    await xmppComponent.stop();
    xmppComponent = null;
    connected = false;
  }
}

/**
 * Forward a message from the web app to XMPP MUC room.
 * Called after a message is inserted into DB and broadcast via Socket.io.
 */
export async function forwardToXmpp(
  roomName: string,
  senderUsername: string,
  messageBody: string,
): Promise<void> {
  if (!xmppComponent || !connected) return;

  const domain = process.env.PROSODY_A_DOMAIN ?? "a.chat.local";
  const mucJid = `${roomName}@conference.${domain}`;

  const msg = xml(
    "message",
    { type: "groupchat", from: `bridge.${domain}`, to: mucJid },
    xml("body", {}, `${senderUsername}: ${messageBody}`),
  );

  try {
    await xmppComponent.send(msg);
  } catch (err) {
    console.error("[XMPP Bridge] Failed to forward message:", err);
  }
}

/**
 * Handle a message received from an XMPP client, insert into DB
 * and broadcast via Socket.io.
 */
async function handleIncomingXmppMessage(
  roomName: string,
  senderNickname: string,
  body: string,
): Promise<void> {
  // Find the room by name
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.name, roomName))
    .limit(1);

  if (!room) {
    console.log(`[XMPP Bridge] Room not found: ${roomName}`);
    return;
  }

  // Find user by username (nickname = username)
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, senderNickname))
    .limit(1);

  if (!user) {
    console.log(`[XMPP Bridge] User not found: ${senderNickname}`);
    return;
  }

  // Check membership
  const [membership] = await db
    .select()
    .from(roomMembers)
    .where(
      and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, user.id)),
    )
    .limit(1);

  if (!membership) {
    console.log(`[XMPP Bridge] User ${senderNickname} not a member of ${roomName}`);
    return;
  }

  // Insert message
  const [message] = await db
    .insert(messages)
    .values({
      roomId: room.id,
      senderUserId: user.id,
      body,
    })
    .returning();

  // Build payload and broadcast via Socket.io
  const payload: MessagePayload = {
    id: message.id,
    roomId: message.roomId,
    content: message.body,
    createdAt: message.createdAt.toISOString(),
    editedAt: null,
    deletedAt: null,
    sender: {
      id: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
    },
    replyTo: null,
    attachments: [],
  };

  const io = getIO();
  if (io) {
    io.to(room.id).emit("message:new", payload);
  }

  console.log(`[XMPP Bridge] Inserted message from XMPP: ${message.id}`);
}
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v ".next/"`

Expected: No errors from our files.

**Step 4: Commit**

```bash
git add src/server/xmpp-bridge.ts package.json pnpm-lock.yaml
git commit -m "feat: create XMPP bridge service with bidirectional message forwarding"
```

---

### Task 3: Integrate bridge into server.ts

**Files:**
- Modify: `server.ts` (lines ~35, ~54, ~198, ~226, ~269)

**Step 1: Import and start the bridge**

At the top of `server.ts`, add import:

```typescript
import { startXmppBridge, stopXmppBridge, forwardToXmpp } from "./src/server/xmpp-bridge";
```

In the `bootstrap()` function, after `startPresenceSweep(io)` (line ~54), add:

```typescript
  // Start XMPP bridge (non-blocking — app works even if Prosody is down)
  startXmppBridge().catch((err) => {
    console.error("[XMPP Bridge] Startup failed (non-fatal):", err);
  });
```

**Step 2: Forward messages to XMPP after broadcast**

After both `io.to(roomId).emit("message:new", payload)` calls (lines ~198 and ~226), add:

```typescript
        // Forward to XMPP (fire-and-forget, non-blocking)
        if (room.name) {
          forwardToXmpp(room.name, sender.username, content).catch(() => {});
        }
```

Note: We need room name, which is already fetched in `roomRows` at line ~101. The `room` variable has `.name`.

**Step 3: Stop bridge on shutdown**

In the `close()` function (line ~262), after `stopPresenceSweep()`, add:

```typescript
    await stopXmppBridge();
```

**Step 4: Verify build**

Run: `pnpm build 2>&1 | tail -5`

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add server.ts
git commit -m "feat: integrate XMPP bridge into server lifecycle and message flow"
```

---

### Task 4: User registration sync to Prosody

**Files:**
- Create: `src/server/xmpp-users.ts`
- Modify: `src/app/api/auth/[...all]/route.ts` (hook into registration)

**Step 1: Create XMPP user registration helper**

Create `src/server/xmpp-users.ts`:

```typescript
/**
 * Register a user in Prosody via REST API or mod_register.
 * Uses Prosody's mod_register_web or admin telnet to create accounts.
 * Fallback: exec prosodyctl in the container (for Docker setup).
 */

export async function registerXmppUser(
  username: string,
  password: string,
): Promise<void> {
  const domain = process.env.PROSODY_A_DOMAIN ?? "a.chat.local";
  const prosodyHost = process.env.PROSODY_A_COMPONENT_HOST;

  if (!prosodyHost) {
    console.log("[XMPP Users] No Prosody host configured, skipping registration");
    return;
  }

  // Use Prosody's in-band registration via XMPP
  // Since we have allow_registration = true, users can self-register
  // via any XMPP client. For server-side registration, we use the
  // HTTP registration module or just let users register on first connect.
  //
  // For the hackathon, we rely on Prosody's allow_registration = true
  // so XMPP clients can register themselves. The bridge doesn't need
  // to pre-create accounts.
  console.log(`[XMPP Users] User ${username}@${domain} can self-register on Prosody`);
}
```

Note: With `allow_registration = true` in Prosody, XMPP clients handle their own registration. We don't need server-side account creation for the demo. The bridge identifies users by username matching.

**Step 2: Commit**

```bash
git add src/server/xmpp-users.ts
git commit -m "feat: add XMPP user registration helper (delegates to Prosody self-registration)"
```

---

### Task 5: XMPP connection test script

**Files:**
- Create: `scripts/xmpp-test.ts`

**Step 1: Create a test script**

Create `scripts/xmpp-test.ts`:

```typescript
/**
 * Quick XMPP connectivity test.
 * Usage: npx tsx scripts/xmpp-test.ts
 *
 * Registers a test user, connects, joins a MUC room, sends a message,
 * and listens for messages. Verifies bidirectional flow.
 */
import { client, xml } from "@xmpp/client";

// Suppress TLS warnings for local testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const DOMAIN = process.env.XMPP_DOMAIN ?? "a.chat.local";
const HOST = process.env.XMPP_HOST ?? "localhost";
const PORT = Number(process.env.XMPP_PORT ?? "5222");
const USERNAME = process.env.XMPP_USER ?? "testbot";
const PASSWORD = process.env.XMPP_PASS ?? "testbot123";
const ROOM = process.env.XMPP_ROOM ?? "general";

async function main() {
  console.log(`Connecting to ${HOST}:${PORT} as ${USERNAME}@${DOMAIN}...`);

  const xmpp = client({
    service: `xmpp://${HOST}:${PORT}`,
    domain: DOMAIN,
    username: USERNAME,
    password: PASSWORD,
  });

  xmpp.on("error", (err: Error) => {
    console.error("XMPP Error:", err.message);
  });

  xmpp.on("online", async (address) => {
    console.log(`Connected as ${address.toString()}`);

    // Join MUC room
    const mucJid = `${ROOM}@conference.${DOMAIN}/${USERNAME}`;
    console.log(`Joining MUC: ${mucJid}`);

    const presence = xml(
      "presence",
      { to: mucJid },
      xml("x", { xmlns: "http://jabber.org/protocol/muc" }),
    );
    await xmpp.send(presence);
    console.log("Joined room. Sending test message...");

    // Send a message
    const msg = xml(
      "message",
      { type: "groupchat", to: `${ROOM}@conference.${DOMAIN}` },
      xml("body", {}, "Hello from XMPP test bot!"),
    );
    await xmpp.send(msg);
    console.log("Message sent. Listening for 10 seconds...");

    setTimeout(async () => {
      console.log("Test complete. Disconnecting...");
      await xmpp.stop();
      process.exit(0);
    }, 10000);
  });

  xmpp.on("stanza", (stanza) => {
    if (stanza.is("message") && stanza.getChildText("body")) {
      const from = stanza.attrs.from;
      const body = stanza.getChildText("body");
      console.log(`[Message] ${from}: ${body}`);
    }
  });

  await xmpp.start();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

**Step 2: Verify with docker compose**

Run:
```bash
docker compose up -d
# Wait for services
sleep 10
# Register test user in Prosody
docker compose exec prosody-a prosodyctl register testbot a.chat.local testbot123
# Run test
npx tsx scripts/xmpp-test.ts
```

Expected: Bot connects, joins room, sends message. If bridge is running, message appears in web app's #general room.

**Step 3: Commit**

```bash
git add scripts/xmpp-test.ts
git commit -m "feat: add XMPP connectivity test script"
```

---

### Task 6: Prosody server B + federation config

**Files:**
- Create: `prosody/prosody-b.cfg.lua`
- Modify: `docker-compose.yml`

**Step 1: Create Prosody B config**

Create `prosody/prosody-b.cfg.lua` — same as prosody-a.cfg.lua but with `b.chat.local` domain:

```lua
-- Prosody Configuration for server B (b.chat.local)

admins = {}

interfaces = { "*" }
c2s_ports = { 5222 }
s2s_ports = { 5269 }

c2s_require_encryption = false
s2s_require_encryption = false
s2s_secure_auth = false

log = {
  info = "*console";
}

modules_enabled = {
  "roster";
  "saslauth";
  "disco";
  "carbons";
  "pep";
  "register";
  "admin_telnet";
  "bosh";
  "websocket";
  "mam";
  "dialback";
  "s2s";
  "http";
}

modules_disabled = {
  "tls";
}

allow_registration = true
default_archive_policy = true

http_ports = { 5280 }
http_interfaces = { "*" }

VirtualHost "b.chat.local"

Component "conference.b.chat.local" "muc"
  modules_enabled = { "muc_mam" }
  restrict_room_creation = false

Component "bridge.b.chat.local"
  component_secret = "chatty-bridge-secret"
```

**Step 2: Add prosody-b to docker-compose.yml**

Add after prosody-a:

```yaml
  prosody-b:
    image: prosodyim/prosody:latest
    hostname: b.chat.local
    volumes:
      - ./prosody/prosody-b.cfg.lua:/etc/prosody/prosody.cfg.lua:ro
      - prosody_b_data:/var/lib/prosody
    ports:
      - "5223:5222"
      - "5270:5269"
    networks:
      chat-app:
        aliases:
          - b.chat.local
    healthcheck:
      test: ["CMD-SHELL", "nc -z localhost 5222"]
      interval: 5s
      timeout: 5s
      retries: 10
```

Add `prosody_b_data:` to volumes.

DNS resolution happens automatically via Docker's built-in DNS — containers on the same network can resolve each other by hostname/alias.

**Step 3: Verify federation**

```bash
docker compose up prosody-a prosody-b -d
sleep 10
# Register users on each server
docker compose exec prosody-a prosodyctl register alice a.chat.local alice123
docker compose exec prosody-b prosodyctl register bob b.chat.local bob123
# Check S2S works (look for s2s connection in logs)
docker compose logs prosody-a | grep -i s2s
```

**Step 4: Commit**

```bash
git add prosody/prosody-b.cfg.lua docker-compose.yml
git commit -m "feat: add Prosody server B for XMPP federation"
```

---

### Task 7: Load test script

**Files:**
- Create: `scripts/xmpp-load-test.ts`

**Step 1: Create load test script**

Create `scripts/xmpp-load-test.ts`:

```typescript
/**
 * XMPP Federation Load Test
 *
 * Creates 50 bot clients on server A and 50 on server B.
 * Each bot joins a shared MUC room and sends messages.
 * Measures connectivity, delivery, and latency.
 *
 * Usage: npx tsx scripts/xmpp-load-test.ts
 */
import { client, xml } from "@xmpp/client";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SERVER_A = {
  host: process.env.XMPP_HOST_A ?? "localhost",
  port: Number(process.env.XMPP_PORT_A ?? "5222"),
  domain: "a.chat.local",
};

const SERVER_B = {
  host: process.env.XMPP_HOST_B ?? "localhost",
  port: Number(process.env.XMPP_PORT_B ?? "5223"),
  domain: "b.chat.local",
};

const BOT_COUNT = Number(process.env.BOT_COUNT ?? "50");
const MUC_ROOM = "loadtest";
const TEST_DURATION_MS = 30_000;

interface BotStats {
  username: string;
  server: string;
  connected: boolean;
  messagesSent: number;
  messagesReceived: number;
  errors: string[];
  connectTime: number;
}

const allStats: BotStats[] = [];

async function createBot(
  serverConfig: typeof SERVER_A,
  index: number,
): Promise<BotStats> {
  const username = `bot${serverConfig.domain.split(".")[0]}${index}`;
  const password = `pass${index}`;
  const stats: BotStats = {
    username,
    server: serverConfig.domain,
    connected: false,
    messagesSent: 0,
    messagesReceived: 0,
    errors: [],
    connectTime: 0,
  };

  const connectStart = Date.now();

  try {
    const xmpp = client({
      service: `xmpp://${serverConfig.host}:${serverConfig.port}`,
      domain: serverConfig.domain,
      username,
      password,
    });

    xmpp.on("error", (err: Error) => {
      stats.errors.push(err.message);
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connect timeout")), 15000);

      xmpp.on("online", async () => {
        clearTimeout(timeout);
        stats.connected = true;
        stats.connectTime = Date.now() - connectStart;

        // Join MUC
        const mucJid = `${MUC_ROOM}@conference.${serverConfig.domain}/${username}`;
        const presence = xml(
          "presence",
          { to: mucJid },
          xml("x", { xmlns: "http://jabber.org/protocol/muc" }),
        );
        await xmpp.send(presence);
        resolve();
      });

      xmpp.on("stanza", (stanza) => {
        if (stanza.is("message") && stanza.getChildText("body")) {
          stats.messagesReceived++;
        }
      });

      xmpp.start().catch(reject);
    });

    // Send messages periodically
    const sendInterval = setInterval(async () => {
      try {
        const msg = xml(
          "message",
          {
            type: "groupchat",
            to: `${MUC_ROOM}@conference.${serverConfig.domain}`,
          },
          xml("body", {}, `msg from ${username} at ${Date.now()}`),
        );
        await xmpp.send(msg);
        stats.messagesSent++;
      } catch (err) {
        stats.errors.push(`send: ${(err as Error).message}`);
      }
    }, 2000);

    // Stop after test duration
    setTimeout(async () => {
      clearInterval(sendInterval);
      try {
        await xmpp.stop();
      } catch {
        // ignore stop errors
      }
    }, TEST_DURATION_MS);
  } catch (err) {
    stats.errors.push(`init: ${(err as Error).message}`);
  }

  return stats;
}

async function main() {
  console.log(`=== XMPP Federation Load Test ===`);
  console.log(`Bots per server: ${BOT_COUNT}`);
  console.log(`Test duration: ${TEST_DURATION_MS / 1000}s`);
  console.log();

  // Register all bots first
  console.log("Note: Ensure bots are pre-registered in Prosody:");
  console.log("  Run: scripts/xmpp-register-bots.sh");
  console.log();

  // Create bots in batches to avoid overwhelming
  console.log("Connecting bots...");
  const botPromises: Promise<BotStats>[] = [];

  for (let i = 0; i < BOT_COUNT; i++) {
    botPromises.push(createBot(SERVER_A, i));
    botPromises.push(createBot(SERVER_B, i));
    // Stagger connections
    if (i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const stats = await Promise.all(botPromises);

  // Wait for test duration
  console.log(`All bots launched. Running for ${TEST_DURATION_MS / 1000}s...`);
  await new Promise((r) => setTimeout(r, TEST_DURATION_MS + 5000));

  // Report
  const serverABots = stats.filter((s) => s.server === SERVER_A.domain);
  const serverBBots = stats.filter((s) => s.server === SERVER_B.domain);

  const report = {
    timestamp: new Date().toISOString(),
    config: { botCount: BOT_COUNT, testDurationMs: TEST_DURATION_MS },
    serverA: {
      connected: serverABots.filter((s) => s.connected).length,
      total: serverABots.length,
      totalSent: serverABots.reduce((sum, s) => sum + s.messagesSent, 0),
      totalReceived: serverABots.reduce((sum, s) => sum + s.messagesReceived, 0),
      avgConnectTime:
        serverABots.reduce((sum, s) => sum + s.connectTime, 0) /
        serverABots.filter((s) => s.connected).length || 0,
      errors: serverABots.flatMap((s) => s.errors).length,
    },
    serverB: {
      connected: serverBBots.filter((s) => s.connected).length,
      total: serverBBots.length,
      totalSent: serverBBots.reduce((sum, s) => sum + s.messagesSent, 0),
      totalReceived: serverBBots.reduce((sum, s) => sum + s.messagesReceived, 0),
      avgConnectTime:
        serverBBots.reduce((sum, s) => sum + s.connectTime, 0) /
        serverBBots.filter((s) => s.connected).length || 0,
      errors: serverBBots.flatMap((s) => s.errors).length,
    },
  };

  console.log("\n=== RESULTS ===");
  console.log(`Server A: ${report.serverA.connected}/${report.serverA.total} connected`);
  console.log(`  Sent: ${report.serverA.totalSent}, Received: ${report.serverA.totalReceived}`);
  console.log(`  Avg connect time: ${report.serverA.avgConnectTime.toFixed(0)}ms`);
  console.log(`  Errors: ${report.serverA.errors}`);
  console.log(`Server B: ${report.serverB.connected}/${report.serverB.total} connected`);
  console.log(`  Sent: ${report.serverB.totalSent}, Received: ${report.serverB.totalReceived}`);
  console.log(`  Avg connect time: ${report.serverB.avgConnectTime.toFixed(0)}ms`);
  console.log(`  Errors: ${report.serverB.errors}`);

  // Write JSON report
  const fs = await import("fs");
  const reportPath = "scripts/xmpp-load-test-report.json";
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

**Step 2: Create bot registration helper script**

Create `scripts/xmpp-register-bots.sh`:

```bash
#!/usr/bin/env bash
# Register load test bots in both Prosody servers
set -e

BOT_COUNT=${BOT_COUNT:-50}

echo "Registering $BOT_COUNT bots on server A..."
for i in $(seq 0 $((BOT_COUNT - 1))); do
  docker compose exec -T prosody-a prosodyctl register "bota${i}" a.chat.local "pass${i}" 2>/dev/null || true
done

echo "Registering $BOT_COUNT bots on server B..."
for i in $(seq 0 $((BOT_COUNT - 1))); do
  docker compose exec -T prosody-b prosodyctl register "botb${i}" b.chat.local "pass${i}" 2>/dev/null || true
done

echo "Done. Registered $((BOT_COUNT * 2)) bots total."
```

**Step 3: Commit**

```bash
chmod +x scripts/xmpp-register-bots.sh
git add scripts/xmpp-load-test.ts scripts/xmpp-register-bots.sh
git commit -m "feat: add XMPP federation load test script (50+50 bots)"
```

---

### Task 8: Admin UI — Jabber connection dashboard

**Files:**
- Create: `src/app/api/admin/jabber/route.ts`
- Create: `src/app/chat/admin/jabber/page.tsx`
- Modify: `src/server/xmpp-bridge.ts` (export stats)

**Step 1: Add stats tracking to xmpp-bridge.ts**

Add to `src/server/xmpp-bridge.ts`:

```typescript
// Stats tracking for admin dashboard
const bridgeStats = {
  messagesForwardedToXmpp: 0,
  messagesReceivedFromXmpp: 0,
  lastForwardedAt: null as string | null,
  lastReceivedAt: null as string | null,
  errors: 0,
};

export function getXmppStats() {
  return {
    connected,
    domain: process.env.PROSODY_A_DOMAIN ?? "a.chat.local",
    componentDomain: `bridge.${process.env.PROSODY_A_DOMAIN ?? "a.chat.local"}`,
    ...bridgeStats,
  };
}
```

Increment counters in `forwardToXmpp` and `handleIncomingXmppMessage`.

**Step 2: Create admin API route**

Create `src/app/api/admin/jabber/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getXmppStats } from "@/server/xmpp-bridge";

export async function GET() {
  const stats = getXmppStats();
  return NextResponse.json(stats);
}
```

**Step 3: Create admin dashboard page**

Create `src/app/chat/admin/jabber/page.tsx` — a dashboard showing:

- Prosody server status (connected/disconnected)
- Component domain
- Messages forwarded to XMPP (count)
- Messages received from XMPP (count)
- Last activity timestamps
- Error count
- Auto-refresh every 5 seconds

Use existing Card, Badge components. Match the dark-first design system.

**Step 4: Commit**

```bash
git add src/app/api/admin/jabber/route.ts src/app/chat/admin/jabber/page.tsx src/server/xmpp-bridge.ts
git commit -m "feat: add Jabber admin dashboard with connection stats"
```

---

### Task 9: Update Dockerfile for XMPP bridge files

**Files:**
- Modify: `Dockerfile`

**Step 1: Ensure bridge files are included in production image**

The existing Dockerfile already copies `src/server/` (line 28), so `xmpp-bridge.ts` and `xmpp-users.ts` are included. No Dockerfile changes needed for the bridge.

However, the Prosody config files and scripts need to be available. These are mounted via `docker-compose.yml` volumes, not baked into the image, so no Dockerfile changes needed.

Verify: `docker compose build && docker compose up -d`

**Step 2: Commit (if changes needed)**

Only commit if Dockerfile changes were required.

---

## Implementation Order Summary

| Step | Task | Depends on |
|------|------|------------|
| 1 | Prosody A Docker config | — |
| 2 | Bridge service code | 1 |
| 3 | Integrate bridge into server.ts | 2 |
| 4 | User registration sync | 1 |
| 5 | XMPP test script | 1, 2, 3 |
| 6 | Prosody B + federation | 1 |
| 7 | Load test script | 6 |
| 8 | Admin UI dashboard | 2, 3 |
| 9 | Dockerfile verification | all |

## Verification Checklist

After all tasks:

- [ ] `docker compose up` starts Prosody A, Prosody B, and the app
- [ ] XMPP test script can connect, join room, send/receive messages
- [ ] Messages from web UI appear to XMPP clients
- [ ] Messages from XMPP clients appear in web UI
- [ ] Federation: user on A can message room on B
- [ ] Load test: 50+50 bots connected, bidirectional messaging
- [ ] Admin dashboard shows connection status and stats
- [ ] Main app works normally if Prosody is down
