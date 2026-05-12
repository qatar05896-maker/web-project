import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { chatsTable } from "./chats";
import { usersTable } from "./users";

export const chatMembersTable = pgTable("chat_members", {
  chatId: integer("chat_id").notNull().references(() => chatsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'admin' | 'member'
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.chatId, t.userId] })]);

export type ChatMember = typeof chatMembersTable.$inferSelect;
