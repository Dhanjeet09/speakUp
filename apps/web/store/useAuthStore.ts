import { create } from "zustand";
import { User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
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

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
}));
