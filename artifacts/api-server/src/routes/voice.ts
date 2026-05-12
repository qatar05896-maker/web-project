import { Router } from "express";
import { db, usersTable, voiceParticipantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

async function getVoiceRoomData(chatId: number) {
  const participants = await db
    .select()
    .from(voiceParticipantsTable)
    .where(eq(voiceParticipantsTable.chatId, chatId));

  const result = [];
  for (const p of participants) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, p.userId));
    if (user) {
      result.push({
        user: formatUser(user),
        micEnabled: p.micEnabled,
        cameraEnabled: p.cameraEnabled,
        joinedAt: p.joinedAt,
      });
    }
  }

  return {
    chatId,
    active: result.length > 0,
    participants: result,
  };
}

// GET /api/chats/:chatId/voice
router.get("/chats/:chatId/voice", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const room = await getVoiceRoomData(chatId);
    res.json(room);
  } catch (err) {
    req.log.error({ err }, "get-voice-room error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/chats/:chatId/voice — join
router.post("/chats/:chatId/voice", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);
    const { micEnabled = true, cameraEnabled = false } = req.body;

    await db
      .insert(voiceParticipantsTable)
      .values({
        chatId,
        userId: req.userId!,
        micEnabled,
        cameraEnabled,
      })
      .onConflictDoNothing();

    const room = await getVoiceRoomData(chatId);

    if (io) {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, req.userId!));

      if (user) {
        io.to(`chat:${chatId}`).emit("voice:joined", {
          chatId,
          participant: {
            user: formatUser(user),
            micEnabled,
            cameraEnabled,
            joinedAt: new Date(),
          },
        });
      }
    }

    res.json(room);
  } catch (err) {
    req.log.error({ err }, "join-voice-room error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/chats/:chatId/voice — leave
router.delete("/chats/:chatId/voice", requireAuth, async (req: AuthRequest, res) => {
  try {
    const chatId = parseInt(req.params.chatId, 10);

    await db
      .delete(voiceParticipantsTable)
      .where(
        and(
          eq(voiceParticipantsTable.chatId, chatId),
          eq(voiceParticipantsTable.userId, req.userId!),
        ),
      );

    if (io) {
      io.to(`chat:${chatId}`).emit("voice:left", {
        chatId,
        userId: req.userId,
      });
    }

    res.json({ message: "Left voice room" });
  } catch (err) {
    req.log.error({ err }, "leave-voice-room error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export function setVoiceIO(socketServer: SocketServer) {
  io = socketServer;
}

export default router;
