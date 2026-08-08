import type { Agent, Attachment, AuthorizationRequest, ConsiliumTask, Message, Topic } from "@consilium/core";

export interface MessagePage {
  messages: Message[];
  hasMoreBefore: boolean;
}
const baseUrl = import.meta.env.VITE_CONSILIUM_API_URL || "/api";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const api = {
  topics: () => request<Topic[]>("/topics"),
  messages: (topicId: string, options: { before?: string; limit?: number } = {}) => {
    const query = new URLSearchParams({ limit: String(options.limit ?? 60) });
    if (options.before) query.set("before", options.before);
    return request<MessagePage>(`/topics/${topicId}/messages?${query}`);
  },
  messagesSince: (topicId: string, since: string) => request<Message[]>(`/topics/${topicId}/messages?since=${encodeURIComponent(since)}`),
  agents: () => request<Agent[]>("/agents"),
  createTopic: (title: string, description = "") => request<Topic>("/topics", { method: "POST", body: JSON.stringify({ title, description }) }),
  addParticipant: (topicId: string, agentId: string) => request<Topic>(`/topics/${topicId}/participants`, {
    method: "POST", body: JSON.stringify({ agentId }),
  }),
  resetTopic: (topicId: string) => request<Topic>(`/topics/${topicId}/reset`, { method: "POST" }),
  deleteTopic: (topicId: string) => request<void>(`/topics/${topicId}`, { method: "DELETE" }),
  sendMessage: (topicId: string, body: string, attachmentIds: string[] = [], replyToId?: string) => request<Message>(`/topics/${topicId}/messages`, {
    method: "POST", body: JSON.stringify({ authorId: "human", authorName: "Vous", authorKind: "human", body, attachmentIds, replyToId }),
  }),
  uploadAttachment: async (topicId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${baseUrl}/topics/${topicId}/attachments`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<Attachment>;
  },
  attachmentUrl: (attachmentId: string, download = false) => `${baseUrl}/attachments/${attachmentId}${download ? "?download=1" : ""}`,
  authorizations: (topicId: string) => request<AuthorizationRequest[]>(`/topics/${topicId}/authorizations`),
  resolveAuthorization: (authorizationId: string, decision: "approved" | "rejected", decisionNote?: string) =>
    request<AuthorizationRequest>(`/authorizations/${authorizationId}/resolve`, {
      method: "POST", body: JSON.stringify({ decision, resolvedBy: "human", decisionNote }),
    }),
  disconnectAgent: (agentId: string) => request<Agent>(`/agents/${agentId}/disconnect`, { method: "POST" }),
  deleteAgent: (agentId: string) => request<void>(`/agents/${agentId}`, { method: "DELETE" }),
  tasks: (topicId: string) => request<ConsiliumTask[]>(`/tasks?topicId=${encodeURIComponent(topicId)}`),
  createTask: (input: { topicId: string; title: string; description: string; assignedAgentId?: string }) =>
    request<ConsiliumTask>("/tasks", { method: "POST", body: JSON.stringify({ ...input, requestedBy: "human" }) }),
  addTaskInstruction: (taskId: string, body: string) => request<ConsiliumTask>(`/tasks/${taskId}/instructions`, {
    method: "POST", body: JSON.stringify({ authorId: "human", authorName: "Vous", body }),
  }),
  resolveApproval: (taskId: string, approvalId: string, decision: "approved" | "rejected", decisionNote?: string) =>
    request<{ task: ConsiliumTask }>(`/tasks/${taskId}/approvals/${approvalId}/resolve`, {
      method: "POST", body: JSON.stringify({ decision, resolvedBy: "human", decisionNote }),
    }),
  cancelTask: (taskId: string) => request<ConsiliumTask>(`/tasks/${taskId}/cancel`, {
    method: "POST", body: JSON.stringify({ requestedBy: "human" }),
  }),
  archiveTask: (taskId: string) => request<ConsiliumTask>(`/tasks/${taskId}/archive`, { method: "POST" }),
  unarchiveTask: (taskId: string) => request<ConsiliumTask>(`/tasks/${taskId}/unarchive`, { method: "POST" }),
  deleteTask: (taskId: string) => request<void>(`/tasks/${taskId}`, { method: "DELETE" }),
};
