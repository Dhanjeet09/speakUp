import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth, requireSameUser, requireAdmin } from "../middleware/auth";
import { validateZod } from "../middleware/validateZod";
import { validateParamId } from "../middleware/validateParams";
import { updateUserSchema, suspendUserSchema } from "../schemas";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import { logInfo } from "../lib/logger";
import sanitizeHtml from "sanitize-html";
import type { AuthenticatedRequest } from "../types";

const router = Router();

const userSelect = {
  id: true,
  name: true,
  username: true,
  country: true,
  timezone: true,
  nativeLanguage: true,
  bio: true,
  avatarUrl: true,
  englishLevel: true,
  interests: true,
  totalMinutes: true,
  totalSessions: true,
  currentStreak: true,
  role: true,
  createdAt: true,
  isSuspended: true,
} as const;

router.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: userSelect,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  })
);

router.get(
  "/search",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const q = (req.query.q as string || "").trim();
    if (!q) {
      res.json({ success: true, data: { users: [] } });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        englishLevel: true,
        country: true,
      },
      take: 10,
    });

    res.json({ success: true, data: { users } });
  })
);

router.get(
  "/discoverable",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;

    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    });
    const blockedIds = blocks.map((b) => b.blockedId);

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId, notIn: blockedIds },
        isSuspended: false,
      },
      select: {
        id: true,
        name: true,
        username: true,
        country: true,
        avatarUrl: true,
        englishLevel: true,
        interests: true,
        totalSessions: true,
      },
      take: 20,
      orderBy: { totalSessions: "desc" },
    });

    res.json({ success: true, data: { users } });
  })
);

router.get(
  "/:id",
  requireAuth,
  validateParamId("id"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: userSelect,
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json({
      success: true,
      data: { user },
    });
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireSameUser,
  validateParamId("id"),
  validateZod(updateUserSchema, ["name"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, username, country, timezone, nativeLanguage, bio, englishLevel, interests } = req.body;

    if (username !== undefined) {
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUser && existingUser.id !== req.params.id) {
        throw new AppError("Username is already taken", 409);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (username !== undefined) updateData.username = username;
    if (country !== undefined) updateData.country = country.trim();
    if (timezone !== undefined) updateData.timezone = timezone;
    if (nativeLanguage !== undefined) updateData.nativeLanguage = nativeLanguage;
    if (bio !== undefined) updateData.bio = sanitizeHtml(bio, { allowedTags: [], allowedAttributes: {} });
    if (englishLevel !== undefined) updateData.englishLevel = englishLevel;
    if (interests !== undefined) {
      updateData.interests = interests.map((i: string) => i.trim()).filter(Boolean);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: userSelect,
    });

    res.json({ success: true, data: { user } });
  })
);

router.get(
  "/:id/blocks",
  requireAuth,
  requireSameUser,
  validateParamId("id"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.params.id },
      select: { blockedId: true },
    });
    res.json({
      success: true,
      data: { blockedIds: blocks.map((b) => b.blockedId) },
    });
  })
);

router.patch(
  "/:id/suspend",
  requireAuth,
  requireAdmin,
  validateParamId("id"),
  validateZod(suspendUserSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { reason } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isSuspended: true, suspendedAt: new Date(), suspensionReason: reason || null },
      select: { id: true, isSuspended: true, suspensionReason: true },
    });
    logInfo("Admin", "User suspended", { suspendedBy: req.userId, targetId: req.params.id, reason });
    res.json({ success: true, data: { user } });
  })
);

router.patch(
  "/:id/unsuspend",
  requireAuth,
  requireAdmin,
  validateParamId("id"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isSuspended: false, suspendedAt: null, suspensionReason: null },
      select: { id: true, isSuspended: true },
    });
    logInfo("Admin", "User unsuspended", { unsuspendedBy: req.userId, targetId: req.params.id });
    res.json({ success: true, data: { user } });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireSameUser,
  validateParamId("id"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    await prisma.user.delete({ where: { id: req.params.id } });
    logInfo("User", "Account deleted", { userId: req.params.id });
    res.json({ success: true });
  })
);

export default router;
