import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth, requireModerator } from "../middleware/auth";
import { validateZod } from "../middleware/validateZod";
import { validateParamId } from "../middleware/validateParams";
import { createReportSchema } from "../schemas";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import { logInfo, logWarn } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

const router = Router();

router.post(
  "/",
  requireAuth,
  validateZod(createReportSchema, ["note"]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { reportedId, reason, note } = req.body;

    if (req.userId === reportedId) {
      logWarn("Report", "Self-report attempt", { userId: req.userId });
      throw new AppError("You cannot report yourself", 400);
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.userId!,
        reportedId,
        reason,
        note: note || null,
      },
    });

    logInfo("Report", "Report created", { reportId: report.id, reportedId, reason });

    res.status(201).json({ success: true, data: { report } });
  })
);

router.post(
  "/:userId/block",
  requireAuth,
  validateParamId("userId"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const blockedId = req.params.userId;

    if (req.userId === blockedId) {
      throw new AppError("You cannot block yourself", 400);
    }

    const existing = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: req.userId!,
          blockedId,
        },
      },
    });

    if (existing) {
      res.json({ success: true, data: { block: existing } });
      return;
    }

    const block = await prisma.block.create({
      data: {
        blockerId: req.userId!,
        blockedId,
      },
    });

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: req.userId!, addresseeId: blockedId },
          { requesterId: blockedId, addresseeId: req.userId! },
        ],
      },
    });

    res.status(201).json({ success: true, data: { block } });
  })
);

router.get(
  "/",
  requireAuth,
  requireModerator,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        select: {
          id: true,
          reporterId: true,
          reportedId: true,
          reason: true,
          note: true,
          createdAt: true,
          resolved: true,
          reporter: { select: { id: true, name: true } },
          reported: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.report.count(),
    ]);

    res.json({
      success: true,
      data: {
        reports,
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
  "/open",
  requireAuth,
  requireModerator,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const reports = await prisma.report.findMany({
      where: { resolved: false },
      select: {
        id: true,
        reporterId: true,
        reportedId: true,
        reason: true,
        note: true,
        createdAt: true,
        resolved: true,
        reporter: { select: { id: true, name: true } },
        reported: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ success: true, data: { reports } });
  })
);

router.put(
  "/:id/resolve",
  requireAuth,
  requireModerator,
  validateParamId("id"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const existing = await prisma.report.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError("Report not found", 404);
    }

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { resolved: true },
    });

    res.json({ success: true, data: { report } });
  })
);

export default router;
