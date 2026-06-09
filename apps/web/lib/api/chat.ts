import { get, post, patch } from "./client";

export interface ConversationData {
  userId: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
}

export function getConversations() {
  return get<{ conversations: ConversationData[] }>("/api/messages/conversations");
}

export function getMessages(userId: string, limit = 50, offset = 0) {
  return get<{ messages: MessageData[] }>(
    `/api/messages/${userId}?limit=${limit}&offset=${offset}`
  );
}

export function sendMessage(data: { receiverId: string; content: string }) {
  return post<{ message: MessageData }>("/api/messages", data);
}

export function markMessagesAsRead(userId: string) {
  return patch<{ updatedCount: number }>(`/api/messages/read/${userId}`);
}
