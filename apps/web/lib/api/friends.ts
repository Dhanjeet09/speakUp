import { get, post, del } from "./client";

export interface FriendUser {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  englishLevel: string | null;
  country: string | null;
}

export interface FriendData {
  id: string;
  friendId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  englishLevel: string | null;
  country: string | null;
  status: string;
  createdAt: string;
}

export interface FriendRequestData {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  createdAt: string;
  requester?: FriendUser;
  addressee?: FriendUser;
}

const BASE = "/api/friends";

export function getFriends() {
  return get<{ friends: FriendData[] }>(BASE);
}

export function getFriendRequests() {
  return get<{ requests: FriendRequestData[] }>(`${BASE}/requests`);
}

export function getSentRequests() {
  return get<{ requests: FriendRequestData[] }>(`${BASE}/requests/sent`);
}

export function sendFriendRequest(addresseeId: string) {
  return post<{ request: FriendRequestData }>(`${BASE}/requests`, { addresseeId });
}

export function acceptFriendRequest(id: string) {
  return post<{ request: FriendRequestData }>(`${BASE}/requests/${id}/accept`);
}

export function rejectFriendRequest(id: string) {
  return post<{ request: FriendRequestData }>(`${BASE}/requests/${id}/reject`);
}

export function removeFriend(friendId: string) {
  return del<void>(`${BASE}/${friendId}`);
}

export function searchUsers(q: string) {
  return get<{ users: FriendUser[] }>(`/api/users/search?q=${encodeURIComponent(q)}`);
}
