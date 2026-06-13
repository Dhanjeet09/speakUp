import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@speakup/types";
import jwt from "jsonwebtoken";
import { env, parseCorsOrigins } from "./env";
import { logInfo, logDebug, logWarn } from "./logger";
import { createAnonSupabaseClient } from "./supabase";
import { prisma } from "./db";

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

let io: TypedServer | null = null;

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

setInterval(() => {
  const now = Date.now();
  for (const [key, time] of joinQueueMap) {
    if (now - time > JOIN_QUEUE_LIMIT_WINDOW * 2) {
      joinQueueMap.delete(key);
    }
  }
  for (const [key, entry] of userRateLimitMap) {
    if (now - entry.start > USER_RATE_LIMIT_WINDOW) {
      userRateLimitMap.delete(key);
    }
  }
}, 60000);

const userCallMap = new Map<string, boolean>();
export function isUserInCall(userId: string): boolean {
  return userCallMap.has(userId);
}
export function setUserInCall(userId: string, inCall: boolean): void {
  if (inCall) userCallMap.set(userId, true);
  else userCallMap.delete(userId);
}

export const callPartnerMap = new Map<string, string>();
export function setCallPair(user1: string, user2: string): void {
  callPartnerMap.set(user1, user2);
  callPartnerMap.set(user2, user1);
}
export function clearCallPair(userId: string): void {
  const partner = callPartnerMap.get(userId);
  if (partner) callPartnerMap.delete(partner);
  callPartnerMap.delete(userId);
}
export function getCallPartner(userId: string): string | undefined {
  return callPartnerMap.get(userId);
}

const userConnectionCount = new Map<string, number>();
const MAX_CONNECTIONS_PER_USER = 10;
export function addUserConnection(userId: string): boolean {
  const count = userConnectionCount.get(userId) || 0;
  if (count >= MAX_CONNECTIONS_PER_USER) {
    return false;
  }
  userConnectionCount.set(userId, count + 1);
  return true;
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

export function getIO(): TypedServer {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocket first.");
  }
  return io;
}

export function initSocket(httpServer: HttpServer): TypedServer {
  logInfo("Socket", "Initializing Socket.IO");
  const origins = parseCorsOrigins();
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: origins,
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
      const JWT_SECRET = env.SUPABASE_JWT_SECRET;
      let verifiedUserId: string | undefined;

      if (JWT_SECRET) {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
        if (!decoded.aud || decoded.aud !== "authenticated") {
          logWarn("Socket", "Invalid token audience", { socketId: socket.id, aud: decoded.aud });
          return next(new Error("Invalid authentication token"));
        }
        verifiedUserId = decoded.sub;
      } else {
        const supabase = createAnonSupabaseClient();
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
          logWarn("Socket", "Invalid token rejected", { socketId: socket.id, error: String(error) });
          return next(new Error("Invalid authentication token"));
        }
        verifiedUserId = data.user.id;
      }

      if (!verifiedUserId || verifiedUserId !== userId) {
        logWarn("Socket", "Token userId mismatch", { socketId: socket.id, claimedUserId: userId });
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
      logDebug("Socket", "Authenticated", { socketId: socket.id, userId });
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

const userRateLimitMap = new Map<string, { count: number; start: number }>();
const USER_RATE_LIMIT_MAX = 20;
const USER_RATE_LIMIT_WINDOW = 10000;

export function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRateLimitMap.get(userId);
  if (!entry || now - entry.start > USER_RATE_LIMIT_WINDOW) {
    userRateLimitMap.set(userId, { count: 1, start: now });
    return true;
  }
  entry.count++;
  return entry.count <= USER_RATE_LIMIT_MAX;
}

export async function areUsersBlocked(userAId: string, userBId: string): Promise<boolean> {
  try {
    const [aBlocksB, bBlocksA] = await Promise.all([
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userAId, blockedId: userBId } },
      }),
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userBId, blockedId: userAId } },
      }),
    ]);
    return !!aBlocksB || !!bBlocksA;
  } catch {
    return false;
  }
}

export async function isUserSuspended(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true },
    });
    return user?.isSuspended ?? false;
  } catch {
    return false;
  }
}

export { checkRateLimit };

export function getOnlineUsers(socketServer: TypedServer): Set<string> {
  const users = new Set<string>();
  for (const [, socket] of socketServer.sockets.sockets) {
    const uid = socket.data.userId as string | undefined;
    if (uid) users.add(uid);
  }
  return users;
}
