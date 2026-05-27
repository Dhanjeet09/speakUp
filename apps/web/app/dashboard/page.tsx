"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/layout/Navbar";
import { getTodaysTopic } from "@/lib/topics";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuthStore();
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (!isLoading && profile && !profile.englishLevel) {
      router.push("/onboarding");
      return;
    }
    if (user) fetchSessions();
  }, [user, profile, isLoading]);

  async function fetchSessions() {
    if (!user) return;
    try {
      const { getSessions } = await import("@/lib/api/sessions");
      const res = await getSessions(user.id, 5);
      if (res?.sessions) setRecentSessions(res.sessions);
    } catch {
    } finally {
      setLoadingSessions(false);
    }
  }

  if (isLoading || !profile) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <Skeleton className="h-8 w-48" />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back{profile.name ? `, ${profile.name}` : ""}
            </h1>
            <p className="text-sm text-gray-500">
              {profile.englishLevel} &middot; {profile.country || "No country set"}
            </p>
          </div>
          <Badge>{profile.englishLevel}</Badge>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Minutes</p>
              <p className="text-2xl font-bold">{profile.totalMinutes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Sessions This Week</p>
              <p className="text-2xl font-bold">{profile.totalSessions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Current Streak</p>
              <p className="text-2xl font-bold">
                {profile.currentStreak} day{profile.currentStreak !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Link href="/match">
            <Button size="lg" className="px-10">
              Find a Partner
            </Button>
          </Link>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <h2 className="font-semibold">Today&apos;s Topic</h2>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{getTodaysTopic()}</p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-semibold">Recent Sessions</h2>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recentSessions.length === 0 ? (
              <p className="text-sm text-gray-500">
                No sessions yet. Find a partner to start!
              </p>
            ) : (
              <div className="space-y-3">
                {recentSessions.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {s.topicUsed || "Free talk"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(s.createdAt).toLocaleDateString()} &middot;{" "}
                        {Math.floor(s.durationSeconds / 60)} min
                      </p>
                    </div>
                    <Badge
                      variant={
                        s.user1Rating === true || s.user2Rating === true
                          ? "success"
                          : "outline"
                      }
                    >
                      {s.user1Rating !== null || s.user2Rating !== null
                        ? "Rated"
                        : "No rating"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
