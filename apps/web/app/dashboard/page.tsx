"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getTodaysTopic } from "@/lib/topics";
import { blockUser } from "@/lib/api/reports";
import { getDiscoverableUsers } from "@/lib/api/users";
import { sendFriendRequest } from "@/lib/api/friends";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuthStore();
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [discoverableUsers, setDiscoverableUsers] = useState<any[]>([]);
  const [loadingDiscoverable, setLoadingDiscoverable] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (!isLoading && profile && !profile.englishLevel) { router.push("/onboarding"); return; }
    if (user) { fetchSessions(); fetchDiscoverable(); }
  }, [user, profile, isLoading]);

  async function fetchSessions() {
    if (!user) return;
    try {
      const { getSessions } = await import("@/lib/api/sessions");
      const res = await getSessions(user.id, 5);
      if (res?.sessions) setRecentSessions(res.sessions);
    } catch {} finally { setLoadingSessions(false); }
  }

  async function fetchDiscoverable() {
    try {
      const res = await getDiscoverableUsers();
      setDiscoverableUsers((res.users || []).filter((u) => u.id !== user?.id));
    } catch {} finally { setLoadingDiscoverable(false); }
  }

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back${profile.name ? `, ${profile.name}` : ""}`}
        description={`${profile.englishLevel || "No level"} · ${profile.country || "No country set"}`}
        action={
          <Link href="/match">
            <Button size="lg" className="px-8 shadow-elevated">
              Find a Partner
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
          <CardContent className="pt-6">
            <p className="text-body-sm font-medium text-text-secondary">Total Minutes</p>
            <p className="mt-1 text-h3 font-bold text-primary">{profile.totalMinutes}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-secondary/5 to-transparent border-secondary/10">
          <CardContent className="pt-6">
            <p className="text-body-sm font-medium text-text-secondary">Sessions</p>
            <p className="mt-1 text-h3 font-bold text-secondary">{profile.totalSessions}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/5 to-transparent border-success/10">
          <CardContent className="pt-6">
            <p className="text-body-sm font-medium text-text-secondary">Current Streak</p>
            <p className="mt-1 text-h3 font-bold text-success">
              <CountUp value={profile.currentStreak} /> day{profile.currentStreak !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-h4">Today&apos;s Topic</h2>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 p-5">
              <p className="text-body-reg text-text-primary leading-relaxed">{getTodaysTopic()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-h4">Discover Users</h2>
          </CardHeader>
          <CardContent>
            {loadingDiscoverable ? (
              <div className="space-y-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : discoverableUsers.length === 0 ? (
              <EmptyState icon="👥" title="No users yet" description="Invite friends to join SpeakUp!" />
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {discoverableUsers.slice(0, 6).map((u: any) => (
                  <div key={u.id} className="group flex items-center justify-between rounded-xl border border-border bg-white p-3 transition-all hover:border-primary/30 hover:shadow-sm">
                    <Link href={`/profile/${u.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 text-sm font-semibold text-primary">
                        {u.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-body-sm font-medium text-text-primary truncate">{u.name || "Unknown"}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {u.englishLevel && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{u.englishLevel}</Badge>}
                          {u.country && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{u.country}</Badge>}
                        </div>
                      </div>
                    </Link>
                    <Button size="sm" variant="ghost" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={async () => {
                      try { await sendFriendRequest(u.id); toast.success("Friend request sent!"); } catch { toast.error("Failed"); }
                    }}>Add</Button>
                  </div>
                ))}
                {discoverableUsers.length > 6 && (
                  <Link href="/friends" className="block text-center text-body-sm text-primary hover:underline pt-2">View all users</Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-h4">Recent Sessions</h2>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <div className="space-y-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
          ) : recentSessions.length === 0 ? (
            <EmptyState icon="🎙️" title="No sessions yet" description="Start your first practice session" action={<Link href="/match"><Button>Start Practicing</Button></Link>} />
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s: any) => {
                const isUser1 = s.user1Id === user?.id;
                const partnerId = isUser1 ? s.user2Id : s.user1Id;
                const partnerName = isUser1 ? s.user2?.name : s.user1?.name;
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-4 transition-colors hover:bg-gray-50">
                    <div>
                      <p className="text-body-sm font-medium text-text-primary">{s.topicUsed || "Free talk"}</p>
                      <p className="text-caption text-text-muted mt-0.5">
                        {new Date(s.createdAt).toLocaleDateString()} · {Math.floor(s.durationSeconds / 60)} min
                        {partnerName && <> · {partnerName}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={s.user1Rating !== null || s.user2Rating !== null ? "success" : "outline"}>
                        {s.user1Rating !== null || s.user2Rating !== null ? "Rated" : "No rating"}
                      </Badge>
                      {partnerId && (
                        <button onClick={async () => { try { await blockUser(partnerId); toast.success("Blocked"); } catch { toast.error("Failed"); } }} className="text-caption text-text-muted hover:text-danger transition-colors">
                          Block
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const duration = 800;
    const start = performance.now();
    function frame(now: number) {
      const elapsed = now - start;
      setDisplay(Math.floor(Math.min(elapsed / duration, 1) * value));
      if (elapsed < duration) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, [value]);
  return <>{display}</>;
}
