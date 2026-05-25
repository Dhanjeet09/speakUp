import { z } from "zod";

export const createSessionSchema = z.object({
  user1Id: z.string().min(1),
  user2Id: z.string().min(1),
  durationSeconds: z.number().int().min(0).max(86400),
  topicUsed: z.string().max(500).optional(),
  roomUrl: z.string().max(500).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
