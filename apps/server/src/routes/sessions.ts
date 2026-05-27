import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { validateZod } from "../middleware/validateZod";
import { createSessionSchema } from "../schemas";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import { updateStreak } from "../services/streak";
import { logInfo, logError as logErr } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

const router = Router();

router.post(
  "/",
  requireAuth,
  validateZod(createSessionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { user1Id, user2Id, durationSeconds, topicUsed, roomUrl } = req.body;

    logInfo("Session", "Creating session", { user1Id, user2Id, durationSeconds, topicUsed, userId: req.userId });

    if (req.userId !== user1Id && req.userId !== user2Id) {
      logErr("Session", "User not participant", { userId: req.userId, user1Id, user2Id });
      throw new AppError("You can only create sessions you participate in", 403);
    }

    const minutes = Math.floor(durationSeconds / 60);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const session = await tx.session.create({
        data: {
          user1Id,
          user2Id,
          durationSeconds: Math.floor(durationSeconds),
          topicUsed: topicUsed || null,
          roomUrl: roomUrl || null,
        },
      });

      await Promise.all([
        tx.user.update({
          where: { id: user1Id },
          data: {
            totalMinutes: { increment: minutes },
            totalSessions: { increment: 1 },
          },
        }),
        tx.user.update({
          where: { id: user2Id },
          data: {
            totalMinutes: { increment: minutes },
            totalSessions: { increment: 1 },
          },
        }),
      ]);

      return session;
    });

    await Promise.all([
      updateStreak(user1Id),
      updateStreak(user2Id),
    ]);

    logInfo("Session", "Session created", { sessionId: result.id });
    res.status(201).json({ success: true, data: { session: result } });
  })
);

router.get(
  "/:userId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;

    const sessions = await prisma.session.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(req.query.limit) || 20, 100),
      skip: Math.max(Number(req.query.offset) || 0, 0),
    });

    res.json({ success: true, data: { sessions } });
  })
);

router.put(
  "/:roomId/rating",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { roomId } = req.params;
    const { positive } = req.body;

    if (typeof positive !== "boolean") {
      throw new AppError("positive must be a boolean", 400);
    }

    const session = await prisma.session.findFirst({
      where: { roomUrl: roomId },
    });

    if (!session) {
      res.json({ success: false, error: "Session not found" });
      return;
    }

    const isUser1 = session.user1Id === req.userId;
    if (!isUser1 && session.user2Id !== req.userId) {
      throw new AppError("You are not a participant in this session", 403);
    }

    const updateField = isUser1 ? "user1Rating" : "user2Rating";
    await prisma.session.update({
      where: { id: session.id },
      data: { [updateField]: positive },
    });

    res.json({ success: true });
  })
);

export default router;
