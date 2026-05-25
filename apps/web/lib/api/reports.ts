import { post } from "./client";

export function reportUser(reportedId: string, reason: string, note?: string) {
  return post("/api/reports", { reportedId, reason, note });
}

export function blockUser(blockedId: string) {
  return post("/api/reports/block", { blockedId });
}
