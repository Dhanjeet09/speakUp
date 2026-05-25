import { get, put } from "./client";

export interface UserProfile {
  id: string;
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

export function getUser(userId: string) {
  return get<{ user: UserProfile }>(`/api/users/${userId}`);
}

export function updateUser(userId: string, data: Partial<UserProfile>) {
  return put<{ user: UserProfile }>(`/api/users/${userId}`, data);
}
