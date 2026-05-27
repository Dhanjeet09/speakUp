"use client";

import { useEffect, useRef } from "react";
import { getSocket, connectSocket, disconnectSocket } from "@/lib/socket";
import type { ServerToClientEvents, ClientToServerEvents } from "@speakup/types";

export function useSocket(userId?: string | null) {
  const socketRef = useRef(getSocket());

  useEffect(() => {
    if (!userId) return;
    const socket = connectSocket(userId);
    socketRef.current = socket;
    return () => {
      disconnectSocket();
    };
  }, [userId]);

  function on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ) {
    const socket = socketRef.current;
    socket.on(event as string, handler as (...args: unknown[]) => void);
    return () => {
      socket.off(event as string, handler as (...args: unknown[]) => void);
    };
  }

  function emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) {
    socketRef.current.emit(event as string, ...args);
  }

  return { socket: socketRef.current, on, emit };
}
