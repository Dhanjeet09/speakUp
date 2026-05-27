import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../lib/logger", () => ({
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../lib/socket", () => ({
  getIO: () => ({ to: () => ({ emit: vi.fn() }), sockets: { sockets: new Map() } }),
}));

import { addToQueue, removeFromQueue, getQueueSize, resetQueues } from "./matchmaking";

function makeUser(overrides: Partial<{ userId: string; level: string; interests: string[]; blockedUserIds: string[] }> = {}) {
  return {
    userId: "test-user",
    level: "B1",
    interests: [] as string[],
    blockedUserIds: [] as string[],
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe("matchmaking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetQueues();
  });

  it("adds a user to the correct level queue", async () => {
    await addToQueue(makeUser({ userId: "user-1", level: "B1", interests: ["music", "travel"] }));
    expect(await getQueueSize()).toBe(1);
  });

  it("prevents duplicate adds for the same userId", async () => {
    await addToQueue(makeUser({ userId: "user-1" }));
    await addToQueue(makeUser({ userId: "user-1" }));
    expect(await getQueueSize()).toBe(1);
  });

  it("removes a user from the queue", async () => {
    await addToQueue(makeUser({ userId: "user-1" }));
    await removeFromQueue("user-1");
    expect(await getQueueSize()).toBe(0);
  });

  it("tracks users across different levels", async () => {
    await addToQueue(makeUser({ userId: "a", level: "A1" }));
    await addToQueue(makeUser({ userId: "b", level: "B2" }));
    await addToQueue(makeUser({ userId: "c", level: "C1" }));
    expect(await getQueueSize()).toBe(3);
  });

  it("removeFromQueue is a no-op for non-existent userId", async () => {
    await addToQueue(makeUser({ userId: "user-1" }));
    await removeFromQueue("nonexistent");
    expect(await getQueueSize()).toBe(1);
  });

  it("handles multiple add/remove cycles", async () => {
    for (let i = 0; i < 10; i++) {
      await addToQueue(makeUser({ userId: `user-${i}` }));
    }
    expect(await getQueueSize()).toBe(10);
    for (let i = 0; i < 10; i++) {
      await removeFromQueue(`user-${i}`);
    }
    expect(await getQueueSize()).toBe(0);
  });
});
