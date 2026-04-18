ALTER TABLE "room_members" ADD COLUMN "last_read_message_id" uuid;
CREATE INDEX "room_members_last_read_message_id_idx" ON "room_members" USING btree ("last_read_message_id");
