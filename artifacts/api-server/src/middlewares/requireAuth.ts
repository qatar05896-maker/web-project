import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: number;
  user?: typeof usersTable.$inferSelect;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  req.userId = user.id;
  req.user = user;
  next();
}
