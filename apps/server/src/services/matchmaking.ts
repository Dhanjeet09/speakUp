import { getIO } from "../lib/socket";
import { logDebug, logInfo, logWarn } from "../lib/logger";
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
  const queue = getQueue(user.level);
  queue.push({ ...user, joinedAt: Date.now() });
  setQueue(user.level, queue);
  userMap.set(user.userId, user);
  logDebug("Matchmaking", "User added to queue", { userId: user.userId, level: user.level, queueSize: queue.length });
}

export async function removeFromQueue(userId: string): Promise<void> {
  const user = userMap.get(userId);
  if (!user) return;

  const queue = getQueue(user.level);
  setQueue(
    user.level,
    queue.filter((u) => u.userId !== userId)
  );
  userMap.delete(userId);
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

async function tryMatchOnce(): Promise<boolean> {
  for (const level of LEVELS) {
    const queue = getQueue(level);
    if (queue.length < 2) continue;

    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const userA = queue[i];
        const userB = queue[j];

        if (areUsersBlocked(userA, userB)) continue;

        const waitTimeA = Date.now() - userA.joinedAt;
        const waitTimeB = Date.now() - userB.joinedAt;
        const sharedInterests = getSharedInterests(userA, userB);

        if (sharedInterests.length > 0 || waitTimeA > INTEREST_MATCH_TIMEOUT_MS) {
          await createMatch(userA, userB);
          return true;
        }
      }
    }
  }
  return false;
}

async function tryAdjacentLevelMatch(): Promise<boolean> {
  for (const level of LEVELS) {
    const queue = getQueue(level);

    for (const userA of queue) {
      const waitTime = Date.now() - userA.joinedAt;
      if (waitTime < LEVEL_EXPAND_TIMEOUT_MS) continue;

      const blockedSet = new Set(userA.blockedUserIds);

      for (const adjLevel of getAdjacentLevels(level)) {
        const adjQueue = getQueue(adjLevel);
        for (const userB of adjQueue) {
          if (userA.userId === userB.userId) continue;
          if (blockedSet.has(userB.userId)) continue;

          await createMatch(userA, userB);
          return true;
        }
      }
    }
  }
  return false;
}

function areUsersBlocked(userA: QueueUser, userB: QueueUser): boolean {
  const blockedA = new Set(userA.blockedUserIds);
  const blockedB = new Set(userB.blockedUserIds);
  return blockedA.has(userB.userId) || blockedB.has(userA.userId);
}

function getSharedInterests(userA: QueueUser, userB: QueueUser): string[] {
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

let matchCounter = 0;

async function createMatch(userA: QueueUser, userB: QueueUser): Promise<void> {
  const roomId = `room_${++matchCounter}_${Date.now()}`;
  const topic = getTodaysTopic();

  await removeFromQueue(userA.userId);
  await removeFromQueue(userB.userId);

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

  io.to(userA.userId).emit("matchFound", {
    partnerUserId: userB.userId,
    partner: { name: userB.userId, country: "", level: userB.level },
    roomId,
    isCaller: userACaller,
    topic,
  });

  io.to(userB.userId).emit("matchFound", {
    partnerUserId: userA.userId,
    partner: { name: userA.userId, country: "", level: userA.level },
    roomId,
    isCaller: !userACaller,
    topic,
  });
}

function getTodaysTopic(): string {
  const topics = [
    "Describe your hometown and what you love about it.",
    "What superpower would you choose and why?",
    "Talk about a meal you will never forget.",
    "Describe your favorite movie and why it resonates with you.",
    "If you could visit any country, where would you go?",
  ];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      86400000
  );
  return topics[dayOfYear % topics.length];
}

export function initMatchmaking(): void {
  setInterval(async () => {
    removeStaleEntries();

    let matched = true;
    let iterations = 0;
    const MAX_ITERATIONS = 50;

    while (matched && iterations < MAX_ITERATIONS) {
      matched = false;
      const found = await tryMatchOnce();
      if (found) {
        matched = true;
        iterations++;
      } else {
        const adjFound = await tryAdjacentLevelMatch();
        if (adjFound) {
          matched = true;
          iterations++;
        }
      }
    }
  }, MATCH_INTERVAL_MS);
}
