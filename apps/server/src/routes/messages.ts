import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { validateZod } from "../middleware/validateZod";
import { validateParamId } from "../middleware/validateParams";
import { sendMessageSchema } from "../schemas";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import { logInfo } from "../lib/logger";
import { getIO } from "../lib/socket";
import sanitizeHtml from "sanitize-html";
import type { AuthenticatedRequest } from "../types";

const router = Router();

router.get(
  "/conversations",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    logInfo("Messages", "Fetching conversations", { userId, limit });

    const [sentMessages, receivedMessages] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.chatMessage.findMany({
        where: { receiverId: userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    const allMessages = [...sentMessages, ...receivedMessages];
    allMessages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const messages = allMessages.slice(0, limit);

    logInfo("Messages", `Found ${messages.length} messages for user`, { userId });

    const conversationMap = new Map<
      string,
      {
        otherUser: { id: string; name: string | null; avatarUrl: string | null };
        lastMessage: { id: string; content: string; createdAt: Date };
        unreadCount: number;
      }
    >();

    for (const msg of messages) {
      const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationMap.has(otherUserId)) {
        const isUnread = msg.receiverId === userId && msg.readAt === null;
        conversationMap.set(otherUserId, {
          otherUser: { id: otherUserId, name: null, avatarUrl: null },
          lastMessage: { id: msg.id, content: msg.content, createdAt: msg.createdAt },
          unreadCount: isUnread ? 1 : 0,
        });
      } else {
        const conv = conversationMap.get(otherUserId)!;
        if (msg.receiverId === userId && msg.readAt === null) {
          conv.unreadCount++;
        }
      }
    }

    const otherUserIds = Array.from(conversationMap.keys());
    if (otherUserIds.length > 0) {
      type UserInfo = { id: string; name: string | null; avatarUrl: string | null };
      const users = (await prisma.user.findMany({
        where: { id: { in: otherUserIds } },
        select: { id: true, name: true, avatarUrl: true },
      })) as UserInfo[];
      const userMap = new Map<string, UserInfo>(users.map((u) => [u.id, u]));
      for (const [id, conv] of conversationMap) {
        const user = userMap.get(id);
        if (user) {
          conv.otherUser = { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
        }
      }
    }

    const conversations = Array.from(conversationMap.values()).map((conv) => ({
      userId: conv.otherUser.id,
      name: conv.otherUser.name || "Unknown",
      avatarUrl: conv.otherUser.avatarUrl,
      lastMessage: conv.lastMessage.content,
      lastMessageAt:
        conv.lastMessage.createdAt instanceof Date
          ? conv.lastMessage.createdAt.toISOString()
          : conv.lastMessage.createdAt,
      unreadCount: conv.unreadCount,
    }));

    logInfo("Messages", `Returning ${conversations.length} conversations`, {
      userId,
      conversationIds: conversations.map((c) => c.userId).join(","),
    });

    res.json({
      success: true,
      data: { conversations },
    });
  })
);

router.get(
  "/:userId",
  requireAuth,
  validateParamId("userId"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.userId!;
    const otherUserId = req.params.userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    logInfo("Messages", "Fetching messages between users", {
      userId,
      otherUserId,
      limit,
      offset,
    });

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.chatMessage.count({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
      }),
    ]);

    logInfo("Messages", `Found ${messages.length}/${total} messages`, {
      userId,
      otherUserId,
    });

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          limit,
          offset,
          total,
        },
      },
    });
  })
);

router.patch(
  "/read/:userId",
  requireAuth,
  validateParamId("userId"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const currentUserId = req.userId!;
    const senderId = req.params.userId;

    const result = await prisma.chatMessage.updateMany({
      where: {
        senderId,
        receiverId: currentUserId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    logInfo("Messages", "Marked messages as read", {
      currentUserId,
      senderId,
      updatedCount: result.count,
    });

    res.json({ success: true, data: { updatedCount: result.count } });
  })
);

router.post(
  "/",
  requireAuth,
  validateZod(sendMessageSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { receiverId, content } = req.body;
    const userId = req.userId!;

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true },
    });
    if (sender?.isSuspended) {
      throw new AppError("Account suspended", 403);
    }

    const [blockedBySender, blockedByReceiver] = await Promise.all([
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: receiverId } },
      }),
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: receiverId, blockedId: userId } },
      }),
    ]);

    if (blockedBySender || blockedByReceiver) {
      throw new AppError("Cannot send message to this user", 403);
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: userId, addresseeId: receiverId },
          { requesterId: receiverId, addresseeId: userId },
        ],
      },
    });
    if (!friendship) throw new AppError("Can only send messages to friends", 403);

    // FIX BUG-005: Limit message content length consistently with socket handler (index.ts line 310)
    const sanitized = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).slice(0, 1000);

    const message = await prisma.chatMessage.create({
      data: {
        senderId: userId,
        receiverId,
        content: sanitized,
      },
    });

    logInfo("Messages", "Message created via HTTP", {
      messageId: message.id,
      senderId: userId,
      receiverId,
      contentPreview: message.content.slice(0, 50),
    });

    const io = getIO();
    const payload = {
      message: {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    };

    const receiverSockets = await io.in(receiverId).fetchSockets();
    logInfo("Messages", "Emitting message:received via socket", {
      event: "message:received",
      toReceiver: receiverId,
      messageId: message.id,
      receiverRoomSize: receiverSockets.length,
    });

    io.to(receiverId).emit("message:received", payload);

    res.status(201).json({ success: true, data: { message } });
  })
);

export default router;
