import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { validateZod } from "../middleware/validateZod";
import { validateParamId } from "../middleware/validateParams";
import { createSessionSchema, rateSessionSchema } from "../schemas";
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
        updateStreak(user1Id, tx),
        updateStreak(user2Id, tx),
      ]);

      return session;
    });

    logInfo("Session", "Session created", { sessionId: result.id });
    res.status(201).json({ success: true, data: { session: result } });
  })
);

router.get(
  "/:userId",
  requireAuth,
  validateParamId("userId"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;

    if (req.userId !== userId) {
      throw new AppError("You can only view your own sessions", 403);
    }

    const where = {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    };

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          user1: { select: { id: true, name: true, country: true } },
          user2: { select: { id: true, name: true, country: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(Number(req.query.limit) || 20, 100),
        skip: Math.max(Number(req.query.offset) || 0, 0),
      }),
      prisma.session.count({ where }),
    ]);

    res.json({ success: true, data: { sessions, total } });
  })
);

router.get(
  "/:userId/ratings",
  requireAuth,
  validateParamId("userId"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;

    const sessions = await prisma.session.findMany({
      where: {
        OR: [
          { user1Id: userId, user1Rating: { not: null } },
          { user2Id: userId, user2Rating: { not: null } },
        ],
      },
      select: {
        id: true,
        user1Id: true,
        user2Id: true,
        user1Rating: true,
        user2Rating: true,
        createdAt: true,
        user1: { select: { id: true, name: true } },
        user2: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(req.query.limit) || 50, 100),
      skip: Math.max(Number(req.query.offset) || 0, 0),
    });

    let positiveCount = 0;
    let totalCount = 0;

    for (const session of sessions) {
      if (session.user1Id === userId && session.user1Rating !== null) {
        totalCount++;
        if (session.user1Rating) positiveCount++;
      } else if (session.user2Id === userId && session.user2Rating !== null) {
        totalCount++;
        if (session.user2Rating) positiveCount++;
      }
    }

    const averageRating = totalCount > 0 ? (positiveCount / totalCount) * 100 : null;

    res.json({
      success: true,
      data: {
        ratings: sessions,
        stats: {
          totalRatings: totalCount,
          positiveRatings: positiveCount,
          averageRating: averageRating !== null ? Math.round(averageRating) : null,
        },
      },
    });
  })
);

router.patch(
  "/:id/rate",
  requireAuth,
  validateParamId("id"),
  validateZod(rateSessionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { positive } = req.body;

    const session = await prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new AppError("Session not found", 404);
    }

    const isUser1 = session.user1Id === req.userId;
    if (!isUser1 && session.user2Id !== req.userId) {
      throw new AppError("You are not a participant in this session", 403);
    }

    const existingRating = isUser1 ? session.user1Rating : session.user2Rating;
    if (existingRating !== null) {
      throw new AppError("You have already rated this session", 409);
    }

    const updateField = isUser1 ? "user1Rating" : "user2Rating";
    await prisma.session.update({
      where: { id },
      data: { [updateField]: positive },
    });

    res.json({ success: true });
  })
);

export default router;
