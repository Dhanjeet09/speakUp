import express from "express";
import { createServer } from "http";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import { initSocket, getIO, getOnlineUsers } from "./lib/socket";
import { disconnectPrisma, initDb } from "./lib/db";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { logInfo, logError, logWarn } from "./lib/logger";

import authRoutes from "./routes/auth";
import sessionsRoutes from "./routes/sessions";
import usersRoutes from "./routes/users";
import reportsRoutes from "./routes/reports";
import {
  addToQueue,
  removeFromQueue,
  getQueueSize,
  initMatchmaking,
} from "./services/matchmaking";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

initDb().catch(() => {});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
const PORT = parseInt(process.env.PORT || "4000", 10);

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  socket.join(userId);
  logInfo("Socket", `User connected`, { userId, socketId: socket.id });

  const count = getOnlineUsers(io).size;
  io.emit("onlineCount", { count });

  socket.on("getOnlineCount", () => {
    socket.emit("onlineCount", { count: getOnlineUsers(io).size });
  });

  let queueInterval: ReturnType<typeof setInterval> | null = null;

  socket.on("joinQueue", async (data) => {
    logInfo("Queue", `User joining queue`, { userId, level: data.level, interests: data.interests });
    try {
      await addToQueue({
        userId,
        level: data.level,
        interests: data.interests || [],
        blockedUserIds: data.blockedUserIds || [],
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
  });

  socket.on("leaveQueue", async () => {
    logInfo("Queue", `User leaving queue`, { userId });
    if (queueInterval) {
      clearInterval(queueInterval);
      queueInterval = null;
    }
    await removeFromQueue(userId);
  });

  socket.on("callEnded", ({ roomId }) => {
    logInfo("Call", `Call ended`, { userId, roomId });
    if (roomId) {
      socket.to(roomId).emit("partnerLeft");
    }
  });

  socket.on("disconnect", async () => {
    logInfo("Socket", `User disconnected`, { userId, socketId: socket.id });
    if (queueInterval) {
      clearInterval(queueInterval);
    }
    await removeFromQueue(userId);
    const count = getOnlineUsers(io).size;
    io.emit("onlineCount", { count });
  });
});

const server = httpServer.listen(PORT, () => {
  logInfo("Startup", `SpeakUp server running`, { port: PORT, corsOrigin: CORS_ORIGIN });

  if (process.env.REDIS_URL) {
    try {
      initMatchmaking();
      logInfo("Startup", "Matchmaking started");
    } catch (err) {
      logError("Startup", "Matchmaking not available", { error: String(err) });
    }
  } else {
    try {
      initMatchmaking();
      logInfo("Startup", "Matchmaking started (in-memory queue)");
    } catch (err) {
      logError("Startup", "Matchmaking not available", { error: String(err) });
    }
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
