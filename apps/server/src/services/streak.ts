import { prisma } from "../lib/db";

function getUTCDate(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

function getYesterdayUTC(): string {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export async function updateStreak(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: newStreak,
      lastSessionDate: new Date(),
    },
  });
}
