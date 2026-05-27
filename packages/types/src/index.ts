// ── Auth & Users ──
export interface UserProfile {
  id: string;
  email?: string;
  name: string | null;
  country: string | null;
  avatarUrl: string | null;
  englishLevel: EnglishLevel | null;
  interests: string[];
  totalMinutes: number;
  totalSessions: number;
  currentStreak: number;
  createdAt: string;
}

export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

// ── Sessions ──
export interface SessionData {
  id: string;
  createdAt: string;
  durationSeconds: number;
  user1Id: string;
  user2Id: string;
  topicUsed: string | null;
  user1Rating: boolean | null;
  user2Rating: boolean | null;
  roomUrl: string | null;
}

export interface CreateSessionInput {
  user1Id: string;
  user2Id: string;
  durationSeconds: number;
  topicUsed?: string;
  roomUrl?: string;
}

// ── Reports & Blocks ──
export type ReportReason =
  | "inappropriate_language"
  | "harassment"
  | "spam"
  | "other";

export interface CreateReportInput {
  reportedId: string;
  reason: ReportReason;
  note?: string;
}

export interface BlockUserInput {
  blockedId: string;
}

// ── Matchmaking ──
export type MatchState = "IDLE" | "SEARCHING" | "MATCHED" | "IN_CALL" | "ENDED";

export interface MatchPartner {
  name: string;
  country: string;
  level: string;
}

export interface MatchFoundPayload {
  partnerUserId: string;
  partner: MatchPartner;
  roomId: string;
  isCaller: boolean;
  topic: string;
}

export interface QueuePositionPayload {
  waitingCount: number;
}

export interface OnlineCountPayload {
  count: number;
}

export interface QueueUser {
  userId: string;
  level: string;
  interests: string[];
  blockedUserIds: string[];
  joinedAt: number;
}

// ── Socket Events ──
export interface ServerToClientEvents {
  onlineCount: (payload: OnlineCountPayload) => void;
  queuePosition: (payload: QueuePositionPayload) => void;
  matchFound: (payload: MatchFoundPayload) => void;
  partnerLeft: () => void;
  error: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  getOnlineCount: () => void;
  joinQueue: (data: {
    userId: string;
    level: string;
    interests: string[];
  }) => void;
  leaveQueue: () => void;
  callEnded: (data: { roomId?: string; partnerUserId?: string }) => void;
}

// ── API Response ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Express ──
import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}
