import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";

import { db } from "@/db";
import * as schema from "@/db/schema";

export const SESSION_COOKIE_NAME = "better-auth.session_token";

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
    fields: {
      name: "name",
      email: "email",
      emailVerified: "email_verified",
      image: "image",
      createdAt: "created_at",
      updatedAt: "updated_at",
      username: "username",
      displayUsername: "display_username",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      token: "token",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "last_active_at",
    },
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      idToken: "id_token",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verifications",
    fields: {
      identifier: "identifier",
      value: "value",
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  plugins: [username()],
  advanced: {
    cookies: {
      session_token: {
        attributes: {
          sameSite: "lax",
        },
      },
    },
  },
});
