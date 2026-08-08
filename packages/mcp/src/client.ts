import type { Agent, Attachment, AuthorizationRequest, ConsiliumTask, Message, RiskLevel, TaskStatus, Topic } from "@consilium/core";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export class ConsiliumClient {
  constructor(private readonly baseUrl = process.env.CONSILIUM_API_URL || "http://127.0.0.1:4337") {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
    if (!response.ok) throw new Error(`Consilium API: ${response.status} ${await response.text()}`);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  listTopics() { return this.request<Topic[]>("/api/topics"); }
  getTopic(id: string) { return this.request<Topic>(`/api/topics/${id}`); }
  createTopic(title: string, description: string) {
    return this.request<Topic>("/api/topics", { method: "POST", body: JSON.stringify({ title, description }) });
  }
  resetTopic(topicId: string) {
    return this.request<Topic>(`/api/topics/${topicId}/reset`, { method: "POST" });
  }
  async deleteTopic(topicId: string) {
    await this.request<void>(`/api/topics/${topicId}`, { method: "DELETE" });
  }
  listMessages(topicId: string, since?: string) {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.request<Message[]>(`/api/topics/${topicId}/messages${query}`);
  }
  postMessage(topicId: string, body: string, agentId: string, agentName: string, attachmentIds: string[] = [], replyToId?: string) {
    return this.request<Message>(`/api/topics/${topicId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body, authorId: agentId, authorName: agentName, authorKind: "agent", attachmentIds, replyToId }),
    });
  }
  async uploadAttachment(topicId: string, filePath: string, mediaType?: string) {
    const data = await readFile(filePath);
    if (data.byteLength > 25 * 1024 * 1024) throw new Error("File exceeds 25 MB");
    const form = new FormData();
    form.set("file", new File([data], basename(filePath), { type: mediaType || "application/octet-stream" }));
    const response = await fetch(`${this.baseUrl}/api/topics/${topicId}/attachments`, { method: "POST", body: form });
    if (!response.ok) throw new Error(`Consilium API: ${response.status} ${await response.text()}`);
    return response.json() as Promise<Attachment>;
  }
  requestAuthorization(topicId: string, input: Pick<AuthorizationRequest, "kind" | "action" | "details" | "requestedBy" | "requestedByName">) {
    return this.request<AuthorizationRequest>(`/api/topics/${topicId}/authorizations`, { method: "POST", body: JSON.stringify(input) });
  }
  getAuthorization(id: string) { return this.request<AuthorizationRequest>(`/api/authorizations/${id}`); }
  consumeAuthorization(id: string, input: { topicId: string; requestedBy: string; kind: string }) {
    return this.request<AuthorizationRequest>(`/api/authorizations/${id}/consume`, { method: "POST", body: JSON.stringify(input) });
  }
  listAgents() { return this.request<Agent[]>("/api/agents"); }
  registerAgent(input: { id: string; name: string; model?: string; sessionId?: string; claimSession?: boolean; status: Agent["status"]; activeTopicId?: string; activeTopicTitle?: string }) {
    return this.request<Agent>("/api/agents", { method: "POST", body: JSON.stringify(input) });
  }
  disconnectAgent(id: string, sessionId?: string) {
    return this.request<Agent>(`/api/agents/${id}/disconnect`, {
      method: "POST",
      body: sessionId ? JSON.stringify({ sessionId }) : undefined,
    });
  }
  listTasks(filters: { topicId?: string; assignedAgentId?: string; activeOnly?: boolean } = {}) {
    const query = new URLSearchParams();
    if (filters.topicId) query.set("topicId", filters.topicId);
    if (filters.assignedAgentId) query.set("assignedAgentId", filters.assignedAgentId);
    if (filters.activeOnly) query.set("activeOnly", "true");
    return this.request<ConsiliumTask[]>(`/api/tasks${query.size ? `?${query}` : ""}`);
  }
  getTask(id: string) { return this.request<ConsiliumTask>(`/api/tasks/${id}`); }
  createTask(input: { topicId: string; title: string; description: string; requestedBy: string; assignedAgentId?: string; clientRequestId?: string }) {
    return this.request<ConsiliumTask>("/api/tasks", { method: "POST", body: JSON.stringify(input) });
  }
  claimTask(id: string, agentId: string, workerId?: string) {
    return this.request<ConsiliumTask>(`/api/tasks/${id}/claim`, { method: "POST", body: JSON.stringify({ agentId, workerId }) });
  }
  updateTask(id: string, input: { status?: TaskStatus; progress?: number; result?: string; error?: string; workerId?: string }) {
    return this.request<ConsiliumTask>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }
  addTaskInstruction(id: string, input: { authorId: string; authorName: string; body: string }) {
    return this.request<ConsiliumTask>(`/api/tasks/${id}/instructions`, { method: "POST", body: JSON.stringify(input) });
  }
  requestApproval(id: string, input: { requestedBy: string; action: string; details: string; riskLevel: RiskLevel }) {
    return this.request<{ task: ConsiliumTask }>(`/api/tasks/${id}/approvals`, { method: "POST", body: JSON.stringify(input) });
  }
  resolveApproval(taskId: string, approvalId: string, input: { decision: "approved" | "rejected"; resolvedBy: string; decisionNote?: string }) {
    return this.request<{ task: ConsiliumTask }>(`/api/tasks/${taskId}/approvals/${approvalId}/resolve`, { method: "POST", body: JSON.stringify(input) });
  }
  cancelTask(id: string, requestedBy: string) {
    return this.request<ConsiliumTask>(`/api/tasks/${id}/cancel`, { method: "POST", body: JSON.stringify({ requestedBy }) });
  }
  async getAttachment(id: string): Promise<{ attachment: Attachment; base64: string }> {
    const response = await fetch(`${this.baseUrl}/api/attachments/${id}`);
    if (!response.ok) throw new Error(`Consilium API: ${response.status} ${await response.text()}`);
    const contentDisposition = response.headers.get("content-disposition") || "";
    const encodedName = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
    const data = Buffer.from(await response.arrayBuffer());
    return {
      attachment: {
        id, topicId: "", name: encodedName ? decodeURIComponent(encodedName) : id,
        mediaType: response.headers.get("content-type") || "application/octet-stream",
        size: data.length, createdAt: "",
      },
      base64: data.toString("base64"),
    };
  }
}
