import "dotenv/config";
import express from "express";
import { createServer } from "http";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import sanitizeHtml from "sanitize-html";

import { ExpressPeerServer } from "peer";

import { env } from "./lib/env";
import { initSocket, getOnlineUsers, checkRateLimit, isUserInCall, setUserInCall, checkJoinQueueRate, addUserConnection, removeUserConnection } from "./lib/socket";
import { disconnectPrisma, initDb, prisma } from "./lib/db";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { logInfo, logWarn, logError, logDebug } from "./lib/logger";

import authRoutes from "./routes/auth";
import sessionsRoutes from "./routes/sessions";
import usersRoutes from "./routes/users";
import reportsRoutes from "./routes/reports";
import messagesRoutes from "./routes/messages";
import friendsRoutes from "./routes/friends";
import {
  addToQueue,
  removeFromQueue,
  getQueueSize,
  initMatchmaking,
  getPendingMatch,
  removePendingMatch,
} from "./services/matchmaking";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    integrations: (integrations) =>
      integrations.filter((i) => !i.name.toLowerCase().includes("mongo")),
  });
}

const app = express();
const httpServer = createServer(app);

const CORS_ORIGIN = env.CORS_ORIGIN.split(",").map((s) => s.trim());

initDb().catch(() => {});

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...CORS_ORIGIN, "wss://*.supabase.co", "https://*.supabase.co"],
        imgSrc: ["'self'", "data:", "https://*.supabase.co"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
app.use(compression({ filter: (req, res) => {
  if (req.headers.upgrade) return false;
  return compression.filter(req, res);
} }));
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later" },
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(requestLogger);

app.set("trust proxy", 1);

app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/friends", friendsRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

app.use(errorHandler);

const io = initSocket(httpServer);
const PORT = env.PORT;

app.use("/peerjs", ExpressPeerServer(httpServer, { path: "/peerjs" }));

io.on("connection", (socket) => {
  const userId = socket.data.userId as string | undefined;

  if (userId) {
    socket.join(userId);
    addUserConnection(userId);
    logInfo("Socket", "User connected and joined room", {
      userId,
      socketId: socket.id,
      room: userId,
    });
    socket.broadcast.emit("user:online", { userId });
  } else {
    logDebug("Socket", "Anonymous connection (no userId in auth)", {
      socketId: socket.id,
      auth: JSON.stringify(socket.handshake.auth),
    });
  }

  const count = getOnlineUsers(io).size;
  io.emit("onlineCount", { count });

  function wrapRateLimited<T extends (...args: unknown[]) => void>(fn: T): T {
    return ((...args: unknown[]) => {
      if (checkRateLimit(socket.id)) {
        fn(...args);
      }
    }) as T;
  }

  socket.on("getOnlineCount", wrapRateLimited(() => {
    socket.emit("onlineCount", { count: getOnlineUsers(io).size });
  }));

  let queueInterval: ReturnType<typeof setInterval> | null = null;

  socket.on("joinQueue", wrapRateLimited(async (data) => {
    if (!userId) return;
    if (isUserInCall(userId)) {
      logWarn("Queue", "User already in a call, cannot join queue", { userId });
      socket.emit("error", { message: "You are already in a call" });
      return;
    }
    if (!checkJoinQueueRate(userId)) {
      logWarn("Queue", "Join queue rate limited", { userId });
      socket.emit("error", { message: "Please wait before searching again" });
      return;
    }
    logInfo("Queue", `User joining queue`, { userId, level: data.level, interests: data.interests });
    try {
      await addToQueue({
        userId,
        level: data.level,
        interests: data.interests || [],
        joinedAt: Date.now(),
      });

      queueInterval = setInterval(async () => {
        try {
          const count = await getQueueSize();
          socket.emit("queuePosition", { waitingCount: count });
        } catch {
          socket.emit("queuePosition", { waitingCount: 0 });
        }
      }, 5000);
    } catch (err) {
      logError("Queue", `Failed to join queue`, { userId, error: String(err) });
      socket.emit("error", { message: "Failed to join queue" });
    }
  }));

  socket.on("leaveQueue", wrapRateLimited(async () => {
    if (!userId) return;
    logInfo("Queue", `User leaving queue`, { userId });
    if (queueInterval) {
      clearInterval(queueInterval);
      queueInterval = null;
    }
    await removeFromQueue(userId);
  }));

  socket.on("callEnded", wrapRateLimited(({ roomId, partnerUserId }) => {
    if (!userId) return;
    logInfo("Call", `Call ended`, { userId, roomId, partnerUserId });
    setUserInCall(userId, false);
    if (partnerUserId) {
      setUserInCall(partnerUserId, false);
      socket.to(partnerUserId).emit("partnerLeft");
    } else if (roomId) {
      socket.to(roomId).emit("partnerLeft");
    }
  }));

  socket.on("message:send", wrapRateLimited(async (data) => {
    if (!userId) return;
    if (!data.receiverId || !data.content || typeof data.content !== "string") return;

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true },
    });
    if (userRecord?.isSuspended) {
      socket.emit("error", { message: "Account suspended" });
      return;
    }

    const [blockedBySender, blockedByReceiver] = await Promise.all([
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: data.receiverId } },
      }),
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: data.receiverId, blockedId: userId } },
      }),
    ]);

    if (blockedBySender || blockedByReceiver) {
      socket.emit("error", { message: "Cannot send message to this user" });
      return;
    }

    const sanitized = sanitizeHtml(data.content, { allowedTags: [], allowedAttributes: {} }).slice(0, 1000);

    logInfo("Socket", "message:send received", {
      socketId: socket.id,
      senderId: userId,
      receiverId: data.receiverId,
      contentPreview: sanitized.slice(0, 50),
    });

    try {
      const message = await prisma.chatMessage.create({
        data: {
          senderId: userId,
          receiverId: data.receiverId,
          content: sanitized,
        },
      });

      logInfo("Socket", "Message saved from socket", {
        messageId: message.id,
        senderId: userId,
        receiverId: data.receiverId,
      });

      const payload = {
        message: {
          id: message.id,
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        },
      };

      const receiverSockets = await io.in(data.receiverId).fetchSockets();
      logInfo("Socket", "Emitting message:received", {
        event: "message:received",
        toReceiver: data.receiverId,
        toSender: userId,
        socketId: socket.id,
        messageId: message.id,
        receiverSocketsInRoom: receiverSockets.length,
      });

      socket.to(data.receiverId).emit("message:received", payload);
      socket.emit("message:received", payload);
    } catch (err) {
      logError("Socket", "Failed to send message", { userId, error: String(err) });
      socket.emit("error", { message: "Failed to send message" });
    }
  }));

  socket.on("typing:start", wrapRateLimited(({ receiverId }) => {
    if (!userId || !receiverId) return;
    socket.to(receiverId).emit("typing:start", { senderId: userId });
  }));

  socket.on("typing:stop", wrapRateLimited(({ receiverId }) => {
    if (!userId || !receiverId) return;
    socket.to(receiverId).emit("typing:stop", { senderId: userId });
  }));

  socket.on("match:accept", wrapRateLimited(async ({ userId: partnerUserId }) => {
    if (!userId || !partnerUserId) return;
    const match = getPendingMatch(userId);
    if (!match || match.partnerUserId !== partnerUserId) {
      logWarn("Match", "Invalid match:accept - no pending match", { userId, partnerUserId });
      socket.emit("error", { message: "No pending match found" });
      return;
    }
    logInfo("Match", "Match accepted", { userId, partnerUserId });
    removePendingMatch(userId);
    removePendingMatch(partnerUserId);
    io.to(partnerUserId).emit("match:accepted", { userId });
  }));

  socket.on("match:reject", wrapRateLimited(async ({ userId: partnerUserId }) => {
    if (!userId || !partnerUserId) return;
    const match = getPendingMatch(userId);
    if (!match || match.partnerUserId !== partnerUserId) {
      logWarn("Match", "Invalid match:reject - no pending match", { userId, partnerUserId });
      return;
    }
    logInfo("Match", "Match rejected", { userId, partnerUserId });
    setUserInCall(userId, false);
    setUserInCall(partnerUserId, false);
    removePendingMatch(userId);
    removePendingMatch(partnerUserId);
    io.to(partnerUserId).emit("match:rejected", { userId });
  }));

  socket.on("friend:call", wrapRateLimited(async ({ friendId, roomId, callerName }) => {
    if (!userId || !friendId || !roomId || !callerName) return;

    const callerRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true },
    });
    if (callerRecord?.isSuspended) {
      socket.emit("error", { message: "Account suspended" });
      return;
    }

    const friendRecord = await prisma.user.findUnique({
      where: { id: friendId },
      select: { isSuspended: true },
    });
    if (friendRecord?.isSuspended) {
      socket.emit("error", { message: "Cannot call a suspended user" });
      return;
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });
    if (!friendship) {
      logWarn("Friend", "Call blocked - not friends", { callerId: userId, friendId });
      socket.emit("error", { message: "You can only call friends" });
      return;
    }

    logInfo("Friend", "Friend call initiated", { callerId: userId, friendId, roomId });
    socket.to(friendId).emit("friend:calling", { callerId: userId, callerName, roomId });
  }));

  socket.on("friend:call-answer", wrapRateLimited(({ callerId, accepted }) => {
    if (!userId || !callerId) return;
    logInfo("Friend", "Friend call answer", { answererId: userId, callerId, accepted });
    socket.to(callerId).emit("friend:call-answer", { callerId: userId, accepted });
  }));

  socket.on("disconnect", async (reason) => {
    if (userId) {
      const remaining = removeUserConnection(userId);
      logInfo("Socket", "User disconnected", {
        userId,
        socketId: socket.id,
        reason,
        remainingConnections: remaining,
      });
      if (remaining === 0) {
        setUserInCall(userId, false);
        await removeFromQueue(userId);
        socket.broadcast.emit("user:offline", { userId });
      }
    } else {
      logDebug("Socket", "Anonymous disconnected", { socketId: socket.id, reason });
    }
    if (queueInterval) {
      clearInterval(queueInterval);
    }
    const count = getOnlineUsers(io).size;
    io.emit("onlineCount", { count });
  });
});

const server = httpServer.listen(PORT, () => {
  logInfo("Startup", `SpeakUp server running`, { port: PORT, corsOrigin: CORS_ORIGIN });

  try {
    initMatchmaking();
    logInfo("Startup", "Matchmaking started");
  } catch (err) {
    logError("Startup", "Matchmaking not available", { error: String(err) });
  }
});

function gracefulShutdown() {
  logInfo("Shutdown", "Shutting down gracefully...");
  io.close();
  server.close(async () => {
    await disconnectPrisma();
    logInfo("Shutdown", "Server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logError("Shutdown", "Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("uncaughtException", (err) => {
  logError("Process", "Uncaught exception", { error: err.message, stack: err.stack });
  gracefulShutdown();
});
process.on("unhandledRejection", (reason) => {
  logError("Process", "Unhandled rejection", { reason: String(reason) });
});

export { app, io };
