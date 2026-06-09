import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";

function getUTCDate(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

function getYesterdayUTC(): string {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export function calculateStreak(sessionDates: Date[]): number {
  if (sessionDates.length === 0) return 0;

  const uniqueDays = [
    ...new Set(sessionDates.map((d) => getUTCDate(d))),
  ].sort()
    .reverse();

  const today = getUTCDate();

  if (uniqueDays[0] !== today && uniqueDays[0] !== getYesterdayUTC()) {
    return 1;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (Math.round(diffDays) === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function updateStreak(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
  const db = tx || prisma;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const todayUTC = getUTCDate();
  const yesterdayUTC = getYesterdayUTC();

  const lastSessionDate = user.lastSessionDate
    ? getUTCDate(new Date(user.lastSessionDate))
    : null;

  let newStreak = 1;

  if (lastSessionDate) {
    if (lastSessionDate === yesterdayUTC) {
      newStreak = user.currentStreak + 1;
    } else if (lastSessionDate === todayUTC) {
      newStreak = user.currentStreak;
    }
  }

  await db.user.update({
    where: { id: userId },
    data: {
      currentStreak: newStreak,
      lastSessionDate: new Date(),
    },
  });
}
