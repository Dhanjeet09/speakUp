"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { getAllUsers, suspendUser, unsuspendUser } from "@/lib/api/users";
import { get } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import toast from "react-hot-toast";

interface ReportData { id: string; reporterId: string; reportedId: string; reason: string; note: string | null; createdAt: string; reporter?: { name: string; email: string }; reported?: { name: string; email: string }; }
interface UserRow { id: string; email?: string; name: string | null; role: string; totalSessions: number; totalMinutes: number; isSuspended?: boolean; }

const USER_LIMIT = 20;

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, isLoading } = useAuthStore();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userPage, setUserPage] = useState(1);

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (!isLoading && profile && profile.role !== "admin" && profile.role !== "moderator") { router.push("/dashboard"); toast.error("Access denied"); return; }
    if (!isLoading && (profile?.role === "admin" || profile?.role === "moderator")) { fetchReports(); fetchUsers(); }
  }, [user, profile, isLoading]);

  useEffect(() => { if (profile?.role === "admin" || profile?.role === "moderator") fetchUsers(); }, [userPage]);

    async function fetchReports() {
    setLoadingReports(true);
    try { const res = await get<{ reports: ReportData[] }>("/api/reports/open"); setReports(res.reports || []); } catch {} finally { setLoadingReports(false); }
  }

    async function fetchUsers() {
    setLoadingUsers(true);
    try { const res = await getAllUsers({ limit: USER_LIMIT, page: userPage }); setUsers(res.users || []); setTotalUsers(res.total || 0); } catch {} finally { setLoadingUsers(false); }
  }

  if (isLoading || !profile) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full rounded-card" /></div>;
  }

  const isModerator = profile.role === "moderator";

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Panel" description="Manage users, reports, and platform content" />

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          {!isModerator && <TabsTrigger value="users">Users</TabsTrigger>}
        </TabsList>

        <TabsContent value="reports">
          {loadingReports ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-card" />)}</div>
          ) : reports.length === 0 ? (
            <EmptyState icon="🛡️" title="No unresolved reports" description="All reports have been reviewed" />
          ) : (
            <Table
              data={reports}
              keyExtractor={(r) => r.id}
              columns={[
                { key: "reporter", header: "Reporter", render: (r: ReportData) => <span>{r.reporter?.name || r.reporterId.slice(0, 8)}</span> },
                { key: "reported", header: "Reported", render: (r: ReportData) => <span>{r.reported?.name || r.reportedId.slice(0, 8)}</span> },
                { key: "reason", header: "Reason", render: (r: ReportData) => <div><Badge variant="outline">{r.reason}</Badge>{r.note && <p className="text-caption text-text-muted mt-1">{r.note}</p>}</div> },
                { key: "date", header: "Date", render: (r: ReportData) => <span className="text-text-secondary">{new Date(r.createdAt).toLocaleDateString()}</span> },
                { key: "actions", header: "Actions", render: (r: ReportData) => <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handleResolve(r.id)}>Resolve</Button>{!isModerator && <Button size="sm" variant="danger" onClick={() => handleSuspend(r.reportedId)}>Suspend</Button>}</div> },
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="users">
          {loadingUsers ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-card" />)}</div>
          ) : users.length === 0 ? (
            <EmptyState icon="👥" title="No users found" />
          ) : (
            <>
              <Table
                data={users}
                keyExtractor={(u) => u.id}
                columns={[
                  { key: "name", header: "Name", render: (u: UserRow) => <span className="font-medium">{u.name || "Anonymous"}</span> },
                  { key: "email", header: "Email", render: (u: UserRow) => <span className="text-text-secondary">{u.email || "-"}</span> },
                  { key: "role", header: "Role", render: (u: UserRow) => <Badge variant={u.role === "admin" ? "default" : u.role === "moderator" ? "success" : "outline"}>{u.role}</Badge> },
                  { key: "status", header: "Status", render: (u: UserRow) => u.isSuspended ? <Badge variant="danger">Suspended</Badge> : <Badge variant="success">Active</Badge> },
                  { key: "totalSessions", header: "Sessions", render: (u: UserRow) => <span>{u.totalSessions}</span> },
                  { key: "totalMinutes", header: "Minutes", render: (u: UserRow) => <span>{u.totalMinutes}</span> },
                  { key: "actions", header: "Actions", render: (u: UserRow) => u.isSuspended ? <Button size="sm" variant="success" onClick={() => handleUnsuspend(u.id)}>Unsuspend</Button> : <Button size="sm" variant="danger" onClick={() => handleSuspend(u.id)}>Suspend</Button> },
                ]}
              />
              <div className="mt-6">
                <Pagination currentPage={userPage} totalPages={Math.ceil(totalUsers / USER_LIMIT)} onPageChange={setUserPage} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  async function handleResolve(reportId: string) {
    try { const { put } = await import("@/lib/api/client"); await put(`/api/reports/${reportId}/resolve`, {}); toast.success("Resolved"); fetchReports(); } catch { toast.error("Failed"); }
  }
  async function handleSuspend(userId: string) {
    const reason = prompt("Suspension reason (optional):");
    try { await suspendUser(userId, reason || undefined); toast.success("Suspended"); fetchUsers(); } catch { toast.error("Failed"); }
  }
  async function handleUnsuspend(userId: string) {
    try { await unsuspendUser(userId); toast.success("Unsuspended"); fetchUsers(); } catch { toast.error("Failed"); }
  }
}
