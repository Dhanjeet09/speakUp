import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth, requireSameUser } from "../middleware/auth";
import { validateZod } from "../middleware/validateZod";
import { updateUserSchema } from "../schemas";
import { AppError } from "../middleware/errorHandler";
import { logInfo, logWarn } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

const router = Router();

router.get(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
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

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const isOwnProfile = req.userId === req.params.id;

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          email: isOwnProfile ? undefined : undefined,
        },
      },
    });
  }
);

router.put(
  "/:id",
  requireAuth,
  requireSameUser,
  validateZod(updateUserSchema, ["name"]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, country, englishLevel, interests } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (country !== undefined) updateData.country = country.trim();
    if (englishLevel !== undefined) updateData.englishLevel = englishLevel;
    if (interests !== undefined) {
      updateData.interests = interests.map((i: string) => i.trim()).filter(Boolean);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ success: true, data: { user } });
  }
);

export default router;
