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

export const roomTypeEnum = pgEnum("room_type", ["public", "private", "direct"]);
export const roomMemberRoleEnum = pgEnum("room_member_role", [
  "member",
  "admin",
]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
  "revoked",
]);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: roomTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    // Invariant: application code must delete owned rooms before deleting a user
    // to avoid leaving public/private rooms orphaned.
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    directKey: text("direct_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("rooms_name_unique_idx").on(table.name),
    uniqueIndex("rooms_direct_key_unique_idx").on(table.directKey),
    index("rooms_type_idx").on(table.type),
    index("rooms_owner_id_idx").on(table.ownerId),
    index("rooms_created_at_idx").on(table.createdAt),
    check(
      "rooms_direct_owner_null_chk",
      sql`${table.type} <> 'direct' or ${table.ownerId} is null`,
    ),
  ],
);

export const roomMembers = pgTable(
  "room_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roomMemberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("room_members_room_user_unique_idx").on(table.roomId, table.userId),
    index("room_members_user_id_idx").on(table.userId),
    index("room_members_room_role_idx").on(table.roomId, table.role),
    index("room_members_user_last_read_idx").on(table.userId, table.lastReadAt),
  ],
);

export const roomInvitations = pgTable(
  "room_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    inviteeUserId: uuid("invitee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviterUserId: uuid("inviter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: invitationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("room_invitations_room_invitee_status_unique_idx").on(
      table.roomId,
      table.inviteeUserId,
      table.status,
    ),
    index("room_invitations_invitee_user_id_idx").on(table.inviteeUserId),
    index("room_invitations_room_id_idx").on(table.roomId),
    index("room_invitations_created_at_idx").on(table.createdAt),
  ],
);

export const roomBans = pgTable(
  "room_bans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bannedByUserId: uuid("banned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("room_bans_room_user_unique_idx").on(table.roomId, table.userId),
    index("room_bans_banned_by_user_id_idx").on(table.bannedByUserId),
    index("room_bans_created_at_idx").on(table.createdAt),
  ],
);
