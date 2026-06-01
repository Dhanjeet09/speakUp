import { z } from "zod";

const VALID_REASONS = [
  "inappropriate_language",
  "harassment",
  "spam",
  "other",
] as const;

export const createReportSchema = z.object({
  reportedId: z.string().min(1),
  reason: z.enum(VALID_REASONS),
  note: z.string().max(280).optional(),
});

export const blockUserSchema = z.object({
  blockedId: z.string().min(1),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;
