import { get, patch } from "./client";

export interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  country: string | null;
  timezone: string | null;
  nativeLanguage: string | null;
  bio: string | null;
  avatarUrl: string | null;
  englishLevel: string | null;
  interests: string[];
  totalMinutes: number;
  totalSessions: number;
  currentStreak: number;
  role: string;
  createdAt: string;
  isSuspended?: boolean;
  suspensionReason?: string | null;
}

export function getUser(userId: string) {
  return get<{ user: UserProfile }>(`/api/users/${userId}`);
}

export function updateUser(userId: string, data: Partial<UserProfile>) {
  return patch<{ user: UserProfile }>(`/api/users/${userId}`, data);
}

export function getAllUsers(params?: { limit?: number; page?: number }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();
  return get<{ users: UserProfile[]; total: number }>(`/api/users${qs ? `?${qs}` : ""}`);
}

export function getBlockedIds(userId: string) {
  return get<{ blockedIds: string[] }>(`/api/users/${userId}/blocks`);
}

export function getDiscoverableUsers() {
  return get<{ users: { id: string; name: string | null; username: string | null; country: string | null; avatarUrl: string | null; englishLevel: string | null; interests: string[]; totalSessions: number }[] }>("/api/users/discoverable");
}

export function suspendUser(userId: string, reason?: string) {
  return patch<{ user: { id: string; isSuspended: boolean; suspensionReason: string | null } }>(`/api/users/${userId}/suspend`, { reason });
}

export function unsuspendUser(userId: string) {
  return patch<{ user: { id: string; isSuspended: boolean } }>(`/api/users/${userId}/unsuspend`);
}
