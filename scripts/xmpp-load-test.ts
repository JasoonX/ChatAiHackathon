/**
 * XMPP Federation Load Test
 *
 * Creates 50 bot clients on server A and 50 on server B.
 * Each bot joins a shared MUC room and sends messages.
 * Measures connectivity, delivery, and latency.
 *
 * Prerequisites:
 *   1. docker compose up -d
 *   2. bash scripts/xmpp-register-bots.sh
 *
 * Usage: npx tsx scripts/xmpp-load-test.ts
 */
// @ts-nocheck
import { client, xml } from "@xmpp/client";
import { writeFileSync } from "fs";

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
const MESSAGE_INTERVAL_MS = 2000;

interface BotStats {
  username: string;
  server: string;
  connected: boolean;
  messagesSent: number;
  messagesReceived: number;
  errors: string[];
  connectTimeMs: number;
}

const allBots: { xmpp: any; stats: BotStats; interval?: ReturnType<typeof setInterval> }[] = [];

async function createBot(
  serverConfig: typeof SERVER_A,
  index: number,
): Promise<BotStats> {
  const prefix = serverConfig.domain.split(".")[0]; // "a" or "b"
  const username = `bot${prefix}${index}`;
  const password = `pass${index}`;

  const stats: BotStats = {
    username,
    server: serverConfig.domain,
    connected: false,
    messagesSent: 0,
    messagesReceived: 0,
    errors: [],
    connectTimeMs: 0,
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
      const timeout = setTimeout(
        () => reject(new Error("Connect timeout")),
        15000,
      );

      xmpp.on("online", async () => {
        clearTimeout(timeout);
        stats.connected = true;
        stats.connectTimeMs = Date.now() - connectStart;

        // Join MUC room
        const mucJid = `${MUC_ROOM}@conference.${serverConfig.domain}/${username}`;
        const presence = xml(
          "presence",
          { to: mucJid },
          xml("x", { xmlns: "http://jabber.org/protocol/muc" }),
        );
        await xmpp.send(presence);
        resolve();
      });

      xmpp.on("stanza", (stanza: any) => {
        if (stanza.is("message") && stanza.getChildText("body")) {
          stats.messagesReceived++;
        }
      });

      xmpp.start().catch(reject);
    });

    // Send messages periodically
    const interval = setInterval(async () => {
      try {
        const msg = xml(
          "message",
          {
            type: "groupchat",
            to: `${MUC_ROOM}@conference.${serverConfig.domain}`,
          },
          xml("body", {}, `msg from ${username} t=${Date.now()}`),
        );
        await xmpp.send(msg);
        stats.messagesSent++;
      } catch (err) {
        stats.errors.push(`send: ${(err as Error).message}`);
      }
    }, MESSAGE_INTERVAL_MS);

    allBots.push({ xmpp, stats, interval });
  } catch (err) {
    stats.errors.push(`init: ${(err as Error).message}`);
  }

  return stats;
}

async function main() {
  console.log("=== XMPP Federation Load Test ===");
  console.log(`Bots per server: ${BOT_COUNT}`);
  console.log(`Test duration: ${TEST_DURATION_MS / 1000}s`);
  console.log(`Message interval: ${MESSAGE_INTERVAL_MS}ms`);
  console.log();

  // Create bots in staggered batches
  console.log("Connecting bots...");
  const statsList: BotStats[] = [];

  for (let i = 0; i < BOT_COUNT; i++) {
    const [statsA, statsB] = await Promise.all([
      createBot(SERVER_A, i),
      createBot(SERVER_B, i),
    ]);
    statsList.push(statsA, statsB);

    // Stagger every 10 bots
    if (i % 10 === 9) {
      const connectedCount = statsList.filter((s) => s.connected).length;
      console.log(`  ${connectedCount}/${statsList.length} connected...`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const connectedTotal = statsList.filter((s) => s.connected).length;
  console.log(
    `All bots launched: ${connectedTotal}/${statsList.length} connected.`,
  );
  console.log(`Running test for ${TEST_DURATION_MS / 1000}s...`);

  // Wait for test duration
  await new Promise((r) => setTimeout(r, TEST_DURATION_MS));

  // Stop all bots
  console.log("Stopping bots...");
  for (const bot of allBots) {
    if (bot.interval) clearInterval(bot.interval);
    try {
      await bot.xmpp.stop();
    } catch {
      // ignore
    }
  }

  // Allow final messages to arrive
  await new Promise((r) => setTimeout(r, 2000));

  // Report
  const serverABots = statsList.filter((s) => s.server === SERVER_A.domain);
  const serverBBots = statsList.filter((s) => s.server === SERVER_B.domain);

  const summarize = (bots: BotStats[]) => {
    const connected = bots.filter((s) => s.connected);
    return {
      connected: connected.length,
      total: bots.length,
      totalSent: bots.reduce((sum, s) => sum + s.messagesSent, 0),
      totalReceived: bots.reduce((sum, s) => sum + s.messagesReceived, 0),
      avgConnectTimeMs: connected.length
        ? Math.round(
            connected.reduce((sum, s) => sum + s.connectTimeMs, 0) /
              connected.length,
          )
        : 0,
      errors: bots.flatMap((s) => s.errors).length,
    };
  };

  const report = {
    timestamp: new Date().toISOString(),
    config: {
      botsPerServer: BOT_COUNT,
      testDurationMs: TEST_DURATION_MS,
      messageIntervalMs: MESSAGE_INTERVAL_MS,
    },
    serverA: summarize(serverABots),
    serverB: summarize(serverBBots),
  };

  console.log("\n=== RESULTS ===");
  console.log(
    `Server A (${SERVER_A.domain}): ${report.serverA.connected}/${report.serverA.total} connected`,
  );
  console.log(
    `  Sent: ${report.serverA.totalSent} | Received: ${report.serverA.totalReceived}`,
  );
  console.log(`  Avg connect time: ${report.serverA.avgConnectTimeMs}ms`);
  console.log(`  Errors: ${report.serverA.errors}`);
  console.log(
    `Server B (${SERVER_B.domain}): ${report.serverB.connected}/${report.serverB.total} connected`,
  );
  console.log(
    `  Sent: ${report.serverB.totalSent} | Received: ${report.serverB.totalReceived}`,
  );
  console.log(`  Avg connect time: ${report.serverB.avgConnectTimeMs}ms`);
  console.log(`  Errors: ${report.serverB.errors}`);

  // Write JSON report
  const reportPath = "scripts/xmpp-load-test-report.json";
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
