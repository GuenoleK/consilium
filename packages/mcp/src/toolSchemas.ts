import { messageSchema, taskSchema } from "@consilium/core";
import { z } from "zod";

export const waitForMessagesOutputSchema = z.object({
  timedOut: z.boolean(),
  disconnected: z.boolean(),
  cursor: z.string(),
  cursors: z.record(z.string(), z.string()).optional(),
  topicId: z.string().optional(),
  messages: z.array(messageSchema),
  tasks: z.array(taskSchema).optional(),
});
