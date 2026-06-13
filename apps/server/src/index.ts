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
import { WebSocketServer } from "ws";

import { env, parseCorsOrigins } from "./lib/env";
import { initSocket, getOnlineUsers, checkRateLimit, isUserInCall, setUserInCall, checkJoinQueueRate, addUserConnection, removeUserConnection, areUsersBlocked, isUserSuspended, setCallPair, getCallPartner, clearCallPair, checkUserRateLimit } from "./lib/socket";
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
  matchmakingIntervalRef,
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

const CORS_ORIGIN = parseCorsOrigins();

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
app.use("/api", rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later." },
  }));
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

// Fix peer@1.0.2 path bug: internal code appends "peerjs" to the configured path,
// turning "/peerjs" into "/peerjs/peerjs". The WebSocketServer then rejects all
// upgrades that don't match "/peerjs/peerjs". For Socket.IO connections, ws's
// abortHandshake() sends raw HTTP 400 to an already-upgraded WebSocket, causing
// "Invalid frame header" errors.
//
// Fix: use a noServer WebSocketServer and manually route upgrades.
const peerWSS = new WebSocketServer({ noServer: true });
const peerApp = ExpressPeerServer(httpServer, {
  path: "/",
  createWebSocketServer: () => peerWSS,
});
app.use(peerApp);

// Route WebSocket upgrades manually. Engine.io registers its handler first
// (in initSocket), so for /socket.io/ paths it runs first and upgrades the
// socket. Our handler returns early for those paths, preventing PeerJS's
// WebSocketServer from calling abortHandshake() on the upgraded connection.
httpServer.on("upgrade", (req, socket, head) => {
  const pathname = req.url ?? "";

  if (pathname.startsWith("/socket.io/")) {
    return; // Engine.io has already handled (or will handle) this upgrade
  }

  if (pathname.startsWith("/peerjs")) {
    peerWSS.handleUpgrade(req, socket, head, (ws) => {
      peerWSS.emit("connection", ws, req);
    });
    return;
  }

  socket.destroy();
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string | undefined;

  if (userId) {
    if (!addUserConnection(userId)) {
      socket.emit("error", { message: "Too many connections" });
      socket.disconnect(true);
      return;
    }
    socket.join(userId);
    logInfo("Socket", "User connected and joined room", {
      userId,
      socketId: socket.id,
      room: userId,
    });
    socket.broadcast.emit("user:online", { userId });
  } else {
    const safeAuth = { ...socket.handshake.auth };
    if (safeAuth.token) safeAuth.token = "[REDACTED]";
    logDebug("Socket", "Anonymous connection (no userId in auth)", {
      socketId: socket.id,
      auth: JSON.stringify(safeAuth),
    });
  }

  const count = getOnlineUsers(io).size;
  io.emit("onlineCount", { count });

  function wrapRateLimited<T extends (...args: any[]) => unknown>(fn: T): T {
    return ((...args: any[]) => {
      if (checkRateLimit(socket.id)) {
        try {
          const result = fn(...args);
          if (result instanceof Promise) {
            result.catch((err) => {
              logError("Socket", "Unhandled handler error", { error: String(err) });
            });
          }
        } catch (err) {
          logError("Socket", "Handler sync error", { error: String(err) });
        }
      } else {
        socket.emit("error", { message: "Too many requests. Please slow down." });
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
    const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
    if (!VALID_LEVELS.includes(data.level)) {
      socket.emit("error", { message: "Invalid English level" });
      return;
    }
    logInfo("Queue", `User joining queue`, { userId, level: data.level, interests: data.interests });
    try {
      const MAX_INTERESTS = 20;
      const interests = Array.isArray(data.interests)
        ? data.interests.filter(i => typeof i === "string").slice(0, MAX_INTERESTS)
        : [];
      await addToQueue({
        userId,
        level: data.level,
        interests,
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
    try {
      if (queueInterval) {
        clearInterval(queueInterval);
        queueInterval = null;
      }
      await removeFromQueue(userId);
    } catch (err) {
      logError("Queue", "Failed to leave queue", { userId, error: String(err) });
    }
  }));

  socket.on("callEnded", wrapRateLimited(({ roomId, partnerUserId }) => {
    if (!userId) return;
    setUserInCall(userId, false);
    if (partnerUserId && getCallPartner(userId) === partnerUserId) {
      setUserInCall(partnerUserId, false);
      socket.to(partnerUserId).emit("partnerLeft");
    }
    clearCallPair(userId);
  }));

  socket.on("message:send", wrapRateLimited(async (data) => {
    if (!userId) return;
    if (!data.receiverId || typeof data.receiverId !== "string" || !data.content || typeof data.content !== "string") return;

    if (!checkUserRateLimit(userId)) {
      socket.emit("error", { message: "Too many requests. Please slow down." });
      return;
    }

    if (await isUserSuspended(userId)) {
      socket.emit("error", { message: "Account suspended" });
      return;
    }

    if (await areUsersBlocked(userId, data.receiverId)) {
      socket.emit("error", { message: "Cannot send message to this user" });
      return;
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: userId, addresseeId: data.receiverId },
          { requesterId: data.receiverId, addresseeId: userId },
        ],
      },
    });
    if (!friendship) {
      socket.emit("error", { message: "Can only send messages to friends" });
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

      socket.to(data.receiverId).emit("message:received", payload);
      socket.emit("message:received", payload);
    } catch (err) {
      logError("Socket", "Failed to send message", { userId, error: String(err) });
      socket.emit("error", { message: "Failed to send message" });
    }
  }));

  socket.on("typing:start", wrapRateLimited(async ({ receiverId }) => {
    if (!userId || !receiverId || typeof receiverId !== "string") return;
    if (await areUsersBlocked(userId, receiverId)) return;
    socket.to(receiverId).emit("typing:start", { senderId: userId });
  }));

  socket.on("typing:stop", wrapRateLimited(async ({ receiverId }) => {
    if (!userId || !receiverId || typeof receiverId !== "string") return;
    if (await areUsersBlocked(userId, receiverId)) return;
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
    const partnerMatch = getPendingMatch(partnerUserId);
    if (!partnerMatch || partnerMatch.partnerUserId !== userId) {
      socket.emit("error", { message: "Match no longer available" });
      return;
    }
    logInfo("Match", "Match accepted", { userId, partnerUserId });
    setUserInCall(userId, true);
    setUserInCall(partnerUserId, true);
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

  socket.on("friend:call", wrapRateLimited(async ({ friendId, roomId }) => {
    if (!userId || !friendId || !roomId) return;

    if (!checkUserRateLimit(userId)) {
      socket.emit("error", { message: "Too many requests. Please slow down." });
      return;
    }

    if (isUserInCall(userId)) {
      socket.emit("error", { message: "You are already in a call" });
      return;
    }

    const [callerSuspended, friendSuspended] = await Promise.all([
      isUserSuspended(userId),
      isUserSuspended(friendId),
    ]);
    if (callerSuspended) {
      socket.emit("error", { message: "Account suspended" });
      return;
    }
    if (friendSuspended) {
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

    if (await areUsersBlocked(userId, friendId)) {
      socket.emit("error", { message: "Cannot call this user" });
      return;
    }

    if (isUserInCall(friendId)) {
      socket.emit("error", { message: "User is currently in a call" });
      return;
    }

    const callerProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const actualCallerName = callerProfile?.name || "Unknown";

    setCallPair(userId, friendId);
    logInfo("Friend", "Friend call initiated", { callerId: userId, friendId, roomId });
    socket.to(friendId).emit("friend:calling", { callerId: userId, callerName: actualCallerName, roomId });
  }));

  socket.on("friend:call-answer", wrapRateLimited(async ({ callerId, accepted, roomId }) => {
    if (!userId || !callerId) return;

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: userId, addresseeId: callerId },
          { requesterId: callerId, addresseeId: userId },
        ],
      },
    });
    if (!friendship) {
      logWarn("Friend", "call-answer: not friends", { userId, callerId });
      return;
    }

    const [blockA, blockB] = await Promise.all([
      prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: userId, blockedId: callerId } } }),
      prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: callerId, blockedId: userId } } }),
    ]);
    if (blockA || blockB) return;

    logInfo("Friend", "Friend call answer", { answererId: userId, callerId, accepted });
    if (accepted) {
      setUserInCall(callerId, true);
      setUserInCall(userId, true);
      setCallPair(userId, callerId);
    }
    socket.to(callerId).emit("friend:call-answer", { callerId, answererId: userId, accepted, roomId });
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
        clearCallPair(userId);
        await removeFromQueue(userId);
        const pending = getPendingMatch(userId);
        if (pending) {
          setUserInCall(pending.partnerUserId, false);
          clearCallPair(pending.partnerUserId);
          removePendingMatch(userId);
          removePendingMatch(pending.partnerUserId);
          io.to(pending.partnerUserId).emit("partnerLeft");
        }
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

function gracefulShutdown(fromUncaught = false) {
  logInfo("Shutdown", "Shutting down gracefully...");
  clearInterval(matchmakingIntervalRef);
  io.disconnectSockets(true);
  io.close();
  server.close(() => {
    logInfo("Shutdown", "HTTP server closed");
  });
  disconnectPrisma().then(() => {
    logInfo("Shutdown", "Prisma disconnected");
    process.exit(fromUncaught ? 1 : 0);
  });
  setTimeout(() => {
    logError("Shutdown", "Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("uncaughtException", (err) => {
  logError("Process", "Uncaught exception", { error: err.message, stack: err.stack });
  gracefulShutdown(true);
});
process.on("unhandledRejection", (reason) => {
  logError("Process", "Unhandled rejection", { reason: String(reason) });
  gracefulShutdown(true);
});

export { app, io };
