import { getTodaysTopic as getConfigTopic, DAILY_TOPICS } from "@speakup/config";

export function getTodaysTopic(): string {
  return getConfigTopic();
}

export function getAllTopics(): string[] {
  return DAILY_TOPICS;
}
