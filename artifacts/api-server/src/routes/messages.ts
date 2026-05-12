import { Router } from "express";
import {
  db,
  usersTable,
  messagesTable,
  chatMembersTable,
} from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import type { Server as SocketServer } from "socket.io";

let io: SocketServer | undefined;

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

// GET /api/chats/:chatId/messages
router.get("/chats/:chatId/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const limit = parseInt((req.query.limit as string) ?? "50", 10);
    const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

    let query = db
      .select()
      .from(messagesTable)
      .where(
        before
          ? and(eq(messagesTable.chatId, chatId), lt(messagesTable.id, before))
          : eq(messagesTable.chatId, chatId),
      )
      .orderBy(messagesTable.createdAt)
      .limit(Math.min(limit, 100));

    const messages = await query;

    const senderIds = [...new Set(messages.map((m) => m.senderId))];
    const senders =
      senderIds.length > 0
        ? await db
            .select()
            .from(usersTable)
            .where(
              senderIds.length === 1
                ? eq(usersTable.id, senderIds[0])
                : eq(usersTable.id, senderIds[0]),
            )
        : [];

    // Build a map — fetch all senders individually for simplicity
    const senderMap = new Map<number, typeof usersTable.$inferSelect>();
    for (const sid of senderIds) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, sid));
      if (u) senderMap.set(sid, u);
    }

    const result = messages.map((m) => ({
      ...m,
      sender: senderMap.has(m.senderId) ? formatUser(senderMap.get(m.senderId)!) : undefined,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "list-messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/chats/:chatId/messages
router.post("/chats/:chatId/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "content required" });
      return;
    }

    const [msg] = await db
      .insert(messagesTable)
      .values({ chatId, senderId: req.userId!, content: content.trim() })
      .returning();

    const [sender] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!));

    const fullMsg = { ...msg, sender: sender ? formatUser(sender) : undefined };

    // Emit to all members in the chat room via Socket.IO
    if (io) {
      io.to(`chat:${chatId}`).emit("message:new", { message: fullMsg });

      // Notify all chat members to refresh their chat list
      const members = await db
        .select()
        .from(chatMembersTable)
        .where(eq(chatMembersTable.chatId, chatId));

      for (const m of members) {
        io.to(`user:${m.userId}`).emit("chat:updated", {
          chatId,
          lastMessage: fullMsg,
        });
      }
    }

    res.status(201).json(fullMsg);
  } catch (err) {
    req.log.error({ err }, "send-message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/chats/:chatId/messages/:messageId
router.delete(
  "/chats/:chatId/messages/:messageId",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const chatId = parseInt(req.params.chatId, 10);
      const messageId = parseInt(req.params.messageId, 10);

      const [msg] = await db
        .select()
        .from(messagesTable)
        .where(and(eq(messagesTable.id, messageId), eq(messagesTable.chatId, chatId)));

      if (!msg || msg.senderId !== req.userId) {
        res.status(403).json({ error: "Cannot delete this message" });
        return;
      }

      await db.delete(messagesTable).where(eq(messagesTable.id, messageId));

      if (io) {
        io.to(`chat:${chatId}`).emit("message:deleted", { messageId, chatId });
      }

      res.json({ message: "Message deleted" });
    } catch (err) {
      req.log.error({ err }, "delete-message error");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export function setMessagesIO(socketServer: SocketServer) {
  io = socketServer;
}

export default router;
