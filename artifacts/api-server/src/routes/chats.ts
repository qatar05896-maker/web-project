import { Router } from "express";
import {
  db,
  usersTable,
  chatsTable,
  chatMembersTable,
  messagesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth";
import type { Server as SocketServer } from "socket.io";

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

async function getChatWithMembers(chatId: number, currentUserId: number) {
  const [chat] = await db.select().from(chatsTable).where(eq(chatsTable.id, chatId));
  if (!chat) return null;

  const members = await db
    .select()
    .from(chatMembersTable)
    .where(eq(chatMembersTable.chatId, chatId));

  const userIds = members.map((m) => m.userId);
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  const [lastMsg] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.chatId, chatId))
    .orderBy(messagesTable.createdAt)
    .limit(1);

  let lastMessage = undefined;
  if (lastMsg) {
    const sender = userMap.get(lastMsg.senderId);
    lastMessage = {
      ...lastMsg,
      sender: sender ? formatUser(sender) : undefined,
    };
  }

  const otherMember = chat.type === "direct"
    ? members.find((m) => m.userId !== currentUserId)
    : undefined;
  const otherUser = otherMember ? userMap.get(otherMember.userId) : undefined;

  return {
    ...chat,
    members: members.map((m) => ({
      user: formatUser(userMap.get(m.userId)!),
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    lastMessage,
    otherUser: otherUser ? formatUser(otherUser) : undefined,
  };
}

// GET /api/chats
router.get("/chats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const myMemberships = await db
      .select()
      .from(chatMembersTable)
      .where(eq(chatMembersTable.userId, req.userId!));

    const chatIds = myMemberships.map((m) => m.chatId);
    if (chatIds.length === 0) {
      res.json([]);
      return;
    }

    const chats = await db
      .select()
      .from(chatsTable)
      .where(inArray(chatsTable.id, chatIds));

    const results = await Promise.all(
      chats.map(async (chat) => {
        const members = await db
          .select()
          .from(chatMembersTable)
          .where(eq(chatMembersTable.chatId, chat.id));

        const userIds = members.map((m) => m.userId);
        const users = userIds.length > 0
          ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
          : [];
        const userMap = new Map(users.map((u) => [u.id, u]));

        const msgs = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.chatId, chat.id))
          .orderBy(messagesTable.createdAt)
          .limit(1);

        const lastMsg = msgs[0];
        let lastMessage = undefined;
        if (lastMsg) {
          const sender = userMap.get(lastMsg.senderId);
          lastMessage = { ...lastMsg, sender: sender ? formatUser(sender) : undefined };
        }

        const otherMember = chat.type === "direct"
          ? members.find((m) => m.userId !== req.userId)
          : undefined;
        const otherUser = otherMember ? userMap.get(otherMember.userId) : undefined;

        return {
          id: chat.id,
          type: chat.type,
          name: chat.name,
          avatarUrl: chat.avatarUrl,
          createdAt: chat.createdAt,
          lastMessage,
          unreadCount: 0,
          otherUser: otherUser ? formatUser(otherUser) : undefined,
        };
      }),
    );

    // Sort by last message time descending
    results.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.lastMessage?.createdAt?.getTime() ?? b.createdAt.getTime();
      return bTime - aTime;
    });

    res.json(results);
  } catch (err) {
    req.log.error({ err }, "list-chats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/chats
router.post("/chats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, name, memberIds } = req.body;
    if (!type) {
      res.status(400).json({ error: "type required" });
      return;
    }

    const [chat] = await db
      .insert(chatsTable)
      .values({ type, name: name ?? null })
      .returning();

    // Add creator as admin
    const memberList: { chatId: number; userId: number; role: string }[] = [
      { chatId: chat.id, userId: req.userId!, role: "admin" },
    ];

    if (Array.isArray(memberIds)) {
      for (const uid of memberIds) {
        if (uid !== req.userId) {
          memberList.push({ chatId: chat.id, userId: uid, role: "member" });
        }
      }
    }

    await db.insert(chatMembersTable).values(memberList);

    const full = await getChatWithMembers(chat.id, req.userId!);
    res.status(201).json(full);
  } catch (err) {
    req.log.error({ err }, "create-chat error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/chats/:chatId
router.get("/chats/:chatId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const full = await getChatWithMembers(chatId, req.userId!);
    if (!full) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }
    res.json(full);
  } catch (err) {
    req.log.error({ err }, "get-chat error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/chats/:chatId
router.patch("/chats/:chatId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const { name, description, avatarUrl } = req.body;

    const updates: Partial<typeof chatsTable.$inferSelect> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    await db.update(chatsTable).set(updates).where(eq(chatsTable.id, chatId));
    const full = await getChatWithMembers(chatId, req.userId!);
    res.json(full);
  } catch (err) {
    req.log.error({ err }, "update-chat error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/chats/:chatId/members
router.post("/chats/:chatId/members", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const { userId } = req.body;

    await db
      .insert(chatMembersTable)
      .values({ chatId, userId, role: "member" })
      .onConflictDoNothing();

    const full = await getChatWithMembers(chatId, req.userId!);
    res.json(full);
  } catch (err) {
    req.log.error({ err }, "add-member error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/chats/:chatId/members/:userId
router.delete("/chats/:chatId/members/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const userId = parseInt(req.params.userId, 10);

    await db
      .delete(chatMembersTable)
      .where(
        and(
          eq(chatMembersTable.chatId, chatId),
          eq(chatMembersTable.userId, userId),
        ),
      );

    res.json({ message: "Member removed" });
  } catch (err) {
    req.log.error({ err }, "remove-member error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/chats/direct/:userId
router.post("/chats/direct/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const myId = req.userId!;

    // Find existing direct chat between these two users
    const myChats = await db
      .select()
      .from(chatMembersTable)
      .where(eq(chatMembersTable.userId, myId));

    const directChatIds = myChats.map((m) => m.chatId);

    if (directChatIds.length > 0) {
      const targetChats = await db
        .select()
        .from(chatMembersTable)
        .where(and(
          inArray(chatMembersTable.chatId, directChatIds),
          eq(chatMembersTable.userId, targetUserId),
        ));

      for (const tc of targetChats) {
        const [chat] = await db
          .select()
          .from(chatsTable)
          .where(and(eq(chatsTable.id, tc.chatId), eq(chatsTable.type, "direct")));
        if (chat) {
          const full = await getChatWithMembers(chat.id, myId);
          res.json(full);
          return;
        }
      }
    }

    // Create new direct chat
    const [chat] = await db
      .insert(chatsTable)
      .values({ type: "direct" })
      .returning();

    await db.insert(chatMembersTable).values([
      { chatId: chat.id, userId: myId, role: "member" },
      { chatId: chat.id, userId: targetUserId, role: "member" },
    ]);

    const full = await getChatWithMembers(chat.id, myId);
    res.json(full);
  } catch (err) {
    req.log.error({ err }, "open-direct-chat error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export function createChatsRouter(_io?: SocketServer) {
  return router;
}

export default router;
