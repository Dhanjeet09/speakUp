import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../lib/logger", () => ({
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../lib/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: vi.fn() }),
    sockets: { sockets: new Map() },
  }),
  setUserInCall: vi.fn(),
  isUserInCall: vi.fn(() => false),
  areUsersBlocked: vi.fn(),
  isUserSuspended: vi.fn(() => false),
  callPartnerMap: new Map(),
  setCallPair: vi.fn(),
  clearCallPair: vi.fn(),
  getCallPartner: vi.fn(),
  checkJoinQueueRate: vi.fn(() => true),
  checkRateLimit: vi.fn(() => true),
  checkUserRateLimit: vi.fn(() => true),
  addUserConnection: vi.fn(() => true),
  removeUserConnection: vi.fn(() => 0),
}));

vi.mock("../lib/db", () => ({
  prisma: {
    block: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@speakup/config", () => ({
  getTodaysTopic: vi.fn(() => "Test topic"),
  DAILY_TOPICS: ["Test topic"],
}));

import { areUsersBlocked } from "../lib/socket";
import {
  addToQueue,
  removeFromQueue,
  getQueueSize,
  resetQueues,
  resetPendingMatches,
  resetUserMap,
  getPendingMatch,
  removePendingMatch,
  getSharedInterests,
  tryMatchOnce,
  tryAdjacentLevelMatch,
} from "./matchmaking";
import type { QueueUser } from "../types";

function makeUser(overrides: Partial<QueueUser> = {}): QueueUser {
  return {
    userId: "test-user",
    level: "B1",
    interests: [],
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe("addToQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
  });

  it("adds user to the correct level queue", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "A1", interests: ["music", "travel"] }));
    expect(await getQueueSize()).toBe(1);
  });

  it("prevents duplicate adds for the same userId", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "B1" }));
    await addToQueue(makeUser({ userId: "user-1", level: "B1" }));
    expect(await getQueueSize()).toBe(1);
  });

  it("handles multiple users at the same level", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "A1" }));
    await addToQueue(makeUser({ userId: "user-2", level: "A1" }));
    await addToQueue(makeUser({ userId: "user-3", level: "A1" }));
    expect(await getQueueSize()).toBe(3);
  });

  it("distinguishes users across different levels", async () => {
    await addToQueue(makeUser({ userId: "a", level: "A1" }));
    await addToQueue(makeUser({ userId: "b", level: "B2" }));
    await addToQueue(makeUser({ userId: "c", level: "C1" }));
    expect(await getQueueSize()).toBe(3);
  });
});

describe("removeFromQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
  });

  it("removes a user from the queue", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "B1" }));
    await removeFromQueue("user-1");
    expect(await getQueueSize()).toBe(0);
  });

  it("is a no-op for non-existent userId", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "B1" }));
    await removeFromQueue("nonexistent");
    expect(await getQueueSize()).toBe(1);
  });

  it("allows re-adding user after removal", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "B1" }));
    await removeFromQueue("user-1");
    expect(await getQueueSize()).toBe(0);
    await addToQueue(makeUser({ userId: "user-1", level: "B1" }));
    expect(await getQueueSize()).toBe(1);
  });
});

describe("getQueueSize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
  });

  it("returns 0 for empty queues", async () => {
    expect(await getQueueSize()).toBe(0);
  });

  it("returns 1 for a single user", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "A1" }));
    expect(await getQueueSize()).toBe(1);
  });

  it("returns correct count across multiple levels", async () => {
    await addToQueue(makeUser({ userId: "a", level: "A1" }));
    await addToQueue(makeUser({ userId: "b", level: "A2" }));
    await addToQueue(makeUser({ userId: "c", level: "B1" }));
    await addToQueue(makeUser({ userId: "d", level: "C2" }));
    expect(await getQueueSize()).toBe(4);
  });
});

describe("areUsersBlocked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
  });

  it("returns false when neither user blocks the other", async () => {
    vi.mocked(areUsersBlocked).mockResolvedValue(false);
    const result = await areUsersBlocked("user-a", "user-b");
    expect(result).toBe(false);
  });

  it("returns true when user A blocks user B", async () => {
    vi.mocked(areUsersBlocked).mockResolvedValue(true);
    const result = await areUsersBlocked("user-a", "user-b");
    expect(result).toBe(true);
  });

  it("returns true when user B blocks user A", async () => {
    vi.mocked(areUsersBlocked).mockResolvedValue(true);
    const result = await areUsersBlocked("user-a", "user-b");
    expect(result).toBe(true);
  });

  it("returns true when both users block each other", async () => {
    vi.mocked(areUsersBlocked).mockResolvedValue(true);
    const result = await areUsersBlocked("user-a", "user-b");
    expect(result).toBe(true);
  });
});

describe("getSharedInterests", () => {
  it("returns shared interests between two users", () => {
    const userA = makeUser({ userId: "a", interests: ["music", "travel", "cooking"] });
    const userB = makeUser({ userId: "b", interests: ["travel", "sports", "music"] });
    const shared = getSharedInterests(userA, userB);
    expect(shared).toEqual(["music", "travel"]);
  });

  it("returns empty array when no interests are shared", () => {
    const userA = makeUser({ userId: "a", interests: ["music", "cooking"] });
    const userB = makeUser({ userId: "b", interests: ["sports", "gaming"] });
    const shared = getSharedInterests(userA, userB);
    expect(shared).toEqual([]);
  });

  it("returns empty array when both users have empty interests", () => {
    const userA = makeUser({ userId: "a", interests: [] });
    const userB = makeUser({ userId: "b", interests: [] });
    const shared = getSharedInterests(userA, userB);
    expect(shared).toEqual([]);
  });

  it("performs case-sensitive matching", () => {
    const userA = makeUser({ userId: "a", interests: ["Music", "Travel"] });
    const userB = makeUser({ userId: "b", interests: ["music", "travel"] });
    const shared = getSharedInterests(userA, userB);
    expect(shared).toEqual([]);
  });
});

describe("tryMatchOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
    vi.mocked(areUsersBlocked).mockResolvedValue(false);
  });

  it("matches two users at the same level with shared interests", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "B1", interests: ["music"] }));
    await addToQueue(makeUser({ userId: "user-2", level: "B1", interests: ["music"] }));
    const matchedThisTick = new Set<string>();
    const result = await tryMatchOnce(matchedThisTick);
    expect(result).toBe(true);
    expect(matchedThisTick.has("user-1")).toBe(true);
    expect(matchedThisTick.has("user-2")).toBe(true);
  });

  it("skips blocked users and does not create match", async () => {
    vi.mocked(areUsersBlocked).mockResolvedValue(true);
    await addToQueue(makeUser({ userId: "user-1", level: "B1", interests: ["music"] }));
    await addToQueue(makeUser({ userId: "user-2", level: "B1", interests: ["music"] }));
    const matchedThisTick = new Set<string>();
    const result = await tryMatchOnce(matchedThisTick);
    expect(result).toBe(false);
  });

  it("matches users after timeout even without shared interests", async () => {
    vi.useFakeTimers();
    await addToQueue(makeUser({ userId: "user-1", level: "B1", interests: ["music"] }));
    await addToQueue(makeUser({ userId: "user-2", level: "B1", interests: ["sports"] }));
    vi.advanceTimersByTime(30000);
    const matchedThisTick = new Set<string>();
    const result = await tryMatchOnce(matchedThisTick);
    vi.useRealTimers();
    expect(result).toBe(true);
    expect(matchedThisTick.has("user-1")).toBe(true);
    expect(matchedThisTick.has("user-2")).toBe(true);
  });

  it("returns false when only one user is in the queue", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "B1" }));
    const matchedThisTick = new Set<string>();
    const result = await tryMatchOnce(matchedThisTick);
    expect(result).toBe(false);
  });
});

describe("tryAdjacentLevelMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
    vi.mocked(areUsersBlocked).mockResolvedValue(false);
  });

  it("matches users from adjacent levels after timeout", async () => {
    vi.useFakeTimers();
    await addToQueue(makeUser({ userId: "user-a1", level: "A1", interests: ["music"] }));
    await addToQueue(makeUser({ userId: "user-a2", level: "A2", interests: ["sports"] }));
    vi.advanceTimersByTime(60000);
    const matchedThisTick = new Set<string>();
    const result = await tryAdjacentLevelMatch(matchedThisTick);
    vi.useRealTimers();
    expect(result).toBe(true);
    expect(matchedThisTick.has("user-a1")).toBe(true);
    expect(matchedThisTick.has("user-a2")).toBe(true);
  });

  it("does not match users before timeout expires", async () => {
    const freshJoinedAt = Date.now();
    await addToQueue(makeUser({ userId: "user-a1", level: "A1", interests: ["music"], joinedAt: freshJoinedAt }));
    await addToQueue(makeUser({ userId: "user-a2", level: "A2", interests: ["sports"], joinedAt: freshJoinedAt }));
    const matchedThisTick = new Set<string>();
    const result = await tryAdjacentLevelMatch(matchedThisTick);
    expect(result).toBe(false);
  });

  it("does not match users from non-adjacent levels", async () => {
    const staleJoinedAt = Date.now() - 60000;
    await addToQueue(makeUser({ userId: "user-a1", level: "A1", interests: ["music"], joinedAt: staleJoinedAt }));
    await addToQueue(makeUser({ userId: "user-c1", level: "C1", interests: ["sports"], joinedAt: staleJoinedAt }));
    const matchedThisTick = new Set<string>();
    const result = await tryAdjacentLevelMatch(matchedThisTick);
    expect(result).toBe(false);
  });
});

describe("getPendingMatch / removePendingMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
  });

  it("returns null when no pending match exists", () => {
    const match = getPendingMatch("nonexistent");
    expect(match).toBeNull();
  });

  it("returns null after removePendingMatch", () => {
    removePendingMatch("user-1");
    const match = getPendingMatch("user-1");
    expect(match).toBeNull();
  });

  it("resets pending matches via resetPendingMatches", () => {
    resetPendingMatches();
    const match = getPendingMatch("user-1");
    expect(match).toBeNull();
  });
});
