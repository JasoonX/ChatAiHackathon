import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

import { db } from "../db";
import { SESSION_COOKIE_NAME } from "./auth-constants";
import * as schema from "../db/schema";

// Mock SMTP: store reset URLs in memory so the UI can display them
const resetUrlStore = new Map<string, { url: string; expires: number }>();

export function consumeResetUrl(email: string): string | null {
  const entry = resetUrlStore.get(email);
  if (!entry || Date.now() > entry.expires) {
    resetUrlStore.delete(email);
    return null;
  }
  resetUrlStore.delete(email);
  return entry.url;
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "development-secret-change-me",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  user: {
    modelName: "users",
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[MOCK SMTP] Password reset for ${user.email}: ${url}`);
      resetUrlStore.set(user.email, {
        url,
        expires: Date.now() + 5 * 60 * 1000,
      });
    },
  },
  session: {
    modelName: "sessions",
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    modelName: "accounts",
  },
  verification: {
    modelName: "verifications",
  },
  plugins: [username()],
  rateLimit: {
    enabled: process.env.DISABLE_RATE_LIMIT !== "true",
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
    cookies: {
      session_token: {
        name: SESSION_COOKIE_NAME,
        attributes: {
          sameSite: "lax",
        },
      },
    },
  },
});

const CONFLICT_MESSAGES = new Set([
  "User already exists. Use another email.",
  "Username is already taken. Please try another.",
]);

export async function handleAuthRequest(request: Request) {
  const response = await auth.handler(request);

  if (response.status !== 400 && response.status !== 422) {
    return response;
  }

  let body: unknown;

  try {
    body = await response.clone().json();
  } catch {
    return response;
  }

  const message =
    typeof body === "object" && body !== null && "message" in body
      ? body.message
      : undefined;

  if (typeof message !== "string" || !CONFLICT_MESSAGES.has(message)) {
    return response;
  }

  return Response.json(body, {
    status: 409,
    headers: response.headers,
  });
}
