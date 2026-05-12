import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { verifyToken } from "./lib/auth";
import { setMessagesIO } from "./routes/messages";
import { setVoiceIO } from "./routes/voice";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  path: "/socket.io",
});

// Inject io into route handlers
setMessagesIO(io);
setVoiceIO(io);

// Socket.IO auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error("Authentication required"));
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    next(new Error("Invalid token"));
    return;
  }
  socket.data.userId = payload.userId;
  next();
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as number;
  logger.info({ userId, socketId: socket.id }, "Socket connected");

  // Join personal room for direct notifications
  socket.join(`user:${userId}`);

  // Join a chat room
  socket.on("join:chat", (chatId: number) => {
    socket.join(`chat:${chatId}`);
    logger.info({ userId, chatId }, "User joined chat room");
  });

  // Leave a chat room
  socket.on("leave:chat", (chatId: number) => {
    socket.leave(`chat:${chatId}`);
    logger.info({ userId, chatId }, "User left chat room");
  });

  socket.on("disconnect", (reason) => {
    logger.info({ userId, socketId: socket.id, reason }, "Socket disconnected");
  });
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening with Socket.IO");
});
