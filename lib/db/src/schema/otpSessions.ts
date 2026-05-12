import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const otpSessionsTable = pgTable("otp_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  verified: boolean("verified").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OtpSession = typeof otpSessionsTable.$inferSelect;
