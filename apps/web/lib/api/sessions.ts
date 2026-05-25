import { post, get } from "./client";

export interface CreateSessionInput {
  user1Id: string;
  user2Id: string;
  durationSeconds: number;
  topicUsed?: string;
  roomUrl?: string;
}

export function createSession(data: CreateSessionInput) {
  return post<{ session: unknown }>("/api/sessions", data);
}

export function getSessions(userId: string, limit = 20, offset = 0) {
  return get<{ sessions: unknown[] }>(
    `/api/sessions/${userId}?limit=${limit}&offset=${offset}`
  );
}
