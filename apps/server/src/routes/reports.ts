import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { validateZod } from "../middleware/validateZod";
import { createReportSchema, blockUserSchema } from "../schemas";
import { AppError } from "../middleware/errorHandler";
import { logInfo, logWarn } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

const router = Router();

router.post(
  "/",
  requireAuth,
  validateZod(createReportSchema, ["note"]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  }
);

router.post(
  "/block",
  requireAuth,
  validateZod(blockUserSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { blockedId } = req.body;

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

    res.status(201).json({ success: true, data: { block } });
  }
);

router.get(
  "/open",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const isAdmin =
      process.env.ADMIN_USER_IDS?.split(",").includes(req.userId || "");

    if (!isAdmin) {
      throw new AppError("Admin access required", 403);
    }

    const reports = await prisma.report.findMany({
      where: { resolved: false },
      include: {
        reporter: { select: { id: true, name: true } },
        reported: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ success: true, data: { reports } });
  }
);

router.put(
  "/:id/resolve",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const isAdmin =
      process.env.ADMIN_USER_IDS?.split(",").includes(req.userId || "");

    if (!isAdmin) {
      throw new AppError("Admin access required", 403);
    }

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { resolved: true },
    });

    res.json({ success: true, data: { report } });
  }
);

export default router;
