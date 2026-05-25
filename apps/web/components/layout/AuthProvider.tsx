"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { getSupabase } from "@/lib/supabase";

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
        await fetchProfile(session.user.id);
      }
      if (!cancelled) setLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("User")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) setProfile(data as any);
    } finally {
      fetchingRef.current = false;
    }
  }

  return <>{children}</>;
}
