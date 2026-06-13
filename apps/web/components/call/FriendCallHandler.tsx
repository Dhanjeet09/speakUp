"use client";

import { useEffect, useState, useRef } from "react";
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
  const incomingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearIncomingTimeout() {
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    if (!user) return;
    connectSocket(user.id).catch(() => {});
    const socket = getSocket();

    const onCalling = (payload: { callerId: string; callerName: string; roomId: string }) => {
      if (payload.callerId === user.id) return;
      setIncoming(payload);
      answeredRef.current = false;
      toast(`${payload.callerName} is calling...`, { duration: 15000 });

      clearIncomingTimeout();
      incomingTimeoutRef.current = setTimeout(() => {
        if (!answeredRef.current) {
          answeredRef.current = true;
          const socket = getSocket();
          socket.emit("friend:call-answer", { callerId: payload.callerId, accepted: false, roomId: payload.roomId });
          setIncoming(null);
          toast.error("Call timed out", { id: "call-timed-out" });
        }
      }, 30000);
    };

    const onCallAnswer = (payload: { callerId: string; accepted: boolean; roomId?: string; answererId?: string }) => {
      clearIncomingTimeout();
      if (payload.accepted) {
        toast.success("Call accepted!");
        const roomId = payload.roomId || `call_${[user.id, payload.callerId].sort().join("_")}`;
        const partnerId = payload.answererId || payload.callerId;
        routerRef.current.push(`/match?room=${roomId}&partner=${partnerId}`);
      } else {
        toast.error("Call declined", { id: "call-declined" });
      }
    };

    socket.on("friend:calling", onCalling);
    socket.on("friend:call-answer", onCallAnswer);

    return () => {
      clearIncomingTimeout();
      socket.off("friend:calling", onCalling);
      socket.off("friend:call-answer", onCallAnswer);
    };
  }, [user?.id]);

  function handleAcceptCall() {
    if (!incoming || answeredRef.current) return;
    clearIncomingTimeout();
    answeredRef.current = true;
    const socket = getSocket();
    socket.emit("friend:call-answer", { callerId: incoming.callerId, accepted: true, roomId: incoming.roomId, answererId: user?.id });
    setIncoming(null);
    router.push(`/match?room=${incoming.roomId}&partner=${incoming.callerId}`);
  }

  function handleDeclineCall() {
    if (!incoming || answeredRef.current) return;
    clearIncomingTimeout();
    answeredRef.current = true;
    const socket = getSocket();
    socket.emit("friend:call-answer", { callerId: incoming.callerId, accepted: false, roomId: incoming.roomId });
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
