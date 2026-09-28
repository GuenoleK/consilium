#!/usr/bin/env node
/**
 * consilium-listen: wait for Consilium messages outside the model loop.
 *
 * An agent host that can run a background command and resume the agent when it exits (Claude Code's
 * run_in_background, for example) spends zero model turns while this process waits. It exits once,
 * when a message wakes the agent, a task is assigned, the agent is disconnected, or the timeout
 * elapses, and prints one compact JSON result on stdout. Cursors are shared with the MCP server
 * through the per-agent cursor file, so post_message and wait_for_messages continue from here.
 */
import type { ConsiliumTask, Message } from "@consilium/core";
import { parseArgs } from "node:util";
import { ConsiliumClient } from "./client.js";
import { ListenerCursorFile, ListenerCursorStore } from "./listenerCursors.js";
import { deliverBatches, pendingTasksFor, scanTopics, type TopicBatch } from "./listenerScan.js";
import { wakeOnValues, type WakeOn } from "./listenerWake.js";

const { values } = parseArgs({
  options: {
    agent: { type: "string" },
    topic: { type: "string" },
    wake: { type: "string", default: "mentions" },
    timeout: { type: "string", default: "3600" },
  },
});

const fail = (reason: string): never => {
  process.stdout.write(`${JSON.stringify({ error: reason })}\n`);
  process.exit(2);
};

const agentId = values.agent?.trim().toLowerCase() || "";
if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(agentId)) fail("Usage: consilium-listen --agent <agentId> [--wake mentions|human|any] [--timeout seconds] [--topic topicId]");
if (!wakeOnValues.includes(values.wake as WakeOn)) fail(`--wake must be one of ${wakeOnValues.join(", ")}`);
const wakeOn = values.wake as WakeOn;
const timeoutSeconds = Number(values.timeout);
if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 86_400) fail("--timeout must be an integer between 1 and 86400 seconds");

const client = new ConsiliumClient();
const cursors = new ListenerCursorStore(new ListenerCursorFile());
cursors.bind(agentId);
cursors.begin();

const pollIntervalMs = 1_000;
const unavailableRetryMs = 3_000;
const heartbeatIntervalMs = 20_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

// The agent's context re-reads this output on every later turn: keep only what it acts on.
const slimMessage = (message: Message) => ({
  id: message.id,
  topicId: message.topicId,
  author: `${message.authorName} (${message.authorKind === "agent" ? message.authorId : message.authorKind})`,
  body: message.body,
  ...(message.mentions.length ? { mentions: message.mentions } : {}),
  ...(message.replyTo ? { replyTo: { id: message.replyTo.id, authorId: message.replyTo.authorId, body: message.replyTo.body } } : {}),
  ...(message.attachments.length ? { attachments: message.attachments.map(({ id, name, mediaType }) => ({ id, name, mediaType })) } : {}),
  ...(message.topicMentions.length ? { topicMentions: message.topicMentions.map(({ topicId, mentionKey }) => ({ topicId, mentionKey })) } : {}),
  createdAt: message.createdAt,
});
const slimTask = ({ id, topicId, title, status, assignedAgentId }: ConsiliumTask) => ({ id, topicId, title, status, assignedAgentId });

const finish = (output: Record<string, unknown>) => {
  process.stdout.write(`${JSON.stringify({ agentId, ...output, cursors: cursors.snapshot() })}\n`);
  process.exit(0);
};

let ownerSessionId: string | undefined;
let agentName = agentId;
let agentModel: string | undefined;
let lastHeartbeatAt = 0;
let unread: TopicBatch[] = [];
let serverUnavailable = false;

const presence = async (status: "listening" | "working", topic?: { id: string; title: string }) => {
  await client.registerAgent({
    id: agentId, name: agentName, model: agentModel, sessionId: ownerSessionId, status, claimSession: false,
    activeTopicId: topic?.id, activeTopicTitle: topic?.title,
  }).catch(() => undefined);
  lastHeartbeatAt = Date.now();
};

const deliver = async (batches: TopicBatch[], timedOut: boolean) => {
  const { messages, omitted } = deliverBatches(batches, cursors, agentId, wakeOn);
  const topicTitles = Object.fromEntries(batches.map((batch) => [batch.topic.id, batch.topic.title]));
  finish({ timedOut, disconnected: false, topics: topicTitles, messages: messages.map(slimMessage), ...(omitted ? { omitted } : {}) });
};

const deadline = Date.now() + timeoutSeconds * 1000;
while (Date.now() < deadline) {
  try {
    const agent = (await client.listAgents()).find((candidate) => candidate.id === agentId);
    if (!agent) fail(`Agent ${agentId} is not registered. Call register_agent through the Consilium MCP first.`);
    // Presence belongs to the MCP session that registered the agent. This command only keeps it
    // fresh, and stops as soon as that session is disconnected or replaced.
    ownerSessionId ??= agent!.sessionId;
    if (agent!.status === "offline" || agent!.sessionId !== ownerSessionId) finish({ timedOut: false, disconnected: true, messages: [] });
    agentName = agent!.name;
    agentModel = agent!.model;
    if (Date.now() - lastHeartbeatAt >= heartbeatIntervalMs) await presence("listening");

    const scan = await scanTopics(client, cursors, agentId, wakeOn, values.topic);
    serverUnavailable = false;
    unread = scan.unread;
    if (scan.woken) {
      await presence("working", scan.woken.topic);
      await deliver([scan.woken], false);
    }
    const tasks = await pendingTasksFor(client, agentId);
    if (tasks.length) finish({ timedOut: false, disconnected: false, messages: [], tasks: tasks.map(slimTask) });
    await sleep(Math.min(pollIntervalMs, deadline - Date.now()));
  } catch {
    serverUnavailable = true;
    await sleep(Math.min(unavailableRetryMs, deadline - Date.now()));
  }
}
if (unread.length) await deliver(unread, true);
finish({ timedOut: true, disconnected: false, messages: [], ...(serverUnavailable ? { serverUnavailable } : {}) });
