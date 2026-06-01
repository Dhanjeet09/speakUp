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

const VideoCall = dynamic(() => import("@/components/call/VideoCall"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video w-full items-center justify-center rounded-card bg-gray-100 text-gray-400">
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

  const handleEndCallRef = useRef<() => void>(() => {});
  const sessionCreatedRef = useRef(false);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (state === "MATCHED" && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    }
    if (state !== "MATCHED") {
      confettiFiredRef.current = false;
    }
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

    const onQueuePosition = ({ waitingCount: c }: { waitingCount: number }) => {
      setWaitingCount(c);
    };

    const onMatchFound = (data: {
      partner: { name: string; country: string; level: string };
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
      setTimeout(() => setState("IN_CALL"), 2000);
    };

    const onPartnerLeft = () => {
      toast.error("Your partner left the call");
      handleEndCallRef.current();
    };

    socket.on("queuePosition", onQueuePosition);
    socket.on("matchFound", onMatchFound);
    socket.on("partnerLeft", onPartnerLeft);

    return () => {
      socket.off("queuePosition", onQueuePosition);
      socket.off("matchFound", onMatchFound);
      socket.off("partnerLeft", onPartnerLeft);
    };
  }, [state, setPartner, setRoomId, setIsCaller, setWaitingCount, setState]);

  useEffect(() => {
    if (state !== "SEARCHING") return;
    const interval = setInterval(() => {
      setSearchTimer((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  function handleJoinQueue() {
    if (!user || !profile) return;
    const socket = connectSocket(user.id);
    socket.emit("joinQueue", {
      userId: user.id,
      level: profile.englishLevel,
      interests: profile.interests,
    });
    setState("SEARCHING");
    setSearchTimer(0);
    toast.success("Searching for a partner...");
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
    socket.emit("callEnded", { roomId, partnerUserId });

    if (user && partnerUserId && isCaller && !sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      const callDuration = useCallStore.getState().durationSeconds;
      try {
        await createSession({
          user1Id: user.id,
          user2Id: partnerUserId,
          durationSeconds: callDuration,
          topicUsed: topic,
        });
      } catch {
        toast.error("Failed to save session");
      }
    }

    setState("ENDED");
    resetCall();
  }, [user, partnerUserId, roomId, topic, isCaller, setState, resetCall]);
  handleEndCallRef.current = handleEndCall;

  async function handleRating(positive: boolean) {
    if (!user || !partnerUserId || !roomId) {
      toast.success("Thanks for your feedback!");
      setTimeout(() => reset(), 1500);
      return;
    }

    try {
      const { put } = await import("@/lib/api/client");
      await put(`/sessions/${roomId}/rating`, { positive, userId: user.id });
    } catch {
    }

    toast.success("Thanks for your feedback!");
    setTimeout(() => reset(), 1500);
  }

  function handleSkipRating() {
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
                <p className="mt-2 text-gray-600">{topic}</p>
              </CardContent>
            </Card>
            <Button size="lg" onClick={handleJoinQueue}>
              Find a Partner
            </Button>
          </div>
        )}

        {state === "SEARCHING" && (
          <div className="flex flex-col items-center gap-6">
            {searchTimer < 90 ? (
              <>
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <h2 className="text-xl font-semibold">Finding your match...</h2>
                <p className="text-sm text-gray-500">
                  {searchTimer < 30
                    ? "Looking for someone with similar interests..."
                    : searchTimer < 45
                    ? "Expanding search to same level..."
                    : "Searching adjacent levels..."}
                </p>
                <p className="text-lg font-bold text-primary">{searchTimer}s</p>
                <p className="text-sm text-gray-400">
                  {waitingCount} other{waitingCount !== 1 ? "s" : ""} in queue
                </p>
                <Button variant="outline" onClick={handleLeaveQueue}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
                  ⏰
                </div>
                <h2 className="text-xl font-semibold">No partners available right now</h2>
                <p className="max-w-sm text-center text-sm text-gray-500">
                  No one is searching at your level right now. Try expanding your interests or check back later.
                </p>
                <p className="text-lg font-bold text-gray-400">{searchTimer}s</p>
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
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl">
              {partner.country ? getFlagEmoji(partner.country) : "🎉"}
            </div>
            <h2 className="text-xl font-bold">Match found!</h2>
            <p className="text-lg">{partner.name}</p>
            <div className="flex gap-2">
              <Badge>{partner.level}</Badge>
              <Badge variant="outline">{partner.country}</Badge>
            </div>
            <p className="text-sm text-gray-500">Starting call...</p>
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
              <div className="text-sm text-gray-500">{topic}</div>
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
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-xl font-bold">Session ended</h2>
            <p className="text-gray-500">How was your session?</p>
            <div className="flex gap-4">
              <Button
                variant="success"
                onClick={() => handleRating(true)}
                className="px-8"
              >
                Thumbs Up
              </Button>
              <Button
                variant="danger"
                onClick={() => handleRating(false)}
                className="px-8"
              >
                Thumbs Down
              </Button>
            </div>
            <Button variant="ghost" onClick={handleSkipRating}>
              Skip
            </Button>
          </div>
        )}
      </main>
    </>
  );
}

function getFlagEmoji(country: string): string {
  const flags: Record<string, string> = {
    Brazil: "🇧🇷", China: "🇨🇳", Colombia: "🇨🇴", Egypt: "🇪🇬",
    France: "🇫🇷", Germany: "🇩🇪", India: "🇮🇳", Indonesia: "🇮🇩",
    Italy: "🇮🇹", Japan: "🇯🇵", Mexico: "🇲🇽", Morocco: "🇲🇦",
    Philippines: "🇵🇭", Russia: "🇷🇺", "Saudi Arabia": "🇸🇦",
    "South Korea": "🇰🇷", Spain: "🇪🇸", Thailand: "🇹🇭",
    Turkey: "🇹🇷", Ukraine: "🇺🇦", "United Kingdom": "🇬🇧",
    "United States": "🇺🇸", Vietnam: "🇻🇳",
  };
  return flags[country] || "🌍";
}
