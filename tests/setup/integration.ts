import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll } from "vitest";

import * as schema from "../../src/db/schema";

type StartedContainer = Awaited<ReturnType<PostgreSqlContainer["start"]>>;
type TestDb = ReturnType<typeof drizzle<typeof schema>>;

type IntegrationState = {
  client: postgres.Sql;
  container: StartedContainer;
  db: TestDb;
};

declare global {
  // eslint-disable-next-line no-var
  var __integrationState: IntegrationState | undefined;
}

async function getState() {
  if (!globalThis.__integrationState) {
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("chat_app")
      .withUsername("postgres")
      .withPassword("postgres")
      .start();

    process.env.DATABASE_URL = container.getConnectionUri();

    const client = postgres(container.getConnectionUri(), {
      prepare: false,
    });

    globalThis.__integrationState = {
      client,
      container,
      db: drizzle(client, { schema }),
    };
  }

  return globalThis.__integrationState;
}

export let db: TestDb;

export async function resetDb() {
  const state = await getState();
  const connectionUri = state.container.getConnectionUri();

  await state.client.unsafe(`
    drop schema if exists public cascade;
    create schema public;
    grant all on schema public to postgres;
    grant all on schema public to public;
  `);

  await state.client.end();

  const client = postgres(connectionUri, {
    prepare: false,
  });

  state.client = client;
  state.db = drizzle(client, { schema });
  db = state.db;
  await migrate(state.db, { migrationsFolder: "drizzle" });
}

beforeAll(async () => {
  const state = await getState();
  process.env.DATABASE_URL = state.container.getConnectionUri();
  db = state.db;
  await resetDb();
});

afterAll(async () => {
  if (!globalThis.__integrationState) {
    return;
  }

  await globalThis.__integrationState.client.end();
  await globalThis.__integrationState.container.stop();
  globalThis.__integrationState = undefined;
});
