import { pgTable, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { chatsTable } from "./chats";
import { usersTable } from "./users";

export const voiceParticipantsTable = pgTable("voice_participants", {
  chatId: integer("chat_id").notNull().references(() => chatsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  micEnabled: boolean("mic_enabled").notNull().default(true),
  cameraEnabled: boolean("camera_enabled").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.chatId, t.userId] })]);

export type VoiceParticipant = typeof voiceParticipantsTable.$inferSelect;
