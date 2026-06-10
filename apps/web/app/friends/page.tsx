"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { getSocket, connectSocket, emitFriendCall } from "@/lib/socket";
import {
  getFriends, getFriendRequests, getSentRequests,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  removeFriend, searchUsers,
} from "@/lib/api/friends";
import type { FriendData, FriendRequestData, FriendUser } from "@/lib/api/friends";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function FriendsPage() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState("friends");
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [received, setReceived] = useState<FriendRequestData[]>([]);
  const [sent, setSent] = useState<FriendRequestData[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    connectSocket(user.id).catch(() => {});
    fetchFriends();
    fetchRequests();
    const socket = getSocket();
    const refresh = () => { fetchFriends(); fetchRequests(); };
    const onFriendRequest = () => { toast("New friend request!"); refresh(); };
    const onFriendAccepted = () => { toast("Friend request accepted!"); refresh(); };
    const onUserOnline = ({ userId }: { userId: string }) => setOnlineUsers((p) => new Set(p).add(userId));
    const onUserOffline = ({ userId }: { userId: string }) => setOnlineUsers((p) => { const n = new Set(p); n.delete(userId); return n; });
    socket.on("friend:request", onFriendRequest);
    socket.on("friend:accepted", onFriendAccepted);
    socket.on("user:online", onUserOnline);
    socket.on("user:offline", onUserOffline);
    return () => { socket.off("friend:request", onFriendRequest); socket.off("friend:accepted", onFriendAccepted); socket.off("user:online", onUserOnline); socket.off("user:offline", onUserOffline); };
  }, [user?.id]);

  async function fetchFriends() {
    try { const r = await getFriends(); setFriends(r.friends || []); } catch {} finally { setLoadingFriends(false); }
  }
  async function fetchRequests() {
    setLoadingRequests(true);
    try { const [r, s] = await Promise.all([getFriendRequests(), getSentRequests()]); setReceived(r.requests || []); setSent(s.requests || []); } catch {} finally { setLoadingRequests(false); }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true); setSearched(true);
      try { const r = await searchUsers(searchQuery.trim()); setSearchResults((r.users || []).filter((u) => u.id !== user?.id)); } catch {} finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, user?.id]);

  const requestCount = received.filter((r) => r.status === "pending").length;

  if (authLoading || !profile) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-72" /><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-card" />)}</div></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Friends" description="Connect with speaking partners" />

      <Tabs defaultValue="friends" value={activeTab} onChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="requests">
            Requests {requestCount > 0 && <Badge variant="danger" className="ml-1.5 text-[10px] px-1.5">{requestCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="add">Add Friend</TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          {loadingFriends ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-card" />)}
            </div>
          ) : friends.length === 0 ? (
            <EmptyState icon="👥" title="No friends yet" description="Add friends to start practicing together!" action={<Button onClick={() => setActiveTab("add")}>Find Friends</Button>} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map((f) => (
                <Card key={f.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 text-lg font-bold text-primary">
                      {f.name?.[0]?.toUpperCase() || "?"}
                      {onlineUsers.has(f.friendId) && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-success ring-2 ring-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium text-text-primary truncate">{f.name || "Unknown"}</p>
                      {f.username && <p className="text-caption text-text-muted truncate">@{f.username}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.englishLevel && <Badge variant="secondary" className="text-[11px]">{f.englishLevel}</Badge>}
                    {f.country && <Badge variant="outline" className="text-[11px]">{f.country}</Badge>}
                    <Badge variant={onlineUsers.has(f.friendId) ? "success" : "outline"} className="text-[11px]">{onlineUsers.has(f.friendId) ? "Online" : "Offline"}</Badge>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => router.push(`/chat?userId=${f.friendId}`)}>Message</Button>
                    <Button size="sm" variant="default" className="flex-1" onClick={() => { const roomId = `call_${[user?.id, f.friendId].sort().join("_")}`; emitFriendCall({ friendId: f.friendId, roomId, callerName: profile?.name || "Unknown" }); toast.success("Calling..."); }}>Call</Button>
                    <Button size="sm" variant="danger" className="flex-1" onClick={() => { if (confirm("Remove this friend?")) { handleRemoveFriend(f.friendId); } }}>Remove</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {loadingRequests ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-card" />)}</div>
          ) : (
            <div className="space-y-8">
              <section>
                <h3 className="text-h4 mb-4">Received ({received.filter((r) => r.status === "pending").length})</h3>
                {received.filter((r) => r.status === "pending").length === 0 ? (
                  <EmptyState icon="📥" title="No pending requests" description="When someone sends you a request, it will appear here" />
                ) : (
                  <div className="space-y-2">
                    {received.filter((r) => r.status === "pending").map((req) => (
                      <div key={req.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 text-sm font-bold text-primary">
                            {req.requester?.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-body-sm font-medium text-text-primary">{req.requester?.name || "Unknown"}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { acceptFriendRequest(req.id).then(() => { toast.success("Accepted!"); fetchFriends(); fetchRequests(); }).catch(() => toast.error("Failed")); }}>Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => { rejectFriendRequest(req.id).then(() => { toast.success("Rejected"); fetchRequests(); }).catch(() => toast.error("Failed")); }}>Reject</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h3 className="text-h4 mb-4">Sent ({sent.length})</h3>
                {sent.length === 0 ? (
                  <EmptyState icon="📤" title="No sent requests" description="Search for users to send friend requests" />
                ) : (
                  <div className="space-y-2">
                    {sent.map((req) => (
                      <div key={req.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 text-sm font-bold text-primary">
                            {req.addressee?.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-body-sm font-medium text-text-primary">{req.addressee?.name || "Unknown"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Pending</Badge>
                          <Button size="sm" variant="ghost" onClick={() => { rejectFriendRequest(req.id).then(() => { toast.success("Cancelled"); fetchRequests(); }).catch(() => toast.error("Failed")); }}>Cancel</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="add">
          <div className="max-w-md">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search users by name..." />
          </div>
          <div className="mt-6">
            {searching ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-card" />)}</div>
            ) : searched && searchResults.length === 0 ? (
              <EmptyState icon="🔍" title="No users found" description="Try a different search term" />
            ) : !searched ? (
              <EmptyState icon="👆" title="Search for users" description="Type a name to find speaking partners" />
            ) : (
              <div className="space-y-2">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 text-sm font-bold text-primary">
                        {u.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-body-sm font-medium text-text-primary">{u.name || "Unknown"}</p>
                        <div className="flex gap-1 mt-0.5">
                          {u.englishLevel && <Badge variant="secondary" className="text-[10px]">{u.englishLevel}</Badge>}
                          {u.country && <Badge variant="outline" className="text-[10px]">{u.country}</Badge>}
                        </div>
                      </div>
                    </div>
                    {friends.some((f) => f.friendId === u.id) ? (
                      <Badge variant="success">Friends</Badge>
                    ) : sent.some((r) => r.addresseeId === u.id) ? (
                      <Badge variant="outline">Pending</Badge>
                    ) : (
                      <Button size="sm" onClick={() => { sendFriendRequest(u.id).then(() => { toast.success("Request sent!"); fetchRequests(); }).catch(() => toast.error("Failed")); }}>Add Friend</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  async function handleRemoveFriend(friendId: string) {
    try { await removeFriend(friendId); setFriends((p) => p.filter((f) => f.friendId !== friendId)); toast.success("Friend removed"); } catch { toast.error("Failed"); }
  }
}
