import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type IntegrationState = {
  client: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;
};

type RuntimeDbState = {
  client: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;
};

const globalState = globalThis as {
  __integrationState?: IntegrationState;
  __runtimeDbState?: RuntimeDbState;
};

const integrationState = globalState.__integrationState;

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/chat_app";

function createRuntimeState(): RuntimeDbState {
  const client = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

const runtimeState =
  integrationState ??
  globalState.__runtimeDbState ??
  createRuntimeState();

if (!integrationState) {
  globalState.__runtimeDbState = runtimeState;
}

export const postgresClient = runtimeState.client;
export const db = runtimeState.db;
