import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

let socket: Socket | null = null;
let currentUserId: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function connectSocket(userId: string): Socket {
  if (currentUserId === userId && socket?.connected) return socket;
  currentUserId = userId;
  const s = getSocket();
  if (s.connected) s.disconnect();
  s.auth = { userId };
  s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    if (socket.connected) socket.disconnect();
    currentUserId = null;
  }
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}
