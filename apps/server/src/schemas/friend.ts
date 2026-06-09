import { z } from "zod";

export const sendFriendRequestSchema = z.object({
  addresseeId: z.string().min(1, "Addressee ID is required"),
});

export const friendActionSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type FriendActionInput = z.infer<typeof friendActionSchema>;
