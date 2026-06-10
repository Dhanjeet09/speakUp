"use client";

import { useEffect, useRef } from "react";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useAuthStore } from "@/store/useAuthStore";
import { getSupabase } from "@/lib/supabase";
import { get } from "@/lib/api/client";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser, setProfile, setLoading } = useAuthStore();
  const fetchingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      const res = await getSupabase().auth.getSession();
      if (cancelled) return;
      const session = res.data.session;
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile();
      }
      if (!cancelled) setLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile();
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await getSupabase().auth.refreshSession();
      } catch {
      }
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchProfile() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await get<{
        user: { id: string; email?: string };
        profile: {
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
        };
      }>("/api/auth/me");
      if (res?.profile) setProfile(res.profile);
      if (res?.user) setUser(res.user as User);
    } catch {
    } finally {
      fetchingRef.current = false;
    }
  }

  return <>{children}</>;
}
