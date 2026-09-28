import { messageSchema, taskSchema } from "@consilium/core";
import { z } from "zod";

export const waitForMessagesOutputSchema = z.object({
  timedOut: z.boolean(),
  disconnected: z.boolean(),
  reason: z.enum(["offline", "replaced"]).optional()
    .describe("Why disconnected is true: offline (disconnected on purpose) or replaced (another live session took this agent id). Stop in both cases; an MCP restart alone never disconnects."),
  cursor: z.string(),
  cursors: z.record(z.string(), z.string()).optional(),
  topicId: z.string().optional(),
  messages: z.array(messageSchema),
  tasks: z.array(taskSchema).optional(),
  omitted: z.number().int().positive().optional()
    .describe("Older unread messages left out to bound the result; mentions are never omitted. Page them with list_messages only if needed."),
  serverUnavailable: z.boolean().optional()
    .describe("The Consilium server stayed unreachable until the deadline; cursors were kept, call again."),
});
