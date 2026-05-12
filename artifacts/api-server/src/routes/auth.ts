import { Router } from "express";
import { db, usersTable, otpSessionsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { hashPassword, comparePassword, signToken } from "../lib/auth";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import { sendOtpViaTelegram } from "../lib/telegram";
import crypto from "crypto";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    phone: user.phone,
    username: user.username,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

// POST /api/auth/request-otp
router.post("/auth/request-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || typeof phone !== "string") {
      res.status(400).json({ error: "Phone number required" });
      return;
    }

    const sessionId = crypto.randomUUID();
    // Generate a 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(otpSessionsTable).values({
      sessionId,
      phone,
      code,
      verified: false,
      expiresAt,
    });

    // Send OTP via Telegram — falls back to dev log if credentials missing
    try {
      await sendOtpViaTelegram(phone, code);
      res.json({ sessionId, message: `تم إرسال كود التحقق إلى ${phone} عبر تيليجرام` });
    } catch (telegramErr) {
      req.log.warn({ telegramErr, phone, code }, "Telegram send failed — falling back to dev log");
      res.json({ sessionId, message: `OTP sent to ${phone}. Code: ${code} (dev mode)` });
    }
  } catch (err) {
    req.log.error({ err }, "request-otp error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/verify-otp
router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) {
      res.status(400).json({ error: "sessionId and code required" });
      return;
    }

    const [session] = await db
      .select()
      .from(otpSessionsTable)
      .where(eq(otpSessionsTable.sessionId, sessionId));

    if (!session) {
      res.status(400).json({ error: "Invalid session" });
      return;
    }

    if (new Date() > session.expiresAt) {
      res.status(400).json({ error: "OTP expired" });
      return;
    }

    if (session.code !== code) {
      res.status(400).json({ error: "Invalid code" });
      return;
    }

    // Mark session as verified
    await db
      .update(otpSessionsTable)
      .set({ verified: true })
      .where(eq(otpSessionsTable.sessionId, sessionId));

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, session.phone));

    const isNewUser = !existingUser;

    res.json({
      verified: true,
      isNewUser,
      sessionToken: sessionId, // Reuse sessionId as the setup token
    });
  } catch (err) {
    req.log.error({ err }, "verify-otp error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/setup-profile
router.post("/auth/setup-profile", async (req, res) => {
  try {
    const { sessionToken, username, password, bio } = req.body;
    if (!sessionToken || !username || !password) {
      res.status(400).json({ error: "sessionToken, username, and password required" });
      return;
    }

    const [session] = await db
      .select()
      .from(otpSessionsTable)
      .where(eq(otpSessionsTable.sessionId, sessionToken));

    if (!session || !session.verified) {
      res.status(401).json({ error: "No verified OTP session" });
      return;
    }

    // Check if username is taken
    const [existingUsername] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username));

    if (existingUsername) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = hashPassword(password);

    // Upsert user: create new or update existing
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, session.phone));

    let user: typeof usersTable.$inferSelect;
    if (existingUser) {
      const [updated] = await db
        .update(usersTable)
        .set({ username, passwordHash, bio: bio ?? null })
        .where(eq(usersTable.id, existingUser.id))
        .returning();
      user = updated;
    } else {
      const [created] = await db
        .insert(usersTable)
        .values({
          phone: session.phone,
          username,
          passwordHash,
          bio: bio ?? null,
        })
        .returning();
      user = created;
    }

    const token = signToken({ userId: user.id });
    res.json({ user: formatUser(user), token });
  } catch (err) {
    req.log.error({ err }, "setup-profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: "identifier and password required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.phone, identifier),
          eq(usersTable.username, identifier),
        ),
      );

    if (!user || !comparePassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken({ userId: user.id });
    res.json({ user: formatUser(user), token });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", async (_req, res) => {
  res.json({ message: "Logged out" });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(formatUser(req.user));
  } catch (err) {
    req.log.error({ err }, "me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
