import { post, get } from "./client";

export interface SessionData {
  id: string;
  createdAt: string;
  durationSeconds: number;
  user1Id: string;
  user2Id: string;
  topicUsed?: string;
  user1Rating?: boolean | null;
  user2Rating?: boolean | null;
  roomUrl?: string | null;
  user1?: { id: string; name?: string; country?: string };
  user2?: { id: string; name?: string; country?: string };
}

export interface CreateSessionInput {
  user1Id: string;
  user2Id: string;
  durationSeconds: number;
  topicUsed?: string;
  roomUrl?: string;
}

export function createSession(data: CreateSessionInput) {
  return post<{ session: SessionData }>("/api/sessions", data);
}

export function getSessions(userId: string, limit = 20, offset = 0) {
  return get<{ sessions: SessionData[]; total: number }>(
    `/api/sessions/${userId}?limit=${limit}&offset=${offset}`
  );
}
