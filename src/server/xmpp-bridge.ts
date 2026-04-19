import { db } from "../db";
import { messages } from "../db/schema/messages";
import { rooms, roomMembers } from "../db/schema/rooms";
import { users } from "../db/schema/users";
import { getIO } from "../lib/socket-server";
import type { MessagePayload } from "../lib/socket";
import { eq, and } from "drizzle-orm";

// Use globalThis so API routes (separate module instances) can read bridge state
const g = globalThis as unknown as {
  __xmppClient?: any;
  __xmppXml?: any;
  __xmppBridgeStats?: {
    connected: boolean;
    messagesForwardedToXmpp: number;
    messagesReceivedFromXmpp: number;
    lastForwardedAt: string | null;
    lastReceivedAt: string | null;
    errors: number;
  };
};

function getStats() {
  if (!g.__xmppBridgeStats) {
    g.__xmppBridgeStats = {
      connected: false,
      messagesForwardedToXmpp: 0,
      messagesReceivedFromXmpp: 0,
      lastForwardedAt: null,
      lastReceivedAt: null,
      errors: 0,
    };
  }
  return g.__xmppBridgeStats;
}

export function isXmppConnected(): boolean {
  return getStats().connected;
}

export function getXmppStats() {
  const stats = getStats();
  return {
    ...stats,
    domain: process.env.PROSODY_A_DOMAIN ?? "a.chat.local",
    componentDomain: `bridge@${process.env.PROSODY_A_DOMAIN ?? "a.chat.local"}`,
  };
}

const BRIDGE_USERNAME = "chatty-bridge";
const BRIDGE_PASSWORD = "chatty-bridge-secret";

// Set of MUC rooms the bridge client has joined
const joinedMucRooms = new Set<string>();

async function joinMucRoom(roomName: string): Promise<void> {
  const xmpp = g.__xmppClient;
  const xml = g.__xmppXml;
  if (!xmpp || !xml || !getStats().connected) return;

  if (joinedMucRooms.has(roomName)) return;

  const domain = process.env.PROSODY_A_DOMAIN ?? "a.chat.local";
  const mucJid = `${roomName}@conference.${domain}/${BRIDGE_USERNAME}`;

  try {
    const presence = xml(
      "presence",
      { to: mucJid },
      xml("x", { xmlns: "http://jabber.org/protocol/muc" }),
    );
    await xmpp.send(presence);
    joinedMucRooms.add(roomName);
    console.log(`[XMPP Bridge] Joined MUC room: ${roomName}`);
  } catch (err) {
    console.error(`[XMPP Bridge] Failed to join MUC ${roomName}:`, err);
  }
}

async function joinAllPublicRooms(): Promise<void> {
  const publicRooms = await db
    .select({ name: rooms.name })
    .from(rooms)
    .where(eq(rooms.type, "public"));

  for (const room of publicRooms) {
    if (room.name) {
      await joinMucRoom(room.name);
    }
  }
}

/**
 * Register the bridge user account in Prosody.
 * Uses in-band registration via a temporary client connection.
 */
async function ensureBridgeUser(
  host: string,
  port: string,
  domain: string,
): Promise<void> {
  // Try to register via prosodyctl-style HTTP or just rely on
  // allow_registration = true. We'll attempt to connect; if auth
  // fails, the user might not exist yet. Prosody's in-band registration
  // can create accounts, but @xmpp/client doesn't expose that directly.
  // Instead, we pre-register via the component or just accept that
  // the bridge user needs to be created via prosodyctl.
  console.log(
    `[XMPP Bridge] Bridge user: ${BRIDGE_USERNAME}@${domain}`,
  );
}

export async function startXmppBridge(): Promise<void> {
  const host = process.env.PROSODY_A_COMPONENT_HOST;
  const port = process.env.PROSODY_A_COMPONENT_PORT;
  const domain = process.env.PROSODY_A_DOMAIN ?? "a.chat.local";

  if (!host || !port) {
    console.log("[XMPP Bridge] Missing Prosody config, skipping XMPP bridge");
    return;
  }

  await ensureBridgeUser(host, port, domain);

  // Connect as a regular XMPP client (not component) so we can join MUC rooms
  const { client, xml } = await import("@xmpp/client");

  const xmpp = client({
    service: `xmpp://${host}:5222`,
    domain,
    username: BRIDGE_USERNAME,
    password: BRIDGE_PASSWORD,
  });

  g.__xmppClient = xmpp;
  g.__xmppXml = xml;

  xmpp.on("online", async () => {
    getStats().connected = true;
    console.log("[XMPP Bridge] Connected to Prosody as client");

    // Send initial presence
    await xmpp.send(xml("presence", {}));

    // Join all public rooms
    await joinAllPublicRooms();
  });

  xmpp.on("offline", () => {
    getStats().connected = false;
    joinedMucRooms.clear();
    console.log("[XMPP Bridge] Disconnected from Prosody");
  });

  xmpp.on("error", (err: Error) => {
    console.error("[XMPP Bridge] Error:", err.message);
    getStats().errors++;
  });

  // Handle incoming XMPP MUC messages
  xmpp.on("stanza", async (stanza: any) => {
    console.log(`[XMPP Bridge] Stanza: ${stanza.name} type=${stanza.attrs.type ?? "none"} from=${stanza.attrs.from ?? "?"}`);
    if (!stanza.is("message") || stanza.attrs.type !== "groupchat") return;

    const body = stanza.getChildText("body");
    if (!body) return;

    const from = stanza.attrs.from as string;

    // from = "roomname@conference.a.chat.local/nickname"
    const [mucJid, nickname] = from.split("/");
    if (!mucJid || !nickname) return;

    // Ignore our own messages (prevent loops)
    if (nickname === BRIDGE_USERNAME) return;

    const roomName = mucJid.split("@")[0];
    if (!roomName) return;

    console.log(
      `[XMPP Bridge] Received from ${nickname} in ${roomName}: ${body}`,
    );

    await handleIncomingXmppMessage(roomName, nickname, body);
  });

  try {
    await xmpp.start();
  } catch (err) {
    console.error("[XMPP Bridge] Failed to start:", err);
    getStats().connected = false;
  }
}

export async function stopXmppBridge(): Promise<void> {
  const xmpp = g.__xmppClient;
  if (xmpp) {
    try {
      await xmpp.stop();
    } catch {
      // ignore stop errors during shutdown
    }
    g.__xmppClient = null;
    getStats().connected = false;
    joinedMucRooms.clear();
  }
}

/**
 * Forward a message from the web app to XMPP MUC room.
 */
export async function forwardToXmpp(
  roomName: string,
  senderUsername: string,
  messageBody: string,
): Promise<void> {
  const xmpp = g.__xmppClient;
  const xml = g.__xmppXml;
  const stats = getStats();
  if (!xmpp || !xml || !stats.connected) return;

  const domain = process.env.PROSODY_A_DOMAIN ?? "a.chat.local";

  // Ensure bridge has joined this room
  await joinMucRoom(roomName);

  const mucJid = `${roomName}@conference.${domain}`;

  const msg = xml(
    "message",
    { type: "groupchat", to: mucJid },
    xml("body", {}, `${senderUsername}: ${messageBody}`),
  );

  try {
    await xmpp.send(msg);
    stats.messagesForwardedToXmpp++;
    stats.lastForwardedAt = new Date().toISOString();
  } catch (err) {
    console.error("[XMPP Bridge] Failed to forward message:", err);
    stats.errors++;
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
    console.log(
      `[XMPP Bridge] User ${senderNickname} not a member of ${roomName}`,
    );
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

  const stats = getStats();
  stats.messagesReceivedFromXmpp++;
  stats.lastReceivedAt = new Date().toISOString();
  console.log(`[XMPP Bridge] Inserted message from XMPP: ${message.id}`);
}
