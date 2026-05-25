import { z } from "zod";

// ─── English Levels ──────────────────────────────────────────────────────────
export const ENGLISH_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

// ─── Report Reasons ──────────────────────────────────────────────────────────
export const REPORT_REASONS = [
  "inappropriate_language",
  "harassment",
  "spam",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// ─── Constants ───────────────────────────────────────────────────────────────
export const MATCH_INTERVAL_MS = 3000;
export const STALE_QUEUE_TIMEOUT_MS = 5 * 60 * 1000;
export const INTEREST_MATCH_TIMEOUT_MS = 20_000;
export const LEVEL_EXPAND_TIMEOUT_MS = 45_000;
export const MAX_QUEUE_WAIT_SECONDS = 90;
export const API_TIMEOUT_MS = 10_000;
export const MAX_MATCH_ITERATIONS = 50;
export const QUEUE_CLEANUP_INTERVAL_MS = 60_000;
export const JOIN_QUEUE_DEBOUNCE_MS = 5_000;
export const SOCKET_RECONNECTION_ATTEMPTS = 5;
export const SOCKET_RECONNECTION_DELAY_MS = 2_000;
export const CALL_CONNECT_TIMEOUT_MS = 20_000;
export const ANSWER_TIMEOUT_MS = 15_000;
export const QUALITY_CHECK_INTERVAL_MS = 5_000;
export const SESSION_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
export const TOAST_DURATION_MS = 4_000;
export const MAX_HTTP_BUFFER_SIZE = 1e6; // 1MB
export const CONNECTION_POOL_LIMIT = 5;

// ─── API Response ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ─── User Profile ────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  country: string | null;
  avatarUrl: string | null;
  englishLevel: string | null;
  interests: string[];
  totalMinutes: number;
  totalSessions: number;
  currentStreak: number;
  createdAt: string;
}

// ─── Session ─────────────────────────────────────────────────────────────────
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
  user1?: Pick<UserProfile, "id" | "name" | "country" | "englishLevel">;
  user2?: Pick<UserProfile, "id" | "name" | "country" | "englishLevel">;
}

// ─── Queue User ──────────────────────────────────────────────────────────────
export interface QueueUser {
  userId: string;
  level: string;
  interests: string[];
  blockedUserIds: string[];
  joinedAt: number;
  socketId?: string;
}

// ─── Match Found ─────────────────────────────────────────────────────────────
export interface Partner {
  name: string;
  country: string;
  level: string;
}

export interface MatchFoundPayload {
  partnerUserId: string;
  partner: Partner;
  roomId: string;
  isCaller: boolean;
  topic: string;
}

// ─── Match State ─────────────────────────────────────────────────────────────
export type MatchState = "IDLE" | "SEARCHING" | "MATCHED" | "IN_CALL" | "ENDED";

// ─── Connection Quality ──────────────────────────────────────────────────────
export type ConnectionQuality = "good" | "fair" | "poor";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

// Socket.io payloads
export const joinQueueSchema = z.object({
  userId: z.string().min(1),
  level: z.enum(ENGLISH_LEVELS),
  interests: z.array(z.string()).default([]),
  blockedUserIds: z.array(z.string()).default([]),
});
export type JoinQueueInput = z.infer<typeof joinQueueSchema>;

export const callEndedSchema = z.object({
  roomId: z.string().min(1),
});
export type CallEndedInput = z.infer<typeof callEndedSchema>;

// API schemas
export const createSessionSchema = z.object({
  user1Id: z.string().min(1),
  user2Id: z.string().min(1),
  durationSeconds: z.number().int().min(0).max(86400),
  topicUsed: z.string().max(500).optional(),
  roomUrl: z.string().max(500).optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  country: z.string().max(100).optional(),
  englishLevel: z.enum(ENGLISH_LEVELS).optional(),
  interests: z.array(z.string().min(1)).max(20).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const createReportSchema = z.object({
  reportedId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  note: z.string().max(500).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const blockUserSchema = z.object({
  blockedId: z.string().min(1),
});
export type BlockUserInput = z.infer<typeof blockUserSchema>;

// ─── Server Error Event ──────────────────────────────────────────────────────
export interface ServerErrorPayload {
  message: string;
  code?: string;
}

// ─── Authenticated Request Extension ─────────────────────────────────────────
export interface AuthUser {
  userId: string;
  userEmail?: string;
}

// ─── PeerJS Error Types ──────────────────────────────────────────────────────
export const PEER_ERROR_MESSAGES: Record<string, string> = {
  network: "Connection lost, retrying...",
  "peer-unavailable": "Partner disconnected before connecting",
  "browser-incompatible": "Your browser doesn't support video calls",
  disconnected: "Call service disconnected, reconnecting...",
  "server-error": "Call service unavailable, try again",
  "socket-error": "Signalling connection failed",
  "socket-closed": "Signalling connection closed",
  "unavailable-id": "Call ID conflict, please try again",
  "webrtc": "WebRTC connection failed",
};

// ─── ICE Server Config ───────────────────────────────────────────────────────
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
