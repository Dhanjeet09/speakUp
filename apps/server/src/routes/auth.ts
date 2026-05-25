import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedRequest } from "../types";

const router = Router();

router.get(
  "/me",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const profile = await prisma.user.findUnique({
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

      res.json({
        success: true,
        data: {
          user: { id: req.userId, email: req.userEmail },
          profile,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to fetch profile", 500);
    }
  }
);

export default router;
