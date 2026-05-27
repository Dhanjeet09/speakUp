import { describe, it, expect } from "vitest";
import { calculateStreak } from "./streak";

describe("calculateStreak", () => {
  it("returns 1 for a single session today", () => {
    const sessions = [new Date()];
    expect(calculateStreak(sessions)).toBe(1);
  });

  it("returns 2 for sessions today and yesterday", () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(calculateStreak([yesterday, now])).toBe(2);
  });

  it("returns 5 for five consecutive days", () => {
    const now = new Date();
    const days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      return d;
    });
    expect(calculateStreak(days)).toBe(5);
  });

  it("resets to 1 when there is a gap", () => {
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    // gap: yesterday missing
    expect(calculateStreak([twoDaysAgo, now])).toBe(1);
  });

  it("returns 0 for empty sessions", () => {
    expect(calculateStreak([])).toBe(0);
  });

  it("ignores future dates", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(calculateStreak([tomorrow])).toBe(1);
  });

  it("handles out-of-order session dates", () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(now);
    dayBefore.setDate(dayBefore.getDate() - 2);
    expect(calculateStreak([dayBefore, now, yesterday])).toBe(3);
  });
});
