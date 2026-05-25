import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createSupabaseClient } from "./supabase";
import { logInfo, logWarn, logError, logDebug } from "./logger";

let io: Server | null = null;

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

export function getOnlineUsers(socketServer: Server): Set<string> {
  const users = new Set<string>();
  for (const [, socket] of socketServer.sockets.sockets) {
    const uid = socket.data.userId as string | undefined;
    if (uid) users.add(uid);
  }
  return users;
}
