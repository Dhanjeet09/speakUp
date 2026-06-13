"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useMatchStore } from "@/store/useMatchStore";
import { useCallStore } from "@/store/useCallStore";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { getTodaysTopic } from "@/lib/topics";
import { createSession } from "@/lib/api/sessions";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { startMicLevelDetection } from "@/lib/webrtc";
import { FLAG_MAP } from "@speakup/config";

const VideoCall = dynamic(() => import("@/components/call/VideoCall"), {
  ssr: false,
      loading: () => (
    <div className="flex aspect-video w-full items-center justify-center rounded-card bg-surface text-text-muted">
      Loading video call...
    </div>
  ),
});

export default function MatchPage() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const {
    state,
    partner,
    roomId,
    topic,
    isCaller,
    waitingCount,
    setState,
    setPartner,
    setRoomId,
    setTopic,
    setIsCaller,
    setWaitingCount,
    reset,
  } = useMatchStore();
  const { reset: resetCall } = useCallStore();
  const [searchTimer, setSearchTimer] = useState(0);
  const [partnerPeerId, setPartnerPeerId] = useState("");
  const [partnerUserId, setPartnerUserId] = useState("");
  const [ratingTimer, setRatingTimer] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const ratingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopMicRef = useRef<(() => void) | null>(null);
  const ratingRef = useRef<HTMLDivElement>(null);

  const handleEndCallRef = useRef<() => void>(() => {});
  const sessionCreatedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const confettiFiredRef = useRef(false);
  const matchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isQueuedRef = useRef(false);

  useEffect(() => {
    if (state === "MATCHED" && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 600);
    }
    if (state !== "MATCHED") {
      confettiFiredRef.current = false;
      setShowFlash(false);
    }
  }, [state]);

  useEffect(() => {
    if (state === "ENDED") {
      setRatingTimer(5);
      ratingIntervalRef.current = setInterval(() => {
        setRatingTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (ratingIntervalRef.current) {
        clearInterval(ratingIntervalRef.current);
        ratingIntervalRef.current = null;
      }
    };
  }, [state]);

  useEffect(() => {
    if (state === "ENDED" && ratingTimer === 0) {
      if (ratingIntervalRef.current) {
        clearInterval(ratingIntervalRef.current);
        ratingIntervalRef.current = null;
      }
      reset();
    }
  }, [state, ratingTimer, reset]);

  useEffect(() => {
    if (state !== "ENDED") return;
    const el = ratingRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>("button");
    if (focusable[0]) focusable[0].focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const container = ratingRef.current;
      if (!container) return;
      const f = container.querySelectorAll<HTMLElement>("button");
      if (f.length === 0) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  useEffect(() => {
    if (state !== "IDLE") {
      if (stopMicRef.current) {
        stopMicRef.current();
        stopMicRef.current = null;
      }
      setMicLevel(0);
      return;
    }
    let cancelled = false;
    async function initMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        stopMicRef.current = startMicLevelDetection(stream, (level) => {
          if (!cancelled) setMicLevel(level);
        });
      } catch {
        setMicLevel(-1);
      }
    }
    initMic();
    return () => {
      cancelled = true;
      if (stopMicRef.current) {
        stopMicRef.current();
        stopMicRef.current = null;
      }
    };
  }, [state]);

  useEffect(() => {
    if (state !== "PERMISSION_CHECK") return;
    let cancelled = false;
    async function checkPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        stream.getTracks().forEach((t) => t.stop());
        proceedToSearch();
      } catch {
        if (!cancelled) setState("IDLE");
      }
    }
    checkPermission();
    return () => { cancelled = true; };
  }, [state]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (profile && !profile.englishLevel) {
      router.push("/onboarding");
      return;
    }
    setTopic(getTodaysTopic());
  }, [user, profile, router, setTopic]);

  useEffect(() => {
    if (state !== "SEARCHING" && state !== "IN_CALL") return;

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    registerMatchListeners(socket);
  }, [state, setPartner, setRoomId, setIsCaller, setWaitingCount, setState]);

  useEffect(() => {
    return () => {
      if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
      if (isQueuedRef.current) {
        const socket = getSocket();
        if (socket.connected) socket.emit("leaveQueue");
      }
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (state !== "SEARCHING") return;
    const interval = setInterval(() => {
      setSearchTimer((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    if (state !== "IN_CALL") return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      handleEndCallRef.current();
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  function registerMatchListeners(socket: ReturnType<typeof getSocket>) {
    socket.off("queuePosition");
    socket.off("matchFound");
    socket.off("partnerLeft");
    socket.off("match:accepted");
    socket.off("match:rejected");
    socket.off("error");

    socket.on("queuePosition", ({ waitingCount: c }: { waitingCount: number }) => {
      setWaitingCount(c);
    });

    socket.on("matchFound", (data: {
      partner: { name: string; country: string; level: string; username: string };
      roomId: string;
      isCaller: boolean;
      partnerUserId: string;
    }) => {
      sessionCreatedRef.current = false;
      setPartner(data.partner);
      setRoomId(data.roomId);
      setIsCaller(data.isCaller);
      setPartnerUserId(data.partnerUserId);
      setPartnerPeerId(data.partnerUserId);
      setState("MATCHED");
      toast.success("Match found!");
      if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = setTimeout(() => setState("IN_CALL"), 2000);
    });

    socket.on("partnerLeft", () => {
      toast.error("Your partner left the call");
      handleEndCallRef.current();
    });

    socket.on("match:accepted", () => {
      toast.success("Match request accepted!");
    });

    socket.on("match:rejected", () => {
      toast("Match request declined", { icon: "💬" });
      setState("IDLE");
    });

    socket.on("error", (payload: { message: string }) => {
      toast.error(payload.message);
      setState("IDLE");
    });
  }

  function handleJoinQueue() {
    if (!user || !profile) return;
    setState("PERMISSION_CHECK");
  }

  function proceedToSearch() {
    if (!user || !profile) return;
    connectSocket(user.id).then((socket) => {
      if (!socket) {
        toast.error("Could not connect. Please try again.");
        return;
      }
      registerMatchListeners(socket);
      isQueuedRef.current = true;
      socket.emit("joinQueue", {
        userId: user.id,
        level: profile.englishLevel ?? "",
        interests: profile.interests,
      });
      setState("SEARCHING");
      setSearchTimer(0);
      toast.success("Searching for a partner...");
    }).catch(() => {
      toast.error("Connection failed. Please try again.");
    });
  }

  function handleLeaveQueue() {
    const socket = getSocket();
    socket.emit("leaveQueue");
    disconnectSocket();
    reset();
    toast("Left the queue", { icon: "👋" });
  }

  const handleEndCall = useCallback(async () => {
    const socket = getSocket();
    socket.emit("callEnded", { roomId: roomId ?? undefined, partnerUserId: partnerUserId ?? undefined });

    if (user && partnerUserId && isCaller && !sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      const callDuration = useCallStore.getState().durationSeconds;
      if (callDuration < 5) {
        sessionCreatedRef.current = false;
      } else {
        try {
          const result = await createSession({
            user1Id: user.id,
            user2Id: partnerUserId,
            durationSeconds: callDuration,
            topicUsed: topic,
            roomUrl: roomId || undefined,
          });
          if (result?.session?.id) {
            sessionIdRef.current = result.session.id;
          }
        } catch {
          toast.error("Failed to save session");
        }
      }
    }

    setState("ENDED");
    resetCall();
  }, [user, partnerUserId, roomId, topic, isCaller, setState, resetCall]);
  handleEndCallRef.current = handleEndCall;

  async function handleRating(positive: boolean) {
    let sessionId = sessionIdRef.current;

    if (!sessionId) {
      try {
        const { get } = await import("@/lib/api/client");
        const sessions = await get<{ sessions: Array<{ id: string }> }>(
          `/api/sessions?user1Id=${user?.id}&user2Id=${partnerUserId}`
        );
        if (sessions?.sessions?.length > 0) {
          sessionId = sessions.sessions[0].id;
          sessionIdRef.current = sessionId;
        }
      } catch {
      }
    }

    if (!user || !partnerUserId || !sessionId) {
      toast.success("Thanks for your feedback!");
      setTimeout(() => reset(), 1500);
      return;
    }

    try {
      const { patch } = await import("@/lib/api/client");
      await patch(`/api/sessions/${sessionId}/rate`, { positive });
    } catch {
      toast.error("Could not save rating");
    }

    toast.success("Thanks for your feedback!");
    setTimeout(() => reset(), 1500);
  }

  function handleSkipRating() {
    if (ratingIntervalRef.current) {
      clearInterval(ratingIntervalRef.current);
      ratingIntervalRef.current = null;
    }
    reset();
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col items-center justify-center px-4 py-8">
        {state === "IDLE" && (
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-bold">Ready to practice?</h1>
            <Card className="w-full max-w-md">
              <CardContent className="pt-6 text-center">
                <h2 className="font-semibold">Today&apos;s Topic</h2>
                <p className="mt-2 text-text-secondary">{topic}</p>
              </CardContent>
            </Card>
            {micLevel >= 0 && (
              <div className="w-full max-w-md">
                <p className="mb-1 text-xs text-text-secondary">Mic level</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-100"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            )}
            <Button size="lg" onClick={handleJoinQueue} className="animate-pulse">
              Find a Partner
            </Button>
          </div>
        )}

        {state === "PERMISSION_CHECK" && (
          <div className="flex flex-col items-center gap-6">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <h2 className="text-xl font-semibold">Checking permissions...</h2>
            <p className="text-sm text-text-secondary">
              Please allow camera and microphone access when prompted by your browser.
            </p>
            <p className="text-xs text-text-muted">
              {typeof navigator !== "undefined" &&
              /Chrome/i.test(navigator.userAgent)
                ? 'Click "Allow" in the pop-up near the address bar.'
                : typeof navigator !== "undefined" &&
                  /Firefox/i.test(navigator.userAgent)
                ? 'Click "Allow" in the pop-up near the address bar.'
                : typeof navigator !== "undefined" &&
                  /Safari/i.test(navigator.userAgent)
                ? 'Click "Allow" in the pop-up at the top of the page.'
                : "Camera and microphone access is required for video calls."}
            </p>
            <Button variant="outline" onClick={() => setState("IDLE")}>
              Cancel
            </Button>
          </div>
        )}

        {state === "SEARCHING" && (
          <div className="flex flex-col items-center gap-6">
            {searchTimer < 90 ? (
              <>
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <h2 className="text-xl font-semibold">Finding your match...</h2>
                <p className="text-sm text-text-secondary">
                  {searchTimer < 30
                    ? "Looking for someone with similar interests..."
                    : searchTimer < 45
                    ? "Expanding search to same level..."
                    : "Searching adjacent levels..."}
                </p>
                <p className="text-lg font-bold text-primary">{searchTimer}s</p>
                <p className="text-sm text-text-muted">
                  {waitingCount} other{waitingCount !== 1 ? "s" : ""} in queue
                </p>
                <Button variant="outline" onClick={handleLeaveQueue}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-2xl">
                  ⏰
                </div>
                <h2 className="text-xl font-semibold">No partners available right now</h2>
                <p className="max-w-sm text-center text-sm text-text-secondary">
                  No one is searching at your level right now. Try expanding your interests or check back later.
                </p>
                <p className="text-lg font-bold text-text-muted">{searchTimer}s</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleLeaveQueue}>
                    Cancel
                  </Button>
                  <Button onClick={handleJoinQueue}>
                    Try Again
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {state === "MATCHED" && partner && (
          <div className="relative flex flex-col items-center gap-4" aria-live="polite">
            {showFlash && (
              <div className="absolute inset-0 z-10 animate-pulse rounded-full bg-green-500/20" />
            )}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl">
              {partner.country ? getFlagEmoji(partner.country) : "🎉"}
            </div>
            <h2 className="text-xl font-bold">Match found!</h2>
            <p className="text-lg">{partner.name}</p>
            {partner.username && (
              <p className="text-sm text-text-secondary">@{partner.username}</p>
            )}
            <div className="flex gap-2">
              <Badge>{partner.level}</Badge>
              <Badge variant="outline">{partner.country}</Badge>
            </div>
            <p className="text-sm text-text-secondary">Starting call...</p>
          </div>
        )}

        {state === "IN_CALL" && roomId && partner && (
          <div className="w-full">
            <div className="mb-4 flex items-center justify-between rounded-card bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{partner.name}</span>
                {partner.country && (
                  <span>{getFlagEmoji(partner.country)}</span>
                )}
                <Badge variant="outline">{partner.level}</Badge>
              </div>
              <div className="text-sm text-text-secondary">{topic}</div>
            </div>

            <VideoCall
              partnerPeerId={partnerPeerId}
              partnerUserId={partnerUserId}
              partnerName={partner?.name || "Partner"}
              isCaller={isCaller}
              onEndCall={handleEndCall}
            />
          </div>
        )}

        {state === "ENDED" && (
          <div ref={ratingRef} className="flex flex-col items-center gap-6" aria-live="polite">
            <h2 className="text-xl font-bold">Session ended</h2>
            <p className="text-text-secondary">How was your session?</p>
            <div className="flex gap-4">
              <Button
                variant="success"
                onClick={() => handleRating(true)}
                className="px-8 transition-transform hover:scale-110"
              >
                Thumbs Up
              </Button>
              <Button
                variant="danger"
                onClick={() => handleRating(false)}
                className="px-8 transition-transform hover:scale-110"
              >
                Thumbs Down
              </Button>
            </div>
            <Button variant="ghost" onClick={handleSkipRating}>
              {ratingTimer > 0 ? `Skip (${ratingTimer}s)` : "Skip"}
            </Button>
          </div>
        )}
      </main>
    </>
  );
}

function getFlagEmoji(country: string): string {
  return (FLAG_MAP as Record<string, string>)[country] || "🌍";
}
