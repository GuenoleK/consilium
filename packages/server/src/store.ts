import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { Agent, ApprovalRequest, Attachment, ConsiliumSnapshot, ConsiliumTask, Message, RiskLevel, TaskStatus, Topic } from "@consilium/core";

const now = () => new Date().toISOString();
const activeAgentStatuses = new Set<Agent["status"]>(["online", "listening", "working"]);
const presenceStaleAfterMs = 20_000;

const initialSnapshot = (): ConsiliumSnapshot => {
  const createdAt = now();
  const topicId = randomUUID();
  return {
    topics: [{
      id: topicId,
      title: "Bienvenue à la table ronde",
      description: "Un espace commun pour cadrer le projet et coordonner les agents.",
      createdAt,
      updatedAt: createdAt,
      messageCount: 1,
      participantIds: ["human"],
    }],
    messages: [{
      id: randomUUID(),
      topicId,
      authorId: "system",
      authorName: "Consilium",
      authorKind: "system",
      body: "La table est ouverte. Connectez un agent puis mentionnez-le pour commencer.",
      mentions: [],
      attachments: [],
      createdAt,
    }],
    agents: [],
    attachments: [],
    tasks: [],
  };
};

export class ConsiliumStore {
  private snapshot: ConsiliumSnapshot = initialSnapshot();
  private loaded = false;
  private readonly filePath: string;
  private readonly mediaDirectory: string;

  constructor(filePath = join(process.env.CONSILIUM_DATA_DIR || join(homedir(), ".consilium"), "consilium.json")) {
    this.filePath = filePath;
    this.mediaDirectory = join(dirname(filePath), "media");
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      this.snapshot = JSON.parse(await readFile(this.filePath, "utf8")) as ConsiliumSnapshot;
      this.snapshot.attachments ??= [];
      this.snapshot.tasks ??= [];
      this.snapshot.messages = this.snapshot.messages.map((message) => ({ ...message, attachments: message.attachments ?? [] }));
      const agentCountBeforeMigration = this.snapshot.agents.length;
      this.snapshot.agents = this.snapshot.agents.filter((agent) => !(
        agent.status === "away"
        && ((agent.id === "codex" && agent.name === "Codex" && agent.model === "OpenAI")
          || (agent.id === "claude" && agent.name === "Claude" && agent.model === "Anthropic"))
      ));
      if (this.snapshot.agents.length !== agentCountBeforeMigration) await this.persist();
    } catch {
      await this.persist();
    }
    this.loaded = true;
  }

  private async persist() {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.snapshot, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }

  async listTopics() {
    await this.ensureLoaded();
    return [...this.snapshot.topics].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getTopic(id: string) {
    await this.ensureLoaded();
    return this.snapshot.topics.find((topic) => topic.id === id);
  }

  async createTopic(input: Pick<Topic, "title" | "description">) {
    await this.ensureLoaded();
    const createdAt = now();
    const topic: Topic = { id: randomUUID(), ...input, createdAt, updatedAt: createdAt, messageCount: 0, participantIds: [] };
    this.snapshot.topics.push(topic);
    await this.persist();
    return topic;
  }

  async resetTopic(id: string) {
    await this.ensureLoaded();
    const topic = this.snapshot.topics.find((candidate) => candidate.id === id);
    if (!topic) return undefined;
    await this.removeTopicAttachments(id);
    this.snapshot.messages = this.snapshot.messages.filter((message) => message.topicId !== id);
    this.snapshot.tasks = this.snapshot.tasks.filter((task) => task.topicId !== id);
    topic.messageCount = 0;
    topic.participantIds = [];
    topic.updatedAt = now();
    await this.persist();
    return topic;
  }

  async deleteTopic(id: string) {
    await this.ensureLoaded();
    const exists = this.snapshot.topics.some((topic) => topic.id === id);
    if (!exists) return false;
    await this.removeTopicAttachments(id);
    this.snapshot.topics = this.snapshot.topics.filter((topic) => topic.id !== id);
    this.snapshot.messages = this.snapshot.messages.filter((message) => message.topicId !== id);
    this.snapshot.tasks = this.snapshot.tasks.filter((task) => task.topicId !== id);
    await this.persist();
    return true;
  }

  async listMessages(topicId: string, since?: string) {
    await this.ensureLoaded();
    return this.snapshot.messages.filter((message) => message.topicId === topicId && (!since || message.createdAt > since));
  }

  async addMessage(input: Omit<Message, "id" | "createdAt" | "mentions">) {
    await this.ensureLoaded();
    const mentions = [...input.body.matchAll(/@([\p{L}\p{N}_-]+)/gu)].map((match) => match[1].toLowerCase());
    const message: Message = { ...input, id: randomUUID(), mentions: [...new Set(mentions)], createdAt: now() };
    const topic = this.snapshot.topics.find((candidate) => candidate.id === input.topicId);
    if (!topic) throw new Error("Topic not found");
    this.snapshot.messages.push(message);
    topic.updatedAt = message.createdAt;
    topic.messageCount += 1;
    topic.participantIds = [...new Set([...topic.participantIds, input.authorId])];
    await this.persist();
    return message;
  }

  async saveAttachment(topicId: string, file: File) {
    await this.ensureLoaded();
    if (!this.snapshot.topics.some((topic) => topic.id === topicId)) throw new Error("Topic not found");
    const id = randomUUID();
    const attachment: Attachment = {
      id, topicId, name: file.name || "media", mediaType: file.type || "application/octet-stream",
      size: file.size, createdAt: now(),
    };
    await mkdir(this.mediaDirectory, { recursive: true });
    await writeFile(join(this.mediaDirectory, id), Buffer.from(await file.arrayBuffer()));
    this.snapshot.attachments.push(attachment);
    await this.persist();
    return attachment;
  }

  async getAttachment(id: string) {
    await this.ensureLoaded();
    const attachment = this.snapshot.attachments.find((candidate) => candidate.id === id);
    if (!attachment) return undefined;
    return { attachment, data: await readFile(join(this.mediaDirectory, id)) };
  }

  async attachToMessage(messageId: string, attachmentIds: string[]) {
    await this.ensureLoaded();
    const message = this.snapshot.messages.find((candidate) => candidate.id === messageId);
    if (!message) throw new Error("Message not found");
    const attachments = this.snapshot.attachments.filter((attachment) => attachmentIds.includes(attachment.id) && attachment.topicId === message.topicId);
    for (const attachment of attachments) attachment.messageId = messageId;
    message.attachments = attachments;
    await this.persist();
    return message;
  }

  private async removeTopicAttachments(topicId: string) {
    const attachments = this.snapshot.attachments.filter((attachment) => attachment.topicId === topicId);
    await Promise.all(attachments.map((attachment) => unlink(join(this.mediaDirectory, attachment.id)).catch(() => undefined)));
    this.snapshot.attachments = this.snapshot.attachments.filter((attachment) => attachment.topicId !== topicId);
  }

  async listAgents() {
    await this.ensureLoaded();
    const currentTime = Date.now();
    return this.snapshot.agents.map((agent) => {
      const isStale = currentTime - new Date(agent.lastSeenAt).getTime() > presenceStaleAfterMs;
      return isStale && activeAgentStatuses.has(agent.status) ? { ...agent, status: "away" as const } : agent;
    });
  }

  async registerAgent(input: Pick<Agent, "id" | "name" | "model" | "status">) {
    await this.ensureLoaded();
    const normalizedInput = { ...input, id: input.id.trim().toLowerCase(), name: input.name.trim() };
    const found = this.snapshot.agents.find((agent) => agent.id === normalizedInput.id);
    const agent: Agent = { ...normalizedInput, lastSeenAt: now() };
    found ? Object.assign(found, { model: agent.model, status: agent.status, lastSeenAt: agent.lastSeenAt }) : this.snapshot.agents.push(agent);
    await this.persist();
    return agent;
  }

  async disconnectAgent(id: string) {
    await this.ensureLoaded();
    const agent = this.snapshot.agents.find((candidate) => candidate.id === id);
    if (!agent) return undefined;
    agent.status = "offline";
    agent.lastSeenAt = now();
    await this.persist();
    return agent;
  }

  async listTasks(filters: { topicId?: string; assignedAgentId?: string; activeOnly?: boolean } = {}) {
    await this.ensureLoaded();
    const terminalStatuses: TaskStatus[] = ["completed", "failed", "cancelled"];
    return this.snapshot.tasks
      .filter((task) => !filters.topicId || task.topicId === filters.topicId)
      .filter((task) => !filters.assignedAgentId || task.assignedAgentId === filters.assignedAgentId)
      .filter((task) => !filters.activeOnly || !terminalStatuses.includes(task.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getTask(id: string) {
    await this.ensureLoaded();
    return this.snapshot.tasks.find((task) => task.id === id);
  }

  async createTask(input: {
    topicId: string; title: string; description: string; requestedBy: string;
    assignedAgentId?: string; clientRequestId?: string;
  }) {
    await this.ensureLoaded();
    if (!this.snapshot.topics.some((topic) => topic.id === input.topicId)) throw new Error("Topic not found");
    if (input.clientRequestId) {
      const existing = this.snapshot.tasks.find((task) => task.clientRequestId === input.clientRequestId);
      if (existing) return existing;
    }
    const createdAt = now();
    const task: ConsiliumTask = {
      id: randomUUID(), ...input, status: "pending", progress: 0, createdAt, updatedAt: createdAt,
      instructions: [], approvals: [],
    };
    this.snapshot.tasks.push(task);
    await this.persist();
    return task;
  }

  async claimTask(id: string, agentId: string, workerId?: string) {
    await this.ensureLoaded();
    const task = this.snapshot.tasks.find((candidate) => candidate.id === id);
    if (!task) return undefined;
    if (!["pending", "waiting_for_input"].includes(task.status)) throw new Error(`Task cannot be claimed from ${task.status}`);
    if (task.assignedAgentId && task.assignedAgentId !== agentId) throw new Error("Task is assigned to another agent");
    task.assignedAgentId = agentId;
    task.workerId = workerId;
    task.status = "claimed";
    task.updatedAt = now();
    await this.persist();
    return task;
  }

  async updateTask(id: string, input: { status?: TaskStatus; progress?: number; result?: string; error?: string; workerId?: string }) {
    await this.ensureLoaded();
    const task = this.snapshot.tasks.find((candidate) => candidate.id === id);
    if (!task) return undefined;
    if (input.status) task.status = input.status;
    if (input.progress !== undefined) task.progress = Math.max(0, Math.min(100, input.progress));
    if (input.result !== undefined) task.result = input.result;
    if (input.error !== undefined) task.error = input.error;
    if (input.workerId !== undefined) task.workerId = input.workerId;
    task.updatedAt = now();
    await this.persist();
    return task;
  }

  async addTaskInstruction(id: string, input: { authorId: string; authorName: string; body: string }) {
    await this.ensureLoaded();
    const task = this.snapshot.tasks.find((candidate) => candidate.id === id);
    if (!task) return undefined;
    task.instructions.push({ id: randomUUID(), taskId: id, ...input, createdAt: now() });
    if (task.status === "waiting_for_input") task.status = "pending";
    task.updatedAt = now();
    await this.persist();
    return task;
  }

  async requestApproval(id: string, input: { requestedBy: string; action: string; details: string; riskLevel: RiskLevel }) {
    await this.ensureLoaded();
    const task = this.snapshot.tasks.find((candidate) => candidate.id === id);
    if (!task) return undefined;
    const approval: ApprovalRequest = {
      id: randomUUID(), taskId: id, ...input, status: "pending", createdAt: now(),
    };
    task.approvals.push(approval);
    task.status = "awaiting_approval";
    task.updatedAt = approval.createdAt;
    await this.persist();
    return { task, approval };
  }

  async resolveApproval(taskId: string, approvalId: string, input: { decision: "approved" | "rejected"; resolvedBy: string; decisionNote?: string }) {
    await this.ensureLoaded();
    const task = this.snapshot.tasks.find((candidate) => candidate.id === taskId);
    const approval = task?.approvals.find((candidate) => candidate.id === approvalId);
    if (!task || !approval) return undefined;
    if (approval.status !== "pending") throw new Error("Approval has already been resolved");
    approval.status = input.decision;
    approval.resolvedAt = now();
    approval.resolvedBy = input.resolvedBy;
    approval.decisionNote = input.decisionNote;
    task.status = input.decision === "approved" ? "pending" : "waiting_for_input";
    task.updatedAt = approval.resolvedAt;
    await this.persist();
    return { task, approval };
  }

  async cancelTask(id: string, requestedBy: string) {
    const task = await this.updateTask(id, { status: "cancelled", error: `Cancelled by ${requestedBy}` });
    return task;
  }
}
