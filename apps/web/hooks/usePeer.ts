"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Peer from "peerjs";
import { useAuthStore } from "@/store/useAuthStore";

const ICE_SERVERS = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
};

export function usePeer() {
  const { user } = useAuthStore();
  const peerRef = useRef<Peer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    const p = new Peer(`${user.id}-${Date.now()}`, ICE_SERVERS);
    peerRef.current = p;

    p.on("open", () => setIsReady(true));
    p.on("error", () => setIsReady(false));

    return () => {
      p.destroy();
      peerRef.current = null;
      setIsReady(false);
    };
  }, [user]);

  const getPeer = useCallback(() => peerRef.current, []);

  return { getPeer, isReady };
}
