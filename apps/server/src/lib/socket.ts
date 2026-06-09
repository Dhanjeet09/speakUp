import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { logInfo, logDebug, logWarn } from "./logger";
import { createAnonSupabaseClient } from "./supabase";
import { prisma } from "./db";

let io: Server | null = null;

const RATE_LIMIT_WINDOW = 10000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; start: number }>();

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(socketId);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(socketId, { count: 1, start: now });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }
}, 30000);

const userCallMap = new Map<string, boolean>();
export function isUserInCall(userId: string): boolean {
  return userCallMap.has(userId);
}
export function setUserInCall(userId: string, inCall: boolean): void {
  if (inCall) userCallMap.set(userId, true);
  else userCallMap.delete(userId);
}

const userConnectionCount = new Map<string, number>();
export function addUserConnection(userId: string): void {
  const count = userConnectionCount.get(userId) || 0;
  userConnectionCount.set(userId, count + 1);
}
export function removeUserConnection(userId: string): number {
  const count = userConnectionCount.get(userId) || 0;
  if (count <= 1) {
    userConnectionCount.delete(userId);
    return 0;
  }
  userConnectionCount.set(userId, count - 1);
  return count - 1;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocket first.");
  }
  return io;
}

export function initSocket(httpServer: HttpServer): Server {
  logInfo("Socket", "Initializing Socket.IO");
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    perMessageDeflate: false,
  });

  io.use(async (socket, next) => {
    const userId = socket.handshake.auth?.userId as string | undefined;
    const token = socket.handshake.auth?.token as string | undefined;

    if (!userId) {
      logDebug("Socket", "Anonymous connection", { socketId: socket.id });
      return next();
    }

    if (!token) {
      logWarn("Socket", "Token required for authenticated connections", { socketId: socket.id, userId });
      return next(new Error("Authentication token required"));
    }

    try {
      const supabase = createAnonSupabaseClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        logWarn("Socket", "Invalid token rejected", { socketId: socket.id, userId, error: String(error) });
        return next(new Error("Invalid authentication token"));
      }
      if (data.user.id !== userId) {
        logWarn("Socket", "Token userId mismatch", { socketId: socket.id, claimedUserId: userId, tokenUserId: data.user.id });
        return next(new Error("Authentication mismatch"));
      }

      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { isSuspended: true },
      });

      if (userRecord?.isSuspended) {
        logWarn("Socket", "Suspended user rejected", { socketId: socket.id, userId });
        return next(new Error("Account suspended"));
      }

      socket.data.userId = userId;
      logDebug("Socket", "Authenticated via token", { socketId: socket.id, userId });
      return next();
    } catch (err) {
      logWarn("Socket", "Token verification exception", { socketId: socket.id, userId, error: String(err) });
      return next(new Error("Authentication verification failed"));
    }
  });

  return io;
}

const JOIN_QUEUE_LIMIT_WINDOW = 5000;
const joinQueueMap = new Map<string, number>();
export function checkJoinQueueRate(userId: string): boolean {
  const now = Date.now();
  const lastJoin = joinQueueMap.get(userId);
  if (lastJoin && now - lastJoin < JOIN_QUEUE_LIMIT_WINDOW) {
    return false;
  }
  joinQueueMap.set(userId, now);
  return true;
}

export { checkRateLimit };

export function getOnlineUsers(socketServer: Server): Set<string> {
  const users = new Set<string>();
  for (const [, socket] of socketServer.sockets.sockets) {
    const uid = socket.data.userId as string | undefined;
    if (uid) users.add(uid);
  }
  return users;
}
