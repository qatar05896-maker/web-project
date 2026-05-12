import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatsTable = pgTable("chats", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("direct"), // 'direct' | 'group'
  name: text("name"),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChatSchema = createInsertSchema(chatsTable).omit({ id: true, createdAt: true });
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Chat = typeof chatsTable.$inferSelect;
