import { z } from "zod";

const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  country: z.string().max(100).optional(),
  englishLevel: z.enum(VALID_LEVELS).optional(),
  interests: z.array(z.string().min(1)).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
