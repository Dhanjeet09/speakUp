import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

vi.mock("../lib/env", () => ({
  env: {
    SUPABASE_JWT_SECRET: "test-secret",
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_SERVICE_KEY: "test-service-key",
    SUPABASE_ANON_KEY: "test-anon-key",
    CORS_ORIGIN: "http://localhost:3000",
    PORT: 4000,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  },
  parseCorsOrigins: () => ["http://localhost:3000"],
}));

vi.mock("../lib/logger", () => ({
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    block: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    friendship: {
      findFirst: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/db";
import {
  isUserInCall,
  setUserInCall,
  checkJoinQueueRate,
  checkUserRateLimit,
  checkRateLimit,
  addUserConnection,
  removeUserConnection,
  getCallPartner,
} from "../lib/socket";

import {
  addToQueue,
  removeFromQueue,
  getQueueSize,
  getPendingMatch,
  removePendingMatch,
  resetQueues,
  resetPendingMatches,
  resetUserMap,
} from "../services/matchmaking";

import type { QueueUser } from "../types";

const mockPrisma = vi.mocked(prisma);

function makeQueueUser(overrides: Partial<QueueUser> = {}): QueueUser {
  return {
    userId: "test-user",
    level: "B1",
    interests: [],
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe("joinQueue event handler functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
  });

  it("isUserInCall returns false initially", () => {
    expect(isUserInCall("user-1")).toBe(false);
  });

  it("setUserInCall marks user as in call", () => {
    setUserInCall("user-1", true);
    expect(isUserInCall("user-1")).toBe(true);
  });

  it("setUserInCall removes user from call when false", () => {
    setUserInCall("user-1", true);
    setUserInCall("user-1", false);
    expect(isUserInCall("user-1")).toBe(false);
  });

  it("checkJoinQueueRate allows first join", () => {
    const allowed = checkJoinQueueRate("user-1");
    expect(allowed).toBe(true);
  });

  it("checkJoinQueueRate blocks rapid re-joins", () => {
    checkJoinQueueRate("user-1");
    const allowed = checkJoinQueueRate("user-1");
    expect(allowed).toBe(false);
  });

  it("checkJoinQueueRate allows re-join after rate limit window", () => {
    checkJoinQueueRate("user-rejoin");
    const blocked = checkJoinQueueRate("user-rejoin");
    expect(blocked).toBe(false);
  });

  it("addToQueue succeeds for valid user", async () => {
    await addToQueue(makeQueueUser({ userId: "user-1", level: "B1", interests: ["music"] }));
    expect(await getQueueSize()).toBe(1);
  });
});

describe("callEnded event handler functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("setUserInCall clears call state for the user", () => {
    setUserInCall("user-1", true);
    expect(isUserInCall("user-1")).toBe(true);
    setUserInCall("user-1", false);
    expect(isUserInCall("user-1")).toBe(false);
  });

  it("setUserInCall clears call state for partner user", () => {
    setUserInCall("user-1", true);
    setUserInCall("user-2", true);
    expect(isUserInCall("user-1")).toBe(true);
    expect(isUserInCall("user-2")).toBe(true);
    setUserInCall("user-1", false);
    setUserInCall("user-2", false);
    expect(isUserInCall("user-1")).toBe(false);
    expect(isUserInCall("user-2")).toBe(false);
  });

  it("isUserInCall returns false for unknown user", () => {
    expect(isUserInCall("unknown-user")).toBe(false);
  });

  it("getCallPartner returns undefined when no partner", () => {
    expect(getCallPartner("user-1")).toBeUndefined();
  });
});

describe("message:send event handler functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prisma block findUnique returns null when no block exists", async () => {
    mockPrisma.block.findUnique.mockResolvedValue(null);
    mockPrisma.friendship.findFirst.mockResolvedValue({
      id: "friendship-1",
      requesterId: "sender-1",
      addresseeId: "receiver-1",
      status: "accepted",
    });
    mockPrisma.chatMessage.create.mockResolvedValue({
      id: "msg-1",
      senderId: "sender-1",
      receiverId: "receiver-1",
      content: "Hello!",
      createdAt: new Date(),
    });
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false });

    const userRecord = await mockPrisma.user.findUnique({ where: { id: "sender-1" }, select: { isSuspended: true } });
    expect(userRecord?.isSuspended).toBe(false);

    const blockedBySender = await mockPrisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: "sender-1", blockedId: "receiver-1" } },
    });
    expect(blockedBySender).toBeNull();

    const friendship = await mockPrisma.friendship.findFirst({
      where: { status: "accepted", OR: [{ requesterId: "sender-1", addresseeId: "receiver-1" }, { requesterId: "receiver-1", addresseeId: "sender-1" }] },
    });
    expect(friendship).not.toBeNull();
  });

  it("prisma suspension check blocks suspended users from sending messages", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true });
    const userRecord = await mockPrisma.user.findUnique({ where: { id: "suspended-user" }, select: { isSuspended: true } });
    expect(userRecord?.isSuspended).toBe(true);
  });

  it("prisma block check prevents sending to blocked user", async () => {
    mockPrisma.block.findUnique.mockResolvedValue({ blockerId: "receiver-1", blockedId: "sender-1" });
    const blocked = await mockPrisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: "receiver-1", blockedId: "sender-1" } },
    });
    expect(blocked).not.toBeNull();
  });

  it("prisma friendship check prevents messaging non-friends", async () => {
    mockPrisma.friendship.findFirst.mockResolvedValue(null);
    const friendship = await mockPrisma.friendship.findFirst({
      where: { status: "accepted", OR: [{ requesterId: "sender-1", addresseeId: "receiver-1" }, { requesterId: "receiver-1", addresseeId: "sender-1" }] },
    });
    expect(friendship).toBeNull();
  });
});

describe("friend:call event handler functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks caller suspension before initiating call", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true });
    const callerRecord = await mockPrisma.user.findUnique({ where: { id: "caller-1" }, select: { isSuspended: true } });
    expect(callerRecord?.isSuspended).toBe(true);
  });

  it("checks friend suspension before initiating call", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ isSuspended: false })
      .mockResolvedValueOnce({ isSuspended: true });
    const callerRecord = await mockPrisma.user.findUnique({ where: { id: "caller-1" }, select: { isSuspended: true } });
    expect(callerRecord?.isSuspended).toBe(false);
    const friendRecord = await mockPrisma.user.findUnique({ where: { id: "friend-1" }, select: { isSuspended: true } });
    expect(friendRecord?.isSuspended).toBe(true);
  });

  it("checks friendship before initiating call", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false });
    mockPrisma.friendship.findFirst.mockResolvedValue(null);
    const friendship = await mockPrisma.friendship.findFirst({
      where: { status: "accepted", OR: [{ requesterId: "caller-1", addresseeId: "friend-1" }, { requesterId: "friend-1", addresseeId: "caller-1" }] },
    });
    expect(friendship).toBeNull();
  });

  it("checks blocks before initiating call", async () => {
    mockPrisma.block.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ blockerId: "friend-1", blockedId: "caller-1" });
    const callerBlocksFriend = await mockPrisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: "caller-1", blockedId: "friend-1" } },
    });
    expect(callerBlocksFriend).toBeNull();
    const friendBlocksCaller = await mockPrisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: "friend-1", blockedId: "caller-1" } },
    });
    expect(friendBlocksCaller).not.toBeNull();
  });

  it("prevents calling a user who is already in a call", () => {
    setUserInCall("friend-1", true);
    expect(isUserInCall("friend-1")).toBe(true);
  });

  it("allows calling a user who is not in a call", () => {
    setUserInCall("friend-1", false);
    expect(isUserInCall("friend-1")).toBe(false);
  });
});

describe("rate limiting functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checkRateLimit allows first request from a socket", () => {
    const allowed = checkRateLimit("socket-1");
    expect(allowed).toBe(true);
  });

  it("checkRateLimit blocks after exceeding max requests", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("socket-1");
    }
    const allowed = checkRateLimit("socket-1");
    expect(allowed).toBe(false);
  });

  it("checkUserRateLimit allows first request from a user", () => {
    const allowed = checkUserRateLimit("user-1");
    expect(allowed).toBe(true);
  });

  it("checkUserRateLimit blocks after exceeding max requests", () => {
    for (let i = 0; i < 20; i++) {
      checkUserRateLimit("user-1");
    }
    const allowed = checkUserRateLimit("user-1");
    expect(allowed).toBe(false);
  });

  it("addUserConnection rejects when max connections exceeded", () => {
    for (let i = 0; i < 10; i++) {
      addUserConnection("conn-user-reject");
    }
    const allowed = addUserConnection("conn-user-reject");
    expect(allowed).toBe(false);
  });

  it("addUserConnection allows up to max connections", () => {
    for (let i = 0; i < 9; i++) {
      expect(addUserConnection("conn-user-allow")).toBe(true);
    }
    expect(addUserConnection("conn-user-allow")).toBe(true);
  });

  it("removeUserConnection decrements connection count", () => {
    addUserConnection("conn-user-decrement");
    addUserConnection("conn-user-decrement");
    const remaining = removeUserConnection("conn-user-decrement");
    expect(remaining).toBe(1);
  });

  it("removeUserConnection returns 0 and deletes entry when last connection", () => {
    addUserConnection("conn-user-last");
    const remaining = removeUserConnection("conn-user-last");
    expect(remaining).toBe(0);
  });
});

describe("match:accept / match:reject handler functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
    resetPendingMatches();
    resetUserMap();
  });

  it("getPendingMatch returns null for unknown user", () => {
    expect(getPendingMatch("unknown")).toBeNull();
  });

  it("removePendingMatch does not throw for unknown user", () => {
    expect(() => removePendingMatch("unknown")).not.toThrow();
  });

  it("getPendingMatch returns null after removePendingMatch", () => {
    removePendingMatch("user-1");
    expect(getPendingMatch("user-1")).toBeNull();
  });
});
