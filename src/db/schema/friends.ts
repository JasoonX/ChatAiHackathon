import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const friendRequestStatusEnum = pgEnum("friend_request_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeUserId: uuid("addressee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pairKey: text("pair_key").notNull(),
    status: friendRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("friend_requests_pair_status_unique_idx").on(
      table.pairKey,
      table.status,
    ),
    index("friend_requests_requester_user_id_idx").on(table.requesterUserId),
    index("friend_requests_addressee_user_id_idx").on(table.addresseeUserId),
    index("friend_requests_created_at_idx").on(table.createdAt),
    check(
      "friend_requests_distinct_users_chk",
      sql`${table.requesterUserId} <> ${table.addresseeUserId}`,
    ),
  ],
);

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userOneId: uuid("user_one_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userTwoId: uuid("user_two_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pairKey: text("pair_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdFromRequestId: uuid("created_from_request_id").references(
      () => friendRequests.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    uniqueIndex("friendships_pair_key_unique_idx").on(table.pairKey),
    index("friendships_user_one_id_idx").on(table.userOneId),
    index("friendships_user_two_id_idx").on(table.userTwoId),
    check("friendships_distinct_users_chk", sql`${table.userOneId} <> ${table.userTwoId}`),
  ],
);

export const userBans = pgTable(
  "user_bans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_bans_blocker_blocked_unique_idx").on(
      table.blockerUserId,
      table.blockedUserId,
    ),
    index("user_bans_blocked_user_id_idx").on(table.blockedUserId),
    index("user_bans_created_at_idx").on(table.createdAt),
    check("user_bans_distinct_users_chk", sql`${table.blockerUserId} <> ${table.blockedUserId}`),
  ],
);
