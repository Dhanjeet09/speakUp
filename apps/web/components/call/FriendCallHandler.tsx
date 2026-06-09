"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { getSocket, connectSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

interface IncomingCall {
  callerId: string;
  callerName: string;
  roomId: string;
}

export default function FriendCallHandler() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { user } = useAuthStore();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const answeredRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    connectSocket(user.id).catch(console.error);
    const socket = getSocket();

    const onCalling = (payload: { callerId: string; callerName: string; roomId: string }) => {
      if (payload.callerId === user.id) return;
      setIncoming(payload);
      answeredRef.current = false;
      toast(`${payload.callerName} is calling...`, { duration: 15000 });
    };

    const onCallAnswer = (payload: { callerId: string; accepted: boolean }) => {
      if (payload.accepted) {
        toast.success("Call accepted!");
        const roomId = `call_${[user.id, payload.callerId].sort().join("_")}`;
        routerRef.current.push(`/match?room=${roomId}&partner=${payload.callerId}`);
      } else {
        toast.error("Call declined", { id: "call-declined" });
      }
    };

    socket.on("friend:calling", onCalling);
    socket.on("friend:call-answer", onCallAnswer);

    return () => {
      socket.off("friend:calling", onCalling);
      socket.off("friend:call-answer", onCallAnswer);
    };
  }, [user?.id]);

  function handleAcceptCall() {
    if (!incoming || answeredRef.current) return;
    answeredRef.current = true;
    const socket = getSocket();
    socket.emit("friend:call-answer", { callerId: incoming.callerId, accepted: true });
    setIncoming(null);
    router.push(`/match?room=${incoming.roomId}&partner=${incoming.callerId}`);
  }

  function handleDeclineCall() {
    if (!incoming || answeredRef.current) return;
    answeredRef.current = true;
    const socket = getSocket();
    socket.emit("friend:call-answer", { callerId: incoming.callerId, accepted: false });
    setIncoming(null);
  }

  if (!incoming) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-card bg-white p-6 shadow-xl text-center space-y-4 min-w-[280px]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {incoming.callerName[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <p className="text-lg font-semibold">{incoming.callerName}</p>
          <p className="text-sm text-gray-500">Incoming call...</p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button variant="default" className="px-8" onClick={handleAcceptCall}>
            Accept
          </Button>
          <Button variant="outline" className="px-8" onClick={handleDeclineCall}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
