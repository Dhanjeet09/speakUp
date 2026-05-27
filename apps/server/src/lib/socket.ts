import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createSupabaseClient } from "./supabase";
import { logInfo, logWarn, logError, logDebug } from "./logger";

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
  });

  io.use(async (socket, next) => {
    const userId = socket.handshake.auth?.userId as string | undefined;
    if (!userId) {
      logDebug("Socket", "Anonymous connection", { socketId: socket.id });
      return next();
    }

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error || !data.user) {
        logWarn("Socket", "Connection rejected: invalid user", { userId, error: String(error) });
        return next(new Error("Invalid user authentication"));
      }
      socket.data.userId = userId;
      logInfo("Socket", "User authenticated via socket", { userId, socketId: socket.id });
      next();
    } catch (err) {
      logError("Socket", "Socket auth verification failed", { userId, error: String(err) });
      next(new Error("Authentication verification failed"));
    }
  });

  return io;
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
