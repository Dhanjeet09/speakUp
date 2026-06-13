import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@speakup/types";
import { getSupabase } from "./supabase";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let currentUserId: string | null = null;

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Failed reading session:", error.message);
    }

    if (data.session?.access_token) {
      return data.session.access_token;
    }

    const refresh = await supabase.auth.refreshSession();

    if (refresh.error) {
      console.error("Token refresh failed:", refresh.error.message);

      return null;
    }

    return refresh.data.session?.access_token ?? null;
  } catch (err) {
    console.error("Auth token error:", err);

    return null;
  }
}

export function getSocket(): TypedSocket {
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ["polling", "websocket"],

    autoConnect: false,

    reconnection: true,

    reconnectionAttempts: Infinity,

    reconnectionDelay: 1000,

    reconnectionDelayMax: 5000,

    timeout: 10000,

    auth: async (callback) => {
      const token = await getAccessToken();

      callback({
        userId: currentUserId,

        token,
      });
    },
  }) as TypedSocket;

  socket.on("connect", () => {
    console.log("Socket connected", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.warn("Socket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket auth/connect error:", error.message);
  });

  return socket;
}

export async function connectSocket(userId: string): Promise<TypedSocket | null> {
  currentUserId = userId;

  const s = getSocket();

  if (s.connected) {
    return s;
  }

  s.connect();

  return s;
}

export function disconnectSocket() {
  if (!socket) {
    return;
  }

  socket.disconnect();

  socket = null;

  currentUserId = null;
}

function emitSafe<E extends keyof ClientToServerEvents>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0]
) {
  if (!socket?.connected) {
    console.warn(`Cannot emit ${String(event)}. Socket disconnected`);

    return false;
  }

  socket.emit(event, payload);

  return true;
}

export function emitTypingStart(data: { receiverId: string }) {
  return emitSafe("typing:start", data);
}

export function emitTypingStop(data: { receiverId: string }) {
  return emitSafe("typing:stop", data);
}

export function emitFriendCall(data: { friendId: string; roomId: string; callerName?: string }) {
  return emitSafe("friend:call", data);
}
