import { PrismaClient } from "@prisma/client";
import { logInfo, logError } from "./logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrisma();

export async function initDb(): Promise<void> {
  try {
    await getPrisma().$connect();
    logInfo("DB", "Prisma connected to database");
  } catch (err) {
    logError("DB", "Prisma connection failed", { error: String(err) });
    throw err;
  }
}

export async function disconnectPrisma() {
  logInfo("DB", "Disconnecting Prisma");
  await getPrisma().$disconnect();
}
