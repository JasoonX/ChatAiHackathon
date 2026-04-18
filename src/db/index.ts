import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type IntegrationState = {
  client: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;
};

const integrationState = (globalThis as {
  __integrationState?: IntegrationState;
}).__integrationState;

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/chat_app";

export const postgresClient =
  integrationState?.client ??
  postgres(connectionString, {
    prepare: false,
  });

export const db = integrationState?.db ?? drizzle(postgresClient, { schema });
