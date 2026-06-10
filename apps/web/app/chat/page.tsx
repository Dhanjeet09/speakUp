"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import {
  getSocket,
  connectSocket,
  emitTypingStart,
  emitTypingStop,
  emitFriendCall,
} from "@/lib/socket";
import { getConversations, getMessages, sendMessage, markMessagesAsRead } from "@/lib/api/chat";
import type { ConversationData, MessageData } from "@/lib/api/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/layout/Navbar";
import toast from "react-hot-toast";
import { getFriends } from "@/lib/api/friends";

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageFallback />}>
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageFallback() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="flex gap-4">
          <div className="w-80 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-card" />
            ))}
          </div>
          <div className="flex-1 space-y-3">
            <Skeleton className="h-12 w-full rounded-card" />
            <Skeleton className="h-64 w-full rounded-card" />
          </div>
        </div>
      </main>
    </>
  );
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isLoading } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const queryUserIdParamRef = useRef<string | null>(null);
  if (typeof window !== "undefined") {
    const currentParam = searchParams.get("userId");
    if (currentParam && !queryUserIdParamRef.current) {
      queryUserIdParamRef.current = currentParam;
    }
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (!isLoading && user && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      connectSocket(user.id).catch(() => {});
      (async () => {
        await fetchConversations();
        const userIdParam = queryUserIdParamRef.current;
        if (userIdParam && userIdParam !== user.id) {
          selectConversation(userIdParam);
        }
      })();
    }
  }, [user?.id, isLoading]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();

    const onMessageReceived = (payload: { message: MessageData }) => {
      const msg = payload.message;
      const currentUser = userRef.current;
      if (!currentUser) return;
      const isMe = msg.senderId === currentUser.id;
      const otherId = isMe ? msg.receiverId : msg.senderId;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) {
          return prev;
        }
        return [...prev, msg];
      });
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.userId === otherId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], lastMessage: msg.content, lastMessageAt: msg.createdAt };
          return updated;
        }
        return [...prev, {
          userId: otherId,
          name: msg.senderId === currentUser.id ? (prev.find(c => c.userId === msg.receiverId)?.name || "Unknown") : "Unknown",
          avatarUrl: null,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
        }];
      });
      if (selectedUserIdRef.current === otherId) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    };

    const onUserOnline = (payload: { userId: string }) => {
      setOnlineUsers((prev) => new Set(prev).add(payload.userId));
    };

    const onUserOffline = (payload: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
    };

    const onTypingStart = (payload: { senderId: string }) => {
      setTypingUsers((prev) => new Set(prev).add(payload.senderId));
    };

    const onTypingStop = (payload: { senderId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(payload.senderId);
        return next;
      });
    };

    socket.on("message:received", onMessageReceived);
    socket.on("user:online", onUserOnline);
    socket.on("user:offline", onUserOffline);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);

    return () => {
      socket.off("message:received", onMessageReceived);
      socket.off("user:online", onUserOnline);
      socket.off("user:offline", onUserOffline);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
    };
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchConversations() {
    try {
      const [convRes, friendsRes] = await Promise.allSettled([
        getConversations(),
        getFriends(),
      ]);

      const convs: ConversationData[] =
        convRes.status === "fulfilled" ? convRes.value.conversations || [] : [];

      if (friendsRes.status === "fulfilled") {
        const friends = friendsRes.value.friends || [];
        const convUserIds = new Set(convs.map((c: ConversationData) => c.userId));
        for (const f of friends) {
          if (!convUserIds.has(f.friendId) && f.friendId !== user?.id) {
            convs.push({
              userId: f.friendId,
              name: f.name || "Unknown",
              lastMessage: null,
              lastMessageAt: null,
              avatarUrl: f.avatarUrl,
              unreadCount: 0,
            });
            convUserIds.add(f.friendId);
          }
        }
      }

      setConversations(convs);
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoadingConv(false);
    }
  }

  async function selectConversation(userId: string) {
    setSelectedUserId(userId);
    selectedUserIdRef.current = userId;
    setLoadingMsg(true);
    setMessages([]);
    try {
      const [res] = await Promise.all([
        getMessages(userId),
        markMessagesAsRead(userId).catch(() => {}),
      ]);
      setMessages(res.messages || []);
      setConversations((prev) =>
        prev.map((c) =>
          c.userId === userId ? { ...c, unreadCount: 0 } : c
        )
      );
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 50);
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoadingMsg(false);
    }
  }

  function handleTyping() {
    if (!selectedUserId) return;
    emitTypingStart({ receiverId: selectedUserId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (selectedUserId) emitTypingStop({ receiverId: selectedUserId });
    }, 2000);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !messageText.trim() || sending) return;
    setSending(true);
    const text = messageText.trim();
    setMessageText("");
    try {
      const res = await sendMessage({ receiverId: selectedUserId, content: text });
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
      }
      emitTypingStop({ receiverId: selectedUserId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      toast.error("Failed to send message");
      setMessageText(text);
    } finally {
      setSending(false);
    }
  }

  const selectedConversation = conversations.find((c) => c.userId === selectedUserId);
  const isTyping = selectedUserId ? typingUsers.has(selectedUserId) : false;

  if (isLoading || !profile) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="flex gap-4">
            <div className="w-80 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-card" />
              ))}
            </div>
            <div className="flex-1 space-y-3">
              <Skeleton className="h-12 w-full rounded-card" />
              <Skeleton className="h-64 w-full rounded-card" />
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl px-4">
        <div className="flex w-full gap-4 py-4">
          <aside className="w-80 shrink-0 flex flex-col rounded-card border border-border bg-white">
            <div className="border-b border-border p-4">
              <h2 className="font-semibold">Conversations</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingConv ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center text-sm text-text-secondary">
                  <p>No conversations yet.</p>
                  <p className="mt-1">Start a session and chat with your partner!</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.userId}
                    onClick={() => selectConversation(conv.userId)}
                    className={`w-full border-b border-border p-4 text-left transition hover:bg-surface ${
                      selectedUserId === conv.userId ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {conv.name?.[0]?.toUpperCase() || "?"}
                          {onlineUsers.has(conv.userId) && (
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-success ring-1 ring-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{conv.name}</span>
                      </div>
                    </div>
                    <p className="mt-1 truncate text-xs text-text-secondary">
                      {conv.lastMessage || "No messages yet"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex flex-1 flex-col rounded-card border border-border bg-white">
            {!selectedUserId ? (
              <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
                Select a conversation to start chatting
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border p-4">
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {selectedConversation?.name?.[0]?.toUpperCase() || "?"}
                    {selectedUserId && onlineUsers.has(selectedUserId) && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-success ring-1 ring-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {selectedConversation?.name || "User"}
                    </span>
                  </div>
                  {selectedUserId && selectedUserId !== user?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const roomId = `call_${[user?.id, selectedUserId].sort().join("_")}`;
                        emitFriendCall({
                          friendId: selectedUserId,
                          roomId,
                          callerName: profile?.name || user?.email || "Unknown",
                        });
                        toast.success("Calling...");
                      }}
                    >
                      Call
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsg ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-48" />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                      No messages yet. Say hello!
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.senderId === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-xl px-4 py-2 text-sm ${
                              isMine
                                ? "bg-primary text-white rounded-br-sm"
                                : "bg-surface text-text-primary rounded-bl-sm"
                            }`}
                          >
                            <p>{msg.content}</p>
                            <div className={`mt-0.5 flex items-center justify-end gap-1 text-xs ${isMine ? "text-white/70" : "text-text-muted"}`}>
                              <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              {isMine && msg.readAt && (
                                <span className="text-success font-medium text-[10px]">Seen</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="max-w-[70%] rounded-xl rounded-bl-sm bg-surface px-4 py-2 text-sm text-text-secondary">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: "0.1s" }} />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: "0.2s" }} />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-4">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="flex size-10 items-center justify-center rounded-xl text-lg hover:bg-surface transition-colors"
                      aria-label="Emoji picker"
                    >
                      😊
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 z-50 grid grid-cols-6 gap-1 rounded-card border border-border bg-white p-3 shadow-elevated">
                        {["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","😮","😯","😲","😴","🤤","😪","😵","🤯","😎","🥳","😎","👍","👎","👊","✊","🤛","🤜","✌️","🤟","🤘","👌","❤️","💜","💙","💚","💛","🧡","🤍","💔","💯","🔥","✨","🎉","🎊","💪","🫶","🙏","👏","🚀","💀","☠️","👋","🤝","✋"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="flex size-8 items-center justify-center rounded-lg text-lg hover:bg-surface transition-colors"
                            onClick={() => {
                              setMessageText((prev) => prev + emoji);
                              handleTyping();
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button type="submit" disabled={!messageText.trim() || sending}>
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
