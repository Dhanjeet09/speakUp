import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import { validateZod } from "../middleware/validateZod";
import { sendFriendRequestSchema } from "../schemas";
import { getIO } from "../lib/socket";
import { logInfo } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

const router = Router();

const friendProfileSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  englishLevel: true,
  country: true,
} as const;

// GET / - list accepted friends
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: "accepted",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: friendProfileSelect },
        addressee: { select: friendProfileSelect },
      },
      orderBy: { createdAt: "desc" },
    });

    const friends = friendships.map((f) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      return {
        id: f.id,
        friendId: friend.id,
        name: friend.name,
        username: friend.username,
        avatarUrl: friend.avatarUrl,
        englishLevel: friend.englishLevel,
        country: friend.country,
        status: f.status,
        createdAt: f.createdAt.toISOString(),
      };
    });

    res.json({ success: true, data: { friends } });
  })
);

// GET /requests - list pending received requests
router.get(
  "/requests",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;

    const requests = await prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: "pending",
      },
      include: {
        requester: { select: friendProfileSelect },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = requests.map((r) => ({
      id: r.id,
      requesterId: r.requesterId,
      addresseeId: r.addresseeId,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      requester: r.requester,
    }));

    res.json({ success: true, data: { requests: data } });
  })
);

// GET /requests/sent - list sent requests
router.get(
  "/requests/sent",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;

    const requests = await prisma.friendship.findMany({
      where: {
        requesterId: userId,
        status: "pending",
      },
      include: {
        addressee: { select: friendProfileSelect },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = requests.map((r) => ({
      id: r.id,
      requesterId: r.requesterId,
      addresseeId: r.addresseeId,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      addressee: r.addressee,
    }));

    res.json({ success: true, data: { requests: data } });
  })
);

// POST /requests - send friend request
router.post(
  "/requests",
  requireAuth,
  validateZod(sendFriendRequestSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { addresseeId } = req.body;

    if (userId === addresseeId) {
      throw new AppError("Cannot send friend request to yourself", 400);
    }

    const addressee = await prisma.user.findUnique({ where: { id: addresseeId } });
    if (!addressee) {
      throw new AppError("User not found", 404);
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId },
          { requesterId: addresseeId, addresseeId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === "accepted") {
        throw new AppError("Already friends", 409);
      }
      if (existing.status === "blocked") {
        throw new AppError("Cannot send friend request", 400);
      }
      if (existing.status === "pending") {
        throw new AppError("Friend request already sent", 409);
      }
    }

    const friendship = await prisma.friendship.create({
      data: {
        requesterId: userId,
        addresseeId,
        status: "pending",
      },
      include: {
        requester: { select: friendProfileSelect },
      },
    });

    const io = getIO();
    io.to(addresseeId).emit("friend:request", {
      request: {
        id: friendship.id,
        requesterId: friendship.requesterId,
        addresseeId: friendship.addresseeId,
        status: friendship.status,
        createdAt: friendship.createdAt.toISOString(),
        requester: friendship.requester,
      },
    });
    logInfo("Friends", "Emitted friend:request", { from: userId, to: addresseeId });

    res.status(201).json({
      success: true,
      data: {
        request: {
          id: friendship.id,
          requesterId: friendship.requesterId,
          addresseeId: friendship.addresseeId,
          status: friendship.status,
          createdAt: friendship.createdAt.toISOString(),
          requester: friendship.requester,
        },
      },
    });
  })
);

// POST /requests/:id/accept - accept friend request
router.post(
  "/requests/:id/accept",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { id } = req.params;

    const friendship = await prisma.friendship.findUnique({ where: { id } });

    if (!friendship) {
      throw new AppError("Friend request not found", 404);
    }
    if (friendship.addresseeId !== userId) {
      throw new AppError("Not authorized to accept this request", 403);
    }
    if (friendship.status !== "pending") {
      throw new AppError("Friend request is no longer pending", 400);
    }

    const updated = await prisma.friendship.update({
      where: { id },
      data: { status: "accepted" },
    });

    const io = getIO();
    io.to(friendship.requesterId).emit("friend:accepted", { friendId: userId });
    logInfo("Friends", "Emitted friend:accepted", { from: userId, to: friendship.requesterId });

    res.json({ success: true, data: { friendship: { ...updated, createdAt: updated.createdAt.toISOString() } } });
  })
);

// POST /requests/:id/reject - reject friend request
router.post(
  "/requests/:id/reject",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { id } = req.params;

    const friendship = await prisma.friendship.findUnique({ where: { id } });

    if (!friendship) {
      throw new AppError("Friend request not found", 404);
    }
    if (friendship.addresseeId !== userId) {
      throw new AppError("Not authorized to reject this request", 403);
    }
    if (friendship.status !== "pending") {
      throw new AppError("Friend request is no longer pending", 400);
    }

    await prisma.friendship.delete({ where: { id } });

    res.json({ success: true });
  })
);

// DELETE /:friendId - remove friend / cancel request
router.delete(
  "/:friendId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { friendId } = req.params;

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new AppError("Friendship not found", 404);
    }

    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      throw new AppError("Not authorized to remove this friendship", 403);
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });

    res.json({ success: true });
  })
);

export default router;
