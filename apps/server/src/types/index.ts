import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SessionCreateInput {
  user1Id: string;
  user2Id: string;
  durationSeconds: number;
  topicUsed?: string;
  roomUrl?: string;
}

export interface ReportCreateInput {
  reporterId: string;
  reportedId: string;
  reason: string;
  note?: string;
}

export interface BlockCreateInput {
  blockerId: string;
  blockedId: string;
}

export interface QueueUser {
  userId: string;
  level: string;
  interests: string[];
  blockedUserIds: string[];
  joinedAt: number;
}

export interface MatchFoundPayload {
  partnerUserId: string;
  partner: {
    name: string;
    country: string;
    level: string;
  };
  roomId: string;
  isCaller: boolean;
  topic: string;
}
