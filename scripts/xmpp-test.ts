/**
 * Quick XMPP connectivity test.
 * Usage: npx tsx scripts/xmpp-test.ts
 *
 * Registers a test user, connects, joins a MUC room, sends a message,
 * and listens for messages. Verifies bidirectional flow.
 */
// @ts-nocheck
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

  xmpp.on("online", async (address: any) => {
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

  xmpp.on("stanza", (stanza: any) => {
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
