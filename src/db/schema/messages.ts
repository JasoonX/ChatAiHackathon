import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { rooms } from "./rooms";
import { users } from "./users";

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    replyToMessageId: uuid("reply_to_message_id").references(
      (): AnyPgColumn => messages.id,
      {
        onDelete: "set null",
      },
    ),
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: uuid("deleted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("messages_room_created_at_idx").on(table.roomId, table.createdAt),
    index("messages_room_created_at_desc_idx").on(
      table.roomId,
      table.createdAt.desc(),
    ),
    index("messages_sender_user_id_idx").on(table.senderUserId),
    index("messages_reply_to_message_id_idx").on(table.replyToMessageId),
    check(
      "messages_body_size_chk",
      sql`${table.body} is null or octet_length(${table.body}) <= 3072`,
    ),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    uploaderUserId: uuid("uploader_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("attachments_storage_key_unique_idx").on(table.storageKey),
    index("attachments_room_id_idx").on(table.roomId),
    index("attachments_message_id_idx").on(table.messageId),
    index("attachments_uploader_user_id_idx").on(table.uploaderUserId),
    check("attachments_byte_size_positive_chk", sql`${table.byteSize} > 0`),
  ],
);
