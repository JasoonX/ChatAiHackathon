/**
 * Seed script — populates the database with realistic demo data.
 *
 *   pnpm db:seed           # no-op if alice already exists
 *   pnpm db:seed --force   # truncate everything and re-seed
 */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";

import { hashPassword } from "better-auth/crypto";

import { db, postgresClient } from "./index";
import { friendRequests, friendships } from "./schema/friends";
import { attachments, messages } from "./schema/messages";
import { roomMembers, rooms } from "./schema/rooms";
import { accounts, users } from "./schema/users";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPLOADS_DIR = join(process.cwd(), "uploads");

// Minimal valid 1×1 transparent PNG (68 bytes).
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SeedUser = { id: string; username: string };

/** Canonical pairKey identical to server/friends.ts#getFriendPairKey. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function dmKey(a: string, b: string): string {
  return `dm:${pairKey(a, b)}`;
}

const STRESS_BATCH_SIZE = 500;
const STRESS_MESSAGE_COUNT = 10_000;

/** Timestamp `days` days + `h` hours + `m` minutes in the past. */
function ago(days: number, h = 0, m = 0): Date {
  return new Date(Date.now() - (days * 86_400 + h * 3_600 + m * 60) * 1_000);
}

async function createUser(
  username: string,
  email: string,
  password: string,
): Promise<SeedUser> {
  const hashedPassword = await hashPassword(password);
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    name: username,
    email,
    emailVerified: true,
    username,
    displayUsername: username,
  });
  await db.insert(accounts).values({
    userId,
    accountId: userId,
    providerId: "credential",
    password: hashedPassword,
  });
  return { id: userId, username };
}

// ---------------------------------------------------------------------------
// Message specs
// ---------------------------------------------------------------------------

type MsgSpec = {
  by: SeedUser;
  text: string;
  at: Date;
  /** 0-based index into the already-inserted ID array of this room. */
  replyToIdx?: number;
};

function buildGeneralSpecs(
  alice: SeedUser,
  bob: SeedUser,
  carol: SeedUser,
  dave: SeedUser,
): MsgSpec[] {
  return [
    // ── Day 5: welcome ───────────────────────────────────────────────────────
    // idx 0
    { by: alice, text: "Hey everyone! Welcome to #general 👋 Glad to have the whole team here.", at: ago(5, 9, 0) },
    // idx 1
    { by: bob,   text: "Thanks! Excited to be building something real.", at: ago(5, 9, 3) },
    // idx 2
    { by: carol, text: "Hi all! Looking forward to shipping something amazing.", at: ago(5, 9, 5) },
    // idx 3
    { by: dave,  text: "hey! 🙌 ready to go", at: ago(5, 9, 7) },
    // idx 4
    { by: alice, text: "Stack overview: Next.js 15, Socket.IO for real-time, PostgreSQL with Drizzle ORM.", at: ago(5, 9, 10) },
    // idx 5
    { by: bob,   text: "Solid choices all around. Who's on auth?", at: ago(5, 9, 12) },
    // idx 6
    { by: alice, text: "Using better-auth. Handles sessions, email/password, and active session management out of the box.", at: ago(5, 9, 14) },
    // idx 7
    { by: carol, text: "What handles real-time? WebSockets directly?", at: ago(5, 9, 16) },
    // idx 8
    { by: alice, text: "Socket.IO — handles reconnections and multi-tab presence gracefully.", at: ago(5, 9, 18) },
    // idx 9
    { by: dave,  text: "nice. when do we actually start building?", at: ago(5, 9, 20) },
    // idx 10
    { by: alice, text: "Already started! Schema's in, first API routes are up. Check the repo.", at: ago(5, 9, 22) },

    // ── Day 4: architecture ──────────────────────────────────────────────────
    // idx 11
    { by: alice, text: "Morning! Finished the database schema — rooms, members, bans, invitations, attachments all modelled.", at: ago(4, 9, 0) },
    // idx 12
    { by: bob,   text: "How are you tracking multi-tab presence?", at: ago(4, 9, 5) },
    // idx 13
    { by: alice, text: "In-memory map: userId → Set<socketId>. Presence sweep runs every 5 s and emits to all clients.", at: ago(4, 9, 8) },
    // idx 14
    { by: bob,   text: "For a hackathon that's perfect. In production you'd reach for Redis pub/sub.", at: ago(4, 9, 11) },
    // idx 15
    { by: carol, text: "Do we have dark mode?", at: ago(4, 10, 0) },
    // idx 16
    { by: alice, text: "shadcn/ui has full theming. Dark mode is wired in 🌙", at: ago(4, 10, 2) },
    // idx 17
    { by: carol, text: "The sidebar looks really clean btw — nice UX.", at: ago(4, 10, 5) },
    // idx 18
    { by: alice, text: "Thanks! Still needs polish but the bones are good.", at: ago(4, 10, 7) },
    // idx 19
    { by: dave,  text: "are the cascading deletes set up? losing orphaned rows on room deletion would be rough", at: ago(4, 11, 0) },
    // idx 20
    { by: alice, text: "Yep. FK cascades on all child tables. Room deletion → wipes messages, attachments, memberships, bans.", at: ago(4, 11, 3) },
    // idx 21
    { by: bob,   text: "We should write integration tests for that to be sure.", at: ago(4, 11, 5) },
    // idx 22
    { by: alice, text: "Already on the list — tests will run against a real container DB.", at: ago(4, 11, 7) },

    // ── Day 3: features ──────────────────────────────────────────────────────
    // idx 23
    { by: alice, text: "Room bans are live! Banned users can't rejoin even from the public catalog.", at: ago(3, 9, 0) },
    // idx 24
    { by: bob,   text: "Tested it — works great. The immediate socket disconnect on ban is a nice touch.", at: ago(3, 9, 5) },
    // idx 25
    { by: carol, text: "Private rooms + invitations?", at: ago(3, 9, 10) },
    // idx 26
    { by: alice, text: "Done. Invitations arrive via socket — the bell badge lights up in real-time.", at: ago(3, 9, 13) },
    // idx 27
    { by: carol, text: "Just tested the invitation flow — notification bell works perfectly 🔔", at: ago(3, 9, 25) },
    // idx 28  ← alice calls out carol's bug catch
    { by: alice, text: "Great catch on that sidebar bug by the way, carol.", at: ago(3, 10, 2) },
    // idx 29  ← carol replies to idx 28
    { by: carol, text: "Which one?", at: ago(3, 10, 0), replyToIdx: 28 },
    // idx 30
    { by: alice, text: "Accepting an invitation wasn't updating the sidebar room list. Fixed with a query invalidation.", at: ago(3, 10, 4) },
    // idx 31
    { by: bob,   text: "What's still on the roadmap?", at: ago(3, 11, 0) },
    // idx 32
    { by: alice, text: "File attachments, active sessions UI, DM polish, and seed data for the demo.", at: ago(3, 11, 3) },
    // idx 33
    { by: bob,   text: "I can take file attachments if you want to keep rolling on the other stuff.", at: ago(3, 11, 6) },
    // idx 34
    { by: alice, text: "That would be amazing — go for it! 🙌", at: ago(3, 11, 8) },

    // ── Day 2: implementation ────────────────────────────────────────────────
    // idx 35
    { by: bob,   text: "File uploads are working! Images render inline, other files show a download card.", at: ago(2, 10, 0) },
    // idx 36
    { by: alice, text: "How are you handling storage?", at: ago(2, 10, 3) },
    // idx 37
    { by: bob,   text: "Local disk via Docker volume. UUID storage keys. Limits: 3 MB images, 20 MB other files.", at: ago(2, 10, 5) },
    // idx 38
    { by: carol, text: "Just uploaded a screenshot. Renders inline immediately — looks great 🎉", at: ago(2, 10, 18) },
    // idx 39  ← bob replies to dave's next message
    { by: dave,  text: "should we add a download button for inline images too?", at: ago(2, 10, 23) },
    // idx 40  ← reply to idx 39
    { by: bob,   text: "Already there 😄", at: ago(2, 10, 22), replyToIdx: 39 },
    // idx 41
    { by: alice, text: "You're on a roll, bob.", at: ago(2, 10, 25) },
    // idx 42
    { by: dave,  text: "awesome work", at: ago(2, 10, 27) },
    // idx 43
    { by: carol, text: "What about non-member access to room files?", at: ago(2, 11, 0) },
    // idx 44
    { by: alice, text: "Blocked at the API layer — /api/attachments/:id checks room membership before serving the file.", at: ago(2, 11, 3) },
    // idx 45
    { by: carol, text: "Exactly what I was hoping to hear 👍", at: ago(2, 11, 5) },

    // ── Day 1: polish ────────────────────────────────────────────────────────
    // idx 46
    { by: alice, text: "Active sessions UI is live. You can see all connected devices + IPs and revoke any of them remotely.", at: ago(1, 9, 0) },
    // idx 47
    { by: bob,   text: "Tested in two browsers — revoking a session kicks that tab out instantly via socket.", at: ago(1, 9, 5) },
    // idx 48
    { by: carol, text: "That is SO cool. Just killed my phone session from desktop 😂", at: ago(1, 9, 10) },
    // idx 49
    { by: alice, text: "Exactly the intended use case!", at: ago(1, 9, 12) },
    // idx 50  ← alice replies to this
    { by: bob,   text: "Should we prepare seed data for the demo?", at: ago(1, 10, 2) },
    // idx 51  ← reply to idx 50
    { by: alice, text: "Already on it — seeding the DB right now 🌱", at: ago(1, 10, 0), replyToIdx: 50 },
    // idx 52
    { by: bob,   text: "Perfect. Demo is at 2 pm sharp — everyone be online!", at: ago(1, 10, 5) },
    // idx 53
    { by: carol, text: "I'll be there 🙋", at: ago(1, 10, 7) },
    // idx 54
    { by: dave,  text: "same. looking good team!", at: ago(1, 10, 9) },
    // idx 55
    { by: alice, text: "Let's ship it 🚀", at: ago(1, 10, 11) },

    // ── Today: demo day ──────────────────────────────────────────────────────
    // idx 56
    { by: alice, text: "Morning everyone — demo day! 🎉 Final check: everything is green.", at: ago(0, 8, 0) },
    // idx 57
    { by: bob,   text: "Ready and caffeinated ☕ All systems go.", at: ago(0, 8, 5) },
    // idx 58
    { by: carol, text: "Let's GO!! 💪", at: ago(0, 8, 7) },
    // idx 59
    { by: dave,  text: "hyped. let's crush it", at: ago(0, 8, 10) },
    // idx 60
    { by: alice, text: "Real-time messaging ✅  Presence ✅  File uploads ✅  Sessions ✅  Friends & DMs ✅", at: ago(0, 8, 15) },
    // idx 61
    { by: bob,   text: "We built a lot in 47 hours. Genuinely impressed.", at: ago(0, 8, 17) },
    // idx 62
    { by: alice, text: "Proud of this team. Let's demo and let the work speak for itself 🚢", at: ago(0, 8, 20) },
  ];
}

function buildEngineeringSpecs(alice: SeedUser, bob: SeedUser): MsgSpec[] {
  return [
    // ── Day 5: socket auth ────────────────────────────────────────────────
    { by: alice, text: "Using this room for technical deep-dives — less noise than #general.", at: ago(5, 10, 0) },
    { by: bob,   text: "Good call. I want to talk through the socket auth middleware.", at: ago(5, 10, 5) },
    { by: alice, text: "The tricky part: better-auth stores `token.hash` in the cookie but only `token` in the sessions table.", at: ago(5, 10, 8) },
    { by: bob,   text: "So we split on '.' and take the first segment before the hash?", at: ago(5, 10, 10) },
    { by: alice, text: "Exactly. Took a while to figure that out from the source code.", at: ago(5, 10, 12) },
    { by: bob,   text: "Should document that with a comment — someone might 'clean it up' thinking it's a bug.", at: ago(5, 10, 14) },
    { by: alice, text: "Already done. See socket-auth.ts line 42 — there's a comment explaining the split.", at: ago(5, 10, 16) },

    // ── Day 4: DB cascades ────────────────────────────────────────────────
    { by: alice, text: "Spent time auditing the cascade rules. Everything from rooms cascades correctly.", at: ago(4, 9, 0) },
    { by: bob,   text: "FK cascades: room_members, room_bans, room_invitations, messages, attachments — all from rooms.id?", at: ago(4, 9, 3) },
    { by: alice, text: "Yes. And attachments cascade from messages.id too. Single DELETE on rooms handles the whole tree.", at: ago(4, 9, 6) },
    { by: bob,   text: "Smart. What about file cleanup? DB cascade won't touch the uploads folder.", at: ago(4, 9, 9) },
    { by: alice, text: "We collect storageKeys before the transaction, then delete files after it commits. Promise.allSettled so a missing file can't rollback.", at: ago(4, 9, 12) },
    { by: bob,   text: "Perfect pattern. Integration test for room deletion is on my list.", at: ago(4, 9, 15) },
    { by: alice, text: "Already written — uses testcontainers so it runs against a real Postgres.", at: ago(4, 9, 17) },

    // ── Day 3: presence ───────────────────────────────────────────────────
    { by: bob,   text: "Presence sweep fires every 5 seconds. Is that bandwidth-efficient?", at: ago(3, 11, 0) },
    { by: alice, text: "It only emits when a user's status changes, not every sweep. Diff-based broadcasting.", at: ago(3, 11, 3) },
    { by: bob,   text: "Ah nice. So quiet periods cost basically nothing.", at: ago(3, 11, 5) },
    { by: alice, text: "Right. Heartbeat from client every 20 s. AFK threshold: 60 s of no heartbeats.", at: ago(3, 11, 7) },
    { by: bob,   text: "Multi-tab: any tab sending a heartbeat keeps the user online.", at: ago(3, 11, 9) },
    { by: alice, text: "Exactly. addSocket/removeSocket track the full Set<socketId> per userId.", at: ago(3, 11, 11) },

    // ── Day 2: pagination ─────────────────────────────────────────────────
    { by: alice, text: "Message pagination is cursor-based. Cursor = (createdAt, id) — composite to handle ties.", at: ago(2, 9, 0) },
    { by: bob,   text: "Composite cursor avoids the classic offset drift when new messages arrive during load.", at: ago(2, 9, 3) },
    { by: alice, text: "Exactly. 30 messages per page, loaded via IntersectionObserver on the top sentinel.", at: ago(2, 9, 5) },
    { by: bob,   text: "30 feels right — fast enough to load, enough context without being overwhelming.", at: ago(2, 9, 7) },
    { by: alice, text: "We also reverse the query order server-side so oldest-first in the response. Simpler for the client.", at: ago(2, 9, 9) },
    { by: bob,   text: "Clean. And the user sees messages top-to-bottom naturally.", at: ago(2, 9, 11) },

    // ── Day 1: pre-demo ───────────────────────────────────────────────────
    { by: alice, text: "Are we demo-ready?", at: ago(1, 8, 0) },
    { by: bob,   text: "Ran the full demo flow twice. Solid — no crashes, no weird edge cases.", at: ago(1, 8, 5) },
    { by: alice, text: "Any rough edges worth knowing about?", at: ago(1, 8, 7) },
    { by: bob,   text: "Empty state on first login could use a welcome message. Minor — out of scope for today.", at: ago(1, 8, 9) },
    { by: alice, text: "Agreed. Anything blocking?", at: ago(1, 8, 11) },
    { by: bob,   text: "Nope. Code quality, real-time UX, and the auth model are all strong.", at: ago(1, 8, 13) },
    { by: alice, text: "Then we ship. Good work. 🚀", at: ago(1, 8, 15) },

    // ── Today ─────────────────────────────────────────────────────────────
    { by: bob,   text: "Everything is green ✅ Typecheck clean, integration tests passing.", at: ago(0, 7, 30) },
    { by: alice, text: "That's all I need to see. Let's go!", at: ago(0, 7, 32) },
  ];
}

function buildStressMessageRows(roomId: string, participants: SeedUser[]) {
  const now = Date.now();
  const start = now - 30 * 24 * 60 * 60 * 1000;
  const intervalMs = Math.floor((now - start) / STRESS_MESSAGE_COUNT);
  const topics = [
    "pagination check",
    "socket sync",
    "presence heartbeat",
    "attachment indexing",
    "room moderation",
    "friends sidebar",
    "dm freeze logic",
    "scroll restoration",
    "unread tracking",
    "auth session refresh",
  ];

  return Array.from({ length: STRESS_MESSAGE_COUNT }, (_, index) => {
    const sender = participants[index % participants.length];
    const createdAt = new Date(start + intervalMs * index);
    const topic = topics[index % topics.length];

    return {
      roomId,
      senderUserId: sender.id,
      body: `Stress message ${index + 1} from ${sender.username} — ${topic}.`,
      createdAt,
      updatedAt: createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const force = process.argv.includes("--force");

  // Idempotency: skip if alice already exists and --force not passed.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "alice"))
    .limit(1);

  if (existing && !force) {
    console.log(
      "Seed data already present. Run with --force to truncate and re-seed.",
    );
    return;
  }

  // ── 1. Truncate all tables ──────────────────────────────────────────────
  console.log("Clearing tables…");
  await postgresClient.unsafe(`
    TRUNCATE
      user_bans,
      friendships,
      friend_requests,
      attachments,
      messages,
      room_bans,
      room_invitations,
      room_members,
      rooms,
      verifications,
      sessions,
      accounts,
      users
    CASCADE
  `);

  // ── 2. Users ────────────────────────────────────────────────────────────
  console.log("Creating users…");
  const alice = await createUser("alice", "alice@test.com", "alice123");
  const bob   = await createUser("bob",   "bob@test.com",   "bob123");
  const carol = await createUser("carol", "carol@test.com", "carol123");
  const dave  = await createUser("dave",  "dave@test.com",  "dave123");
  const erin  = await createUser("erin",  "erin@test.com",  "erin123");
  const frank = await createUser("frank", "frank@test.com", "frank123");
  const grace = await createUser("grace", "grace@test.com", "grace123");
  const heidi = await createUser("heidi", "heidi@test.com", "heidi123");
  const ivan  = await createUser("ivan",  "ivan@test.com",  "ivan123");
  const judy  = await createUser("judy",  "judy@test.com",  "judy123");
  console.log(`  alice: ${alice.id}`);
  console.log(`  bob:   ${bob.id}`);
  console.log(`  carol: ${carol.id}`);
  console.log(`  dave:  ${dave.id}`);
  console.log(`  erin:  ${erin.id}`);
  console.log(`  frank: ${frank.id}`);
  console.log(`  grace: ${grace.id}`);
  console.log(`  heidi: ${heidi.id}`);
  console.log(`  ivan:  ${ivan.id}`);
  console.log(`  judy:  ${judy.id}`);

  // ── 3. Rooms ────────────────────────────────────────────────────────────
  console.log("Creating rooms…");

  const [general] = await db
    .insert(rooms)
    .values({
      name: "general",
      description: "General team discussion — everyone welcome",
      type: "public",
      ownerId: alice.id,
    })
    .returning({ id: rooms.id });

  const [engineering] = await db
    .insert(rooms)
    .values({
      name: "engineering",
      description: "Engineering deep-dives — tech only",
      type: "private",
      ownerId: alice.id,
    })
    .returning({ id: rooms.id });

  const [random] = await db
    .insert(rooms)
    .values({
      name: "random",
      description: "Memes, off-topic, and general chaos",
      type: "public",
      ownerId: bob.id,
    })
    .returning({ id: rooms.id });

  const [stressTest] = await db
    .insert(rooms)
    .values({
      name: "stress-test",
      description: "10,000-message room for pagination and scroll verification",
      type: "public",
      ownerId: alice.id,
    })
    .returning({ id: rooms.id });

  // ── 4. Room memberships ─────────────────────────────────────────────────
  await db.insert(roomMembers).values([
    { roomId: general.id, userId: alice.id, role: "admin"  },
    { roomId: general.id, userId: bob.id,   role: "member" },
    { roomId: general.id, userId: carol.id, role: "member" },
    { roomId: general.id, userId: dave.id,  role: "member" },
  ]);

  await db.insert(roomMembers).values([
    { roomId: engineering.id, userId: alice.id, role: "admin" },
    { roomId: engineering.id, userId: bob.id,   role: "admin" },
  ]);

  await db.insert(roomMembers).values([
    { roomId: random.id, userId: bob.id,   role: "admin"  },
    { roomId: random.id, userId: carol.id, role: "member" },
  ]);

  const stressParticipants = [
    alice,
    bob,
    carol,
    dave,
    erin,
    frank,
    grace,
    heidi,
    ivan,
    judy,
  ];

  await db.insert(roomMembers).values(
    stressParticipants.map((user, index) => ({
      roomId: stressTest.id,
      userId: user.id,
      role: index === 0 ? ("admin" as const) : ("member" as const),
    })),
  );

  // ── 5. #general messages (63 + 2 attachment messages = 65) ──────────────
  console.log("Seeding #general messages…");
  const generalSpecs = buildGeneralSpecs(alice, bob, carol, dave);
  const generalIds: string[] = [];

  for (const spec of generalSpecs) {
    const replyToMessageId =
      spec.replyToIdx !== undefined
        ? (generalIds[spec.replyToIdx] ?? null)
        : null;

    const [msg] = await db
      .insert(messages)
      .values({
        roomId: general.id,
        senderUserId: spec.by.id,
        body: spec.text,
        createdAt: spec.at,
        updatedAt: spec.at,
        replyToMessageId,
      })
      .returning({ id: messages.id });

    generalIds.push(msg.id);
  }

  console.log(`  ${generalIds.length} messages in #general`);

  // ── 6. #engineering messages (34) ───────────────────────────────────────
  console.log("Seeding #engineering messages…");
  const engSpecs = buildEngineeringSpecs(alice, bob);
  const engIds: string[] = [];

  for (const spec of engSpecs) {
    const [msg] = await db
      .insert(messages)
      .values({
        roomId: engineering.id,
        senderUserId: spec.by.id,
        body: spec.text,
        createdAt: spec.at,
        updatedAt: spec.at,
      })
      .returning({ id: messages.id });

    engIds.push(msg.id);
  }

  console.log(`  ${engIds.length} messages in #engineering`);

  // ── 7. #stress-test messages (10,000) ──────────────────────────────────
  console.log("Seeding #stress-test messages…");
  const stressRows = buildStressMessageRows(stressTest.id, stressParticipants);

  for (let start = 0; start < stressRows.length; start += STRESS_BATCH_SIZE) {
    const batch = stressRows.slice(start, start + STRESS_BATCH_SIZE);
    await db.insert(messages).values(batch);
  }

  console.log(`  ${stressRows.length} messages in #stress-test`);

  // ── 8. Image attachments in #general ────────────────────────────────────
  console.log("Creating image attachments…");
  await mkdir(UPLOADS_DIR, { recursive: true });

  async function insertAttachment(opts: {
    by: SeedUser;
    body: string;
    filename: string;
    at: Date;
  }) {
    const storageKey = `${randomUUID()}.png`;
    await writeFile(join(UPLOADS_DIR, storageKey), TINY_PNG);

    const [attachMsg] = await db
      .insert(messages)
      .values({
        roomId: general.id,
        senderUserId: opts.by.id,
        body: opts.body,
        createdAt: opts.at,
        updatedAt: opts.at,
      })
      .returning({ id: messages.id });

    await db.insert(attachments).values({
      roomId: general.id,
      messageId: attachMsg.id,
      uploaderUserId: opts.by.id,
      storageKey,
      originalFilename: opts.filename,
      mimeType: "image/png",
      byteSize: TINY_PNG.byteLength,
      imageWidth: 1,
      imageHeight: 1,
    });
  }

  await insertAttachment({
    by: alice,
    body: "Here's a screenshot of the app in action!",
    filename: "app-screenshot.png",
    at: ago(2, 14, 0),
  });

  await insertAttachment({
    by: bob,
    body: "And here's the file upload feature working end-to-end:",
    filename: "file-upload-demo.png",
    at: ago(1, 16, 0),
  });

  console.log("  2 image attachments created");

  // ── 9. Alice ↔ Bob friendship + DM room + 10 messages ──────────────────
  console.log("Creating alice-bob friendship…");

  const aliceBobPairKey = pairKey(alice.id, bob.id);

  const [friendRequest] = await db
    .insert(friendRequests)
    .values({
      requesterUserId: alice.id,
      addresseeUserId: bob.id,
      pairKey: aliceBobPairKey,
      status: "accepted",
      respondedAt: ago(4),
    })
    .returning({ id: friendRequests.id });

  const [userOneId, userTwoId] =
    alice.id < bob.id ? [alice.id, bob.id] : [bob.id, alice.id];

  await db.insert(friendships).values({
    userOneId,
    userTwoId,
    pairKey: aliceBobPairKey,
    createdFromRequestId: friendRequest.id,
  });

  // Direct room
  const directKey = dmKey(alice.id, bob.id);

  const [dmRoom] = await db
    .insert(rooms)
    .values({
      type: "direct",
      name: directKey,
      description: null,
      ownerId: null,
      directKey,
    })
    .returning({ id: rooms.id });

  await db.insert(roomMembers).values([
    { roomId: dmRoom.id, userId: alice.id, role: "member" },
    { roomId: dmRoom.id, userId: bob.id,   role: "member" },
  ]);

  // 10 DM messages
  const dmConversation: MsgSpec[] = [
    { by: alice, text: "Hey! Great work on the file upload feature 🙌", at: ago(2, 15, 0) },
    { by: bob,   text: "Thanks! Tricky getting the multipart parsing right but worth it.", at: ago(2, 15, 3) },
    { by: alice, text: "The inline image rendering looks really polished.", at: ago(2, 15, 6) },
    { by: bob,   text: "Spent a while on aspect-ratio clamping and lazy loading. Glad it shows.", at: ago(2, 15, 9) },
    { by: alice, text: "Did you see carol's message about the sidebar bug?", at: ago(1, 12, 0) },
    { by: bob,   text: "Yeah — fixed it in about 5 mins. Stale React Query cache.", at: ago(1, 12, 5) },
    { by: alice, text: "You're a lifesaver!", at: ago(1, 12, 7) },
    { by: bob,   text: "That's what teammates are for 😄", at: ago(1, 12, 9) },
    { by: alice, text: "We make a really good team.", at: ago(0, 9, 0) },
    { by: bob,   text: "Totally agree. Ready to crush the demo? 🚀", at: ago(0, 9, 3) },
  ];

  for (const m of dmConversation) {
    await db.insert(messages).values({
      roomId: dmRoom.id,
      senderUserId: m.by.id,
      body: m.text,
      createdAt: m.at,
      updatedAt: m.at,
    });
  }

  console.log("  Friendship, DM room, and 10 DM messages created");

  // ── 10. Carol → Alice pending friend request ────────────────────────────
  console.log("Creating carol → alice pending friend request…");

  await db.insert(friendRequests).values({
    requesterUserId: carol.id,
    addresseeUserId: alice.id,
    pairKey: pairKey(carol.id, alice.id),
    status: "pending",
  });

  // ── 11. 50 contact users ────────────────────────────────────────────────
  console.log("Creating 50 contact users…");

  // Hash once and reuse — bcrypt is intentionally slow, so avoid 50 calls.
  const sharedHash = await hashPassword("password123");

  const contactNames = Array.from(
    { length: 50 },
    (_, i) => `contact${String(i + 1).padStart(2, "0")}`,
  );

  const contactUserRows = contactNames.map((name) => ({
    id: randomUUID(),
    name,
    email: `${name}@test.com`,
    emailVerified: true,
    username: name,
    displayUsername: name,
  }));

  await db.insert(users).values(contactUserRows);
  await db.insert(accounts).values(
    contactUserRows.map((u) => ({
      userId: u.id,
      accountId: u.id,
      providerId: "credential",
      password: sharedHash,
    })),
  );

  const contactUsers: SeedUser[] = contactUserRows.map((u) => ({
    id: u.id,
    username: u.name,
  }));

  console.log(`  ${contactUsers.length} contact users created`);

  // ── 12. 50 alice ↔ contactXX friendships ───────────────────────────────
  console.log("Creating 50 friendships for alice…");

  const friendRequestRows = contactUsers.map((contact) => ({
    requesterUserId: contact.id,
    addresseeUserId: alice.id,
    pairKey: pairKey(contact.id, alice.id),
    status: "accepted" as const,
    respondedAt: ago(Math.floor(Math.random() * 25) + 1),
  }));

  const insertedRequests = await db
    .insert(friendRequests)
    .values(friendRequestRows)
    .returning({ id: friendRequests.id, pairKey: friendRequests.pairKey });

  await db.insert(friendships).values(
    insertedRequests.map((req, i) => {
      const contact = contactUsers[i];
      const [userOneId, userTwoId] =
        contact.id < alice.id
          ? [contact.id, alice.id]
          : [alice.id, contact.id];
      return {
        userOneId,
        userTwoId,
        pairKey: req.pairKey,
        createdFromRequestId: req.id,
      };
    }),
  );

  console.log(`  50 friendships created`);

  // ── 12b. DM rooms for all 50 contacts ─────────────────────────────────
  console.log("Creating DM rooms for 50 contacts…");

  const dmRoomRows = contactUsers.map((contact) => ({
    type: "direct" as const,
    name: dmKey(alice.id, contact.id),
    description: null,
    ownerId: null,
    directKey: dmKey(alice.id, contact.id),
  }));

  const insertedDmRooms = await db
    .insert(rooms)
    .values(dmRoomRows)
    .returning({ id: rooms.id });

  const dmMemberRows = insertedDmRooms.flatMap((room, i) => [
    { roomId: room.id, userId: alice.id, role: "member" as const },
    { roomId: room.id, userId: contactUsers[i].id, role: "member" as const },
  ]);

  await db.insert(roomMembers).values(dmMemberRows);

  console.log(`  ${insertedDmRooms.length} DM rooms created`);

  // ── 13. 16 extra rooms for alice (total ≈ 20) ──────────────────────────
  console.log("Creating extra rooms for alice…");

  const extraPublicRooms = [
    { name: "announcements",  description: "Team-wide announcements and updates" },
    { name: "design",         description: "UI/UX discussions, mockups, and feedback" },
    { name: "backend",        description: "Server-side architecture and APIs" },
    { name: "frontend",       description: "React, Next.js, and CSS talk" },
    { name: "devops",         description: "Docker, CI/CD, and deployment" },
    { name: "product",        description: "Product roadmap and feature discussions" },
    { name: "testing",        description: "QA, test strategy, and automation" },
    { name: "security",       description: "Vulnerabilities, audits, and patches" },
  ];

  const extraPrivateRooms = [
    { name: "leads-only",     description: "Private channel for team leads" },
    { name: "sprint-planning",description: "Sprint planning and retrospectives" },
    { name: "incident-mgmt",  description: "On-call and incident response" },
    { name: "perf-reviews",   description: "Performance review discussions" },
    { name: "hiring",         description: "Candidate pipeline and interviews" },
    { name: "budget",         description: "Cost tracking and budget approvals" },
    { name: "roadmap-q3",     description: "Q3 roadmap planning" },
    { name: "demo-prep",      description: "Hackathon demo rehearsal" },
  ];

  const extraRoomRows = [
    ...extraPublicRooms.map((r) => ({ ...r, type: "public" as const, ownerId: alice.id })),
    ...extraPrivateRooms.map((r) => ({ ...r, type: "private" as const, ownerId: alice.id })),
  ];

  const insertedExtraRooms = await db
    .insert(rooms)
    .values(extraRoomRows)
    .returning({ id: rooms.id });

  // Alice is admin of all extra rooms; add a couple of other members for realism.
  const extraMemberRows = insertedExtraRooms.flatMap((room, i) => {
    const members: { roomId: string; userId: string; role: "admin" | "member" }[] = [
      { roomId: room.id, userId: alice.id, role: "admin" },
    ];
    // Rotate bob/carol/dave into a few rooms for variety.
    if (i % 3 === 0) members.push({ roomId: room.id, userId: bob.id,   role: "member" });
    if (i % 4 === 0) members.push({ roomId: room.id, userId: carol.id, role: "member" });
    if (i % 5 === 0) members.push({ roomId: room.id, userId: dave.id,  role: "member" });
    return members;
  });

  await db.insert(roomMembers).values(extraMemberRows);

  console.log(`  ${insertedExtraRooms.length} extra rooms created`);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`
✅  Seed complete!

  Users:    alice / bob / carol / dave / erin / frank / grace / heidi / ivan / judy
            + 50 contact users (contact01–contact50, password: password123)
  Rooms:    #general (public, ${generalIds.length + 2} messages + 2 attachments)
            #engineering (private, ${engIds.length} messages)
            #random (public, no messages)
            #stress-test (public, ${stressRows.length} messages across 10 users / 30 days)
            + ${insertedExtraRooms.length} extra public/private rooms (alice owner)
  Friends:  alice ↔ bob  (with 10 DM messages)
            alice ↔ contact01–contact50 (50 contacts)
  Pending:  carol → alice friend request

  Login:    alice@test.com   / alice123
            bob@test.com     / bob123
            carol@test.com   / carol123
            dave@test.com    / dave123
            erin@test.com    / erin123  …  judy@test.com / judy123
            contact01@test.com … contact50@test.com  /  password123
`);
}

main()
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => postgresClient.end());
