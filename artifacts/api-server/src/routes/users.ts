import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, or, ilike } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";

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

// GET /api/users/search?q=...
router.get("/users/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json([]);
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.phone, q),
          ilike(usersTable.username, `%${q}%`),
        ),
      )
      .limit(20);

    res.json(users.map(formatUser));
  } catch (err) {
    req.log.error({ err }, "search-users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId
router.get("/users/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(formatUser(user));
  } catch (err) {
    req.log.error({ err }, "get-user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/me/profile
router.patch("/users/me/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username, bio, phone, password, avatarUrl } = req.body;

    const updates: Partial<typeof usersTable.$inferSelect> = {};
    if (username !== undefined) updates.username = username;
    if (bio !== undefined) updates.bio = bio;
    if (phone !== undefined) updates.phone = phone;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (password !== undefined) updates.passwordHash = hashPassword(password);

    if (Object.keys(updates).length === 0) {
      res.json(formatUser(req.user!));
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.userId!))
      .returning();

    res.json(formatUser(updated));
  } catch (err) {
    req.log.error({ err }, "update-profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
