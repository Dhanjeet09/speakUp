// ── Auth & Users ──
export interface UserProfile {
  id: string;
  email?: string;
  name: string | null;
  username: string | null;
  country: string | null;
  timezone: string | null;
  nativeLanguage: string | null;
  bio: string | null;
  avatarUrl: string | null;
  englishLevel: EnglishLevel | null;
  interests: string[];
  totalMinutes: number;
  totalSessions: number;
  currentStreak: number;
  role: UserRole;
  createdAt: string;
}

export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type UserRole = "learner" | "moderator" | "admin";

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
  username: string;
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
  joinedAt: number;
}

// ── Chat ──
export interface ChatMessageData {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

export interface ChatMessagePayload {
  message: ChatMessageData;
}

export interface SendMessageInput {
  receiverId: string;
  content: string;
}

// ── Match Accept/Reject ──
export interface MatchAcceptPayload {
  userId: string;
}

export interface MatchRejectPayload {
  userId: string;
}

// ── Friends ──
export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface FriendData {
  id: string;
  friendId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  englishLevel: EnglishLevel | null;
  country: string | null;
  status: FriendshipStatus;
  createdAt: string;
}

export interface FriendRequestData {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  requester?: {
    id: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    englishLevel: EnglishLevel | null;
    country: string | null;
  };
  addressee?: {
    id: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    englishLevel: EnglishLevel | null;
    country: string | null;
  };
}

export interface FriendRequestPayload {
  request: FriendRequestData;
}

// ── Online Status ──
export interface OnlineStatusPayload {
  userId: string;
}

// ── Socket Reserved Events (for client use) ──
export interface SocketReservedEvents {
  connect: () => void;
  connect_error: (err: Error) => void;
  disconnect: (reason: string) => void;
  reconnect_attempt: (attempt: number) => void;
  reconnect: () => void;
  reconnect_error: (err: Error) => void;
  reconnect_failed: () => void;
}

// ── Socket Events ──
export interface ServerToClientEvents {
  onlineCount: (payload: OnlineCountPayload) => void;
  queuePosition: (payload: QueuePositionPayload) => void;
  matchFound: (payload: MatchFoundPayload) => void;
  partnerLeft: () => void;
  error: (payload: { message: string }) => void;
  "message:received": (payload: ChatMessagePayload) => void;
  "user:online": (payload: OnlineStatusPayload) => void;
  "user:offline": (payload: OnlineStatusPayload) => void;
  "match:accepted": (payload: MatchAcceptPayload) => void;
  "match:rejected": (payload: MatchRejectPayload) => void;
  "typing:start": (payload: { senderId: string }) => void;
  "typing:stop": (payload: { senderId: string }) => void;
  "friend:request": (payload: FriendRequestPayload) => void;
  "friend:accepted": (payload: { friendId: string }) => void;
  "friend:calling": (payload: { callerId: string; callerName: string; roomId: string }) => void;
  "call:busy": (payload: { message: string }) => void;
  "friend:call-answer": (payload: { callerId: string; accepted: boolean; roomId?: string; answererId?: string }) => void;
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
  "message:send": (data: SendMessageInput) => void;
  "typing:start": (data: { receiverId: string }) => void;
  "typing:stop": (data: { receiverId: string }) => void;
  "match:accept": (data: { userId: string }) => void;
  "match:reject": (data: { userId: string }) => void;
  "friend:call": (data: { friendId: string; roomId: string; callerName?: string }) => void;
  "friend:call-answer": (data: { callerId: string; accepted: boolean; roomId: string; answererId?: string }) => void;
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
