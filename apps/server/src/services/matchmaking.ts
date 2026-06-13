import crypto from "crypto";
import { getIO, setUserInCall, callPartnerMap, areUsersBlocked } from "../lib/socket";
import { prisma } from "../lib/db";
import { logDebug, logInfo, logWarn, logError } from "../lib/logger";
import { getTodaysTopic as getSharedTopic, DAILY_TOPICS } from "@speakup/config";
import type { QueueUser } from "../types";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const MATCH_INTERVAL_MS = 3000;
const STALE_QUEUE_TIMEOUT_MS = 5 * 60 * 1000;
const INTEREST_MATCH_TIMEOUT_MS = 20000;
const LEVEL_EXPAND_TIMEOUT_MS = 45000;

const queues: Map<string, QueueUser[]> = new Map();
const userMap: Map<string, QueueUser> = new Map();

for (const level of LEVELS) {
  queues.set(`queue:${level}`, []);
}

function getQueue(level: string): QueueUser[] {
  return queues.get(`queue:${level}`) || [];
}

function setQueue(level: string, queue: QueueUser[]) {
  queues.set(`queue:${level}`, queue);
}

export async function addToQueue(user: QueueUser): Promise<void> {
  if (userMap.has(user.userId)) {
    logDebug("Matchmaking", "User already in queue, skipping", { userId: user.userId });
    return;
  }
  const queue = getQueue(user.level);
  queue.push({ ...user, joinedAt: Date.now() });
  setQueue(user.level, queue);
  userMap.set(user.userId, user);
  logDebug("Matchmaking", "User added to queue", { userId: user.userId, level: user.level, queueSize: queue.length });
}

export async function removeFromQueue(userId: string): Promise<void> {
  const user = userMap.get(userId);
  if (!user) return;

  userMap.delete(userId);
  const queue = getQueue(user.level);
  const filtered = queue.filter((u) => u.userId !== userId);
  if (filtered.length !== queue.length) {
    setQueue(user.level, filtered);
  }
  logDebug("Matchmaking", "User removed from queue", { userId, level: user.level });
}

export async function getQueueSize(): Promise<number> {
  let total = 0;
  for (const [, queue] of queues) {
    total += queue.length;
  }
  return total;
}

function removeStaleEntries(): void {
  const now = Date.now();
  for (const [key, queue] of queues) {
    const active = queue.filter((u) => {
      const isStale = now - u.joinedAt > STALE_QUEUE_TIMEOUT_MS;
      if (isStale) userMap.delete(u.userId);
      return !isStale;
    });
    if (active.length !== queue.length) {
      queues.set(key, active);
    }
  }
}

export function getSharedInterests(userA: QueueUser, userB: QueueUser): string[] {
  const interestsB = new Set(userB.interests);
  return userA.interests.filter((i) => interestsB.has(i));
}

function getAdjacentLevels(level: string): string[] {
  const idx = LEVELS.indexOf(level as typeof LEVELS[number]);
  if (idx === -1) return [];
  const adj: string[] = [];
  if (idx > 0) adj.push(LEVELS[idx - 1]);
  if (idx < LEVELS.length - 1) adj.push(LEVELS[idx + 1]);
  return adj;
}

async function getUserProfile(userId: string): Promise<{ name: string; country: string; username: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, country: true, username: true },
    });
    return {
      name: user?.name || userId,
      country: user?.country || "",
      username: user?.username || "",
    };
  } catch {
    return { name: userId, country: "", username: "" };
  }
}

async function createMatch(userA: QueueUser, userB: QueueUser): Promise<void> {
  if (!userMap.has(userA.userId) || !userMap.has(userB.userId)) {
    logWarn("Matchmaking", "Match aborted: one or both users already removed", {
      userA: userA.userId,
      userB: userB.userId,
    });
    return;
  }

  const roomId = `room_${crypto.randomUUID()}`;
  const topic = getSharedTopic(DAILY_TOPICS);

  await removeFromQueue(userA.userId);
  await removeFromQueue(userB.userId);

  setUserInCall(userA.userId, true);
  setUserInCall(userB.userId, true);
  callPartnerMap.set(userA.userId, userB.userId);
  callPartnerMap.set(userB.userId, userA.userId);

  const [profileA, profileB] = await Promise.all([
    getUserProfile(userA.userId),
    getUserProfile(userB.userId),
  ]);

  const io = getIO();

  const userACaller = userA.userId < userB.userId;

  logInfo("Matchmaking", "Match created", {
    userA: userA.userId,
    userB: userB.userId,
    levelA: userA.level,
    levelB: userB.level,
    roomId,
    userACaller,
  });

  pendingMatches.set(userA.userId, { partnerUserId: userB.userId, roomId, timestamp: Date.now() });
  pendingMatches.set(userB.userId, { partnerUserId: userA.userId, roomId, timestamp: Date.now() });

  io.to(userA.userId).emit("matchFound", {
    partnerUserId: userB.userId,
    partner: { name: profileB.name, country: profileB.country, level: userB.level, username: profileB.username },
    roomId,
    isCaller: userACaller,
    topic,
  });

  io.to(userB.userId).emit("matchFound", {
    partnerUserId: userA.userId,
    partner: { name: profileA.name, country: profileA.country, level: userA.level, username: profileA.username },
    roomId,
    isCaller: !userACaller,
    topic,
  });
}

export async function tryMatchOnce(matchedThisTick: Set<string>): Promise<boolean> {
  for (const level of LEVELS) {
    const queue = getQueue(level);
    if (queue.length < 2) continue;

    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const userA = queue[i];
        const userB = queue[j];

        if (matchedThisTick.has(userA.userId) || matchedThisTick.has(userB.userId)) continue;
        if (await areUsersBlocked(userA.userId, userB.userId)) continue;

        const waitTimeA = Date.now() - userA.joinedAt;
        const sharedInterests = getSharedInterests(userA, userB);

        if (sharedInterests.length > 0 || waitTimeA > INTEREST_MATCH_TIMEOUT_MS) {
          await createMatch(userA, userB);
          matchedThisTick.add(userA.userId);
          matchedThisTick.add(userB.userId);
          return true;
        }
      }
    }
  }
  return false;
}

export async function tryAdjacentLevelMatch(matchedThisTick: Set<string>): Promise<boolean> {
  for (const level of LEVELS) {
    const queue = getQueue(level);

    for (const userA of queue) {
      if (matchedThisTick.has(userA.userId)) continue;
      const waitTime = Date.now() - userA.joinedAt;
      if (waitTime < LEVEL_EXPAND_TIMEOUT_MS) continue;

      for (const adjLevel of getAdjacentLevels(level)) {
        const adjQueue = getQueue(adjLevel);
        for (const userB of adjQueue) {
          if (userA.userId === userB.userId) continue;
          if (matchedThisTick.has(userB.userId)) continue;
          if (await areUsersBlocked(userA.userId, userB.userId)) continue;

          await createMatch(userA, userB);
          matchedThisTick.add(userA.userId);
          matchedThisTick.add(userB.userId);
          return true;
        }
      }
    }
  }
  return false;
}

const pendingMatches = new Map<string, { partnerUserId: string; roomId: string; timestamp: number }>();
const PENDING_MATCH_TTL = 60000;

export function getPendingMatch(userId: string): { partnerUserId: string; roomId: string } | null {
  const match = pendingMatches.get(userId);
  if (!match) return null;
  if (Date.now() - match.timestamp > PENDING_MATCH_TTL) {
    pendingMatches.delete(userId);
    return null;
  }
  return { partnerUserId: match.partnerUserId, roomId: match.roomId };
}

export function removePendingMatch(userId: string): void {
  pendingMatches.delete(userId);
}

export function resetQueues(): void {
  for (const level of LEVELS) {
    queues.set(`queue:${level}`, []);
  }
  userMap.clear();
}

export let matchmakingIntervalRef: ReturnType<typeof setInterval>;

export function resetPendingMatches(): void {
  pendingMatches.clear();
}

export function resetUserMap(): void {
  userMap.clear();
}


export function initMatchmaking(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, match] of pendingMatches) {
      if (now - match.timestamp > PENDING_MATCH_TTL) {
        pendingMatches.delete(userId);
        setUserInCall(userId, false);
        for (const [partnerId, partner] of pendingMatches) {
          if (partner.partnerUserId === userId) {
            pendingMatches.delete(partnerId);
            setUserInCall(partnerId, false);
            break;
          }
        }
      }
    }
  }, 30000);

  matchmakingIntervalRef = setInterval(async () => {
    try {
      removeStaleEntries();

      let matched = true;
      let iterations = 0;
      const MAX_ITERATIONS = 50;
      const matchedThisTick = new Set<string>();

      while (matched && iterations < MAX_ITERATIONS) {
        matched = false;
        const found = await tryMatchOnce(matchedThisTick);
        if (found) {
          matched = true;
          iterations++;
        } else {
          const adjFound = await tryAdjacentLevelMatch(matchedThisTick);
          if (adjFound) {
            matched = true;
            iterations++;
          }
        }
      }
    } catch (err) {
      logError("Matchmaking", "Match interval error", { error: String(err) });
    }
  }, MATCH_INTERVAL_MS);
}
