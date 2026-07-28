import { z } from "zod";

export const participantKindSchema = z.enum(["human", "agent", "system"]);
export const agentStatusSchema = z.enum(["online", "listening", "working", "away", "offline"]);
export const taskStatusSchema = z.enum(["pending", "claimed", "running", "awaiting_approval", "waiting_for_input", "completed", "failed", "cancelled"]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const authorizationStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const riskLevelSchema = z.enum(["free", "confirmation", "restricted"]);

export const attachmentSchema = z.object({
  id: z.string(),
  messageId: z.string().optional(),
  topicId: z.string(),
  name: z.string(),
  mediaType: z.string(),
  size: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export const topicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number().int().nonnegative(),
  participantIds: z.array(z.string()),
});

export const messageSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorKind: participantKindSchema,
  body: z.string(),
  mentions: z.array(z.string()),
  attachments: z.array(attachmentSchema),
  createdAt: z.string(),
});

export const agentSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.string().optional(),
  status: agentStatusSchema,
  lastSeenAt: z.string(),
});

export const taskInstructionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const approvalRequestSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  requestedBy: z.string(),
  action: z.string(),
  details: z.string(),
  riskLevel: riskLevelSchema,
  status: approvalStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
  decisionNote: z.string().optional(),
});

export const authorizationRequestSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  kind: z.string().min(1).max(80),
  action: z.string(),
  details: z.string(),
  requestedBy: z.string(),
  requestedByName: z.string(),
  status: authorizationStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
  decisionNote: z.string().optional(),
  consumedAt: z.string().optional(),
});

export const taskSchema = z.object({
  id: z.string(),
  clientRequestId: z.string().optional(),
  topicId: z.string(),
  title: z.string(),
  description: z.string(),
  requestedBy: z.string(),
  assignedAgentId: z.string().optional(),
  workerId: z.string().optional(),
  status: taskStatusSchema,
  progress: z.number().int().min(0).max(100),
  result: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  instructions: z.array(taskInstructionSchema),
  approvals: z.array(approvalRequestSchema),
});

export type Topic = z.infer<typeof topicSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type ConsiliumTask = z.infer<typeof taskSchema>;
export type TaskInstruction = z.infer<typeof taskInstructionSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type AuthorizationRequest = z.infer<typeof authorizationRequestSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export interface ConsiliumSnapshot {
  topics: Topic[];
  messages: Message[];
  agents: Agent[];
  attachments: Attachment[];
  tasks: ConsiliumTask[];
  authorizations: AuthorizationRequest[];
}
