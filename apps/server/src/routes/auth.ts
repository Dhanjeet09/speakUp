import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../types";

const router = Router();

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let profile = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        name: true,
        email: true,
        country: true,
        avatarUrl: true,
        englishLevel: true,
        interests: true,
        totalMinutes: true,
        totalSessions: true,
        currentStreak: true,
        createdAt: true,
      },
    });

    if (!profile) {
      profile = await prisma.user.create({
        data: {
          id: req.userId!,
          email: req.userEmail || "",
          name: req.userEmail?.split("@")[0] || "User",
        },
        select: {
          id: true,
          name: true,
          email: true,
          country: true,
          avatarUrl: true,
          englishLevel: true,
          interests: true,
          totalMinutes: true,
          totalSessions: true,
          currentStreak: true,
          createdAt: true,
        },
      });
    }

    res.json({
      success: true,
      data: {
        user: { id: req.userId, email: req.userEmail },
        profile,
      },
    });
  })
);

export default router;
