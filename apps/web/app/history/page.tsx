"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { getSessions } from "@/lib/api/sessions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuthStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (!isLoading && user) fetchSessions();
  }, [user, isLoading, page]);

  async function fetchSessions() {
    if (!user) return;
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await getSessions(user.id, PAGE_SIZE, offset);
      setSessions(res.sessions || []);
      setTotal(res.total ?? 0);
    } catch { toast.error("Failed to load history"); } finally { setLoading(false); }
  }

  if (isLoading || !profile) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-card" />)}</div></div>;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader title="Session History" description="Review your past practice sessions" />

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-card" />)}</div>
      ) : sessions.length === 0 ? (
        <EmptyState icon="🎙️" title="No sessions yet" description="Complete a practice session to see it here" action={<button className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-body-sm font-medium hover:bg-primary-dark transition-colors" onClick={() => router.push("/match")}>Start Practicing</button>} />
      ) : (
        <>
          <div className="space-y-2">
            {sessions.map((s: any) => {
              const isUser1 = s.user1Id === user?.id;
              const partnerName = isUser1 ? s.user2?.name : s.user1?.name;
              const rating = isUser1 ? s.user1Rating : s.user2Rating;
              return (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-4 transition-colors hover:bg-gray-50">
                  <div>
                    <p className="text-body-sm font-medium text-text-primary">{partnerName || "Unknown partner"}</p>
                    <p className="text-caption text-text-muted mt-0.5">
                      {new Date(s.createdAt).toLocaleDateString()} · {Math.floor(s.durationSeconds / 60)} min {s.durationSeconds % 60} sec
                      {s.topicUsed && <> · {s.topicUsed}</>}
                    </p>
                  </div>
                  <Badge variant={rating === true ? "success" : rating === false ? "danger" : "outline"}>
                    {rating === true ? "Positive" : rating === false ? "Negative" : "No rating"}
                  </Badge>
                </div>
              );
            })}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
