import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@speakup/types";
import { getSupabase } from "./supabase";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let currentUserId: string | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    }) as TypedSocket;
  }
  return socket;
}

export async function connectSocket(userId: string): Promise<TypedSocket> {
  const s = getSocket();

  if (currentUserId === userId && s.connected) {
    return s;
  }

  let token: string | null = null;
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch {
  }

  currentUserId = userId;
  if (s.connected) {
    s.disconnect();
  }
  s.auth = { userId, token };
  s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    if (socket.connected) socket.disconnect();
    currentUserId = null;
  }
}

export function emitTypingStart(data: { receiverId: string }) {
  getSocket().emit("typing:start", data);
}

export function emitTypingStop(data: { receiverId: string }) {
  getSocket().emit("typing:stop", data);
}

export function emitFriendCall(data: { friendId: string; roomId: string; callerName: string }) {
  getSocket().emit("friend:call", data);
}
