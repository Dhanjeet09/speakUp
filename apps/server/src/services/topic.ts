import { getTodaysTopic, DAILY_TOPICS } from "@speakup/config";

let cachedTopic: { date: string; topic: string } | null = null;

export function getDailyTopic(): string {
  const today = new Date().toISOString().split("T")[0];
  if (cachedTopic?.date === today) {
    return cachedTopic.topic;
  }
  const topic = getTodaysTopic(DAILY_TOPICS);
  cachedTopic = { date: today, topic };
  return topic;
}
