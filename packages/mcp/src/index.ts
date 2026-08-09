import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "node:crypto";
import { SessionRecoveryGate } from "./sessionRecovery.js";
import { z } from "zod";
import { ConsiliumClient } from "./client.js";
import { ListenerCursorStore } from "./listenerCursors.js";
import { waitForMessagesOutputSchema } from "./toolSchemas.js";
import { toolResult as result } from "./toolResult.js";

const client = new ConsiliumClient();
const server = new McpServer({ name: "consilium", version: "0.1.0" });
const agentIdSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/);
const sessionId = randomUUID();
type PresenceStatus = "online" | "listening" | "working" | "away" | "offline";
interface ActivePresence {
  id: string;
  name: string;
  model?: string;
  sessionId: string;
  status: PresenceStatus;
  activeTopicId?: string;
  activeTopicTitle?: string;
}
type PresenceUpdate = Omit<ActivePresence, "sessionId"> & { sessionId?: string };
let activePresence: ActivePresence | undefined;
let heartbeatInFlight = false;
let activeListenCalls = 0;
let lastPresenceHeartbeatAt = 0;
const presenceHeartbeatIntervalMs = 5_000;
// One MCP process represents one conversational agent in normal use. Remembering the most recent
// delivered message per topic lets post_message close the gap created while that agent was working
// on a reply, even when the caller does not explicitly repeat its cursor.
const readCursors = new Map<string, string>();
const listenerCursors = new ListenerCursorStore();
const sessionRecoveryGate = new SessionRecoveryGate();

const rememberCursor = (topicId: string, cursor?: string) => {
  if (cursor) readCursors.set(topicId, cursor);
};

const topicIncludesAgent = (topic: { participantIds: string[] }, agentId: string) =>
  topic.participantIds.some((participantId) => participantId.toLowerCase() === agentId.toLowerCase());

const setActivePresence = (presence: PresenceUpdate) => {
  const previousModel = activePresence?.id === presence.id ? activePresence.model : undefined;
  const nextPresence = { ...presence, sessionId: presence.sessionId || sessionId, model: presence.model?.trim() || previousModel };
  if (activePresence?.id !== nextPresence.id || activePresence?.sessionId !== nextPresence.sessionId) lastPresenceHeartbeatAt = 0;
  activePresence = nextPresence;
};

const clearActivePresence = (agentId?: string) => {
  if (!agentId || activePresence?.id === agentId) activePresence = undefined;
};

const ensureSessionOwnership = async (agentId: string) => {
  const registered = (await client.listAgents()).find((agent) => agent.id === agentId);
  if (!registered || registered.status === "offline" || (registered.sessionId && registered.sessionId !== sessionId)) {
    clearActivePresence(agentId);
    throw new Error("This Consilium agent session is no longer the owner. Reconnect the listener before posting again.");
  }
};

const setTopicPresence = (presence: Omit<ActivePresence, "sessionId" | "activeTopicId" | "activeTopicTitle"> & { sessionId?: string }, topic: { id: string; title: string }) => {
  setActivePresence({ ...presence, activeTopicId: topic.id, activeTopicTitle: topic.title });
};

const sendPresenceHeartbeat = async (force = false) => {
  const presence = activePresence;
  const now = Date.now();
  if (!presence || heartbeatInFlight || (!force && now - lastPresenceHeartbeatAt < presenceHeartbeatIntervalMs)) return;
  lastPresenceHeartbeatAt = now;
  heartbeatInFlight = true;
  try {
    const registered = (await client.listAgents()).find((agent) => agent.id === presence.id);
    if (registered?.status === "offline") {
      clearActivePresence(registered.id);
      return;
    }
    const refreshed = await client.registerAgent({ ...presence, claimSession: false });
    if (refreshed.sessionId && refreshed.sessionId !== presence.sessionId) clearActivePresence(presence.id);
  } catch {
    // The next heartbeat retries after a temporary API interruption.
  } finally {
    heartbeatInFlight = false;
  }
};

// Only keep republishing presence while a wait_for_messages call is genuinely blocked in its poll
// loop below. Without this guard the interval would keep announcing "listening" forever after the
// agent's turn ends, defeating the server's own staleness timeout (see store.ts presenceStaleAfterMs)
// and making the UI lie about whether anyone is actually there.
const heartbeatTimer = setInterval(() => {
  if (activeListenCalls > 0) void sendPresenceHeartbeat();
}, 5_000);
heartbeatTimer.unref();

server.tool("list_topics", "List every shared discussion topic, ordered by recent activity.", {}, async () => result(await client.listTopics()));
server.tool("get_topic", "Read one topic and its complete shared conversation.", { topicId: z.string() }, async ({ topicId }) => {
  const [topic, messages] = await Promise.all([client.getTopic(topicId), client.listMessages(topicId)]);
  rememberCursor(topicId, messages.at(-1)?.createdAt);
  return result({ topic, messages });
});
server.tool("switch_conversation", "Move the agent's working focus to another conversation and return its current context. This does not disconnect the agent: its global listener remains available for mentions in every other conversation.", {
  topicId: z.string(), agentId: agentIdSchema, agentName: z.string().min(1), model: z.string().optional(),
}, async ({ topicId, agentId, agentName, model }) => {
  await ensureSessionOwnership(agentId);
  const [topic, messages] = await Promise.all([client.getTopic(topicId), client.listMessages(topicId)]);
  rememberCursor(topicId, messages.at(-1)?.createdAt);
  setTopicPresence({ id: agentId, name: agentName, model, status: "working" }, topic);
  await sendPresenceHeartbeat(true);
  return result({ topic, messages, focused: true, listeningOtherTopics: true });
});
server.tool("release_conversation", "Release the agent's current conversation focus without disconnecting it. The agent becomes available/listening again and can return to the released conversation when it is mentioned.", {
  agentId: agentIdSchema, agentName: z.string().optional(), model: z.string().optional(),
}, async ({ agentId, agentName, model }) => {
  const registered = (await client.listAgents()).find((agent) => agent.id === agentId);
  if (!registered || registered.status === "offline" || (registered.sessionId && registered.sessionId !== sessionId)) return result({ released: false, disconnected: true });
  setActivePresence({ id: agentId, name: agentName || registered?.name || agentId, model: model || registered?.model, status: "listening" });
  await sendPresenceHeartbeat(true);
  return result({ released: true, disconnected: false, listeningAllTopics: true });
});
server.tool("create_topic", "Create a shared discussion topic.", {
  title: z.string().min(1), description: z.string().optional(),
}, async ({ title, description }) => result(await client.createTopic(title, description || "")));
server.tool("reset_topic", "Clear every message and attachment from a topic while keeping the topic.", {
  topicId: z.string(),
}, async ({ topicId }) => result(await client.resetTopic(topicId)));
server.tool("delete_topic", "Permanently delete a topic, its messages, and its attachments.", {
  topicId: z.string(),
}, async ({ topicId }) => {
  await client.deleteTopic(topicId);
  return result({ deleted: true, topicId });
});
server.tool("post_message", "Post an agent reply or request into a topic. Use replyToId to create a durable reply to a specific message. It also returns every message published since this MCP client's last read cursor (or the optional since cursor), excluding the message just posted. Read those messages before waiting again so messages published while preparing a reply are not skipped. Mention a participating agent with @<agentId>, the human with @vous, participating agents in this topic with @tous or @all, and reference another conversation with #<mentionKey>. When a received message contains topicMentions, call get_topic for the referenced conversation before answering when its context is relevant.", {
  topicId: z.string(), body: z.string().min(1).describe("Include @vous whenever the human is a recipient; use @<agentId> only for an agent already participating in this topic, @tous/@all for all participants, and #<mentionKey> to reference another conversation."), agentId: agentIdSchema, agentName: z.string().min(1), since: z.string().datetime().optional(), replyToId: z.string().optional(),
}, async ({ topicId, body, agentId, agentName, since, replyToId }) => {
  await ensureSessionOwnership(agentId);
  const cursorBeforePost = since || readCursors.get(topicId) || listenerCursors.get(topicId);
  const message = await client.postMessage(topicId, body, agentId, agentName, [], replyToId, sessionId);
  const messagesSinceRead = await client.listMessages(topicId, cursorBeforePost);
  const cursor = messagesSinceRead.at(-1)?.createdAt || message.createdAt;
  rememberCursor(topicId, cursor);
  listenerCursors.remember(topicId, cursor);
  setActivePresence({ id: agentId, name: agentName, status: "listening" });
  await sendPresenceHeartbeat(true);
  return result({
    message,
    cursor,
    messages: messagesSinceRead.filter((candidate) => candidate.id !== message.id),
  });
});
server.tool("request_authorization", "Ask the human for an authorization in a topic. The request appears above the message composer and stays pending until it is approved or rejected. Use kind 'file_attachment' before every outgoing file.", {
  topicId: z.string(), kind: z.string().trim().min(1).max(80), action: z.string().trim().min(1).max(160), details: z.string().trim().min(1).max(2_000),
  agentId: agentIdSchema, agentName: z.string().min(1),
}, async ({ topicId, kind, action, details, agentId, agentName }) => result(await client.requestAuthorization(topicId, {
  kind, action, details, requestedBy: agentId, requestedByName: agentName,
})));
server.tool("get_authorization", "Read the current decision for an authorization request. Wait for its status to become approved before taking the authorized action.", {
  authorizationId: z.string(),
}, async ({ authorizationId }) => result(await client.getAuthorization(authorizationId)));
server.tool("post_attachment", "Attach a local file to a new agent message in a topic, after a human has approved a matching file_attachment authorization. Never send a file before requesting and receiving this authorization. The file must be accessible to this agent and no larger than 25 MB.", {
  topicId: z.string(), filePath: z.string().min(1), mediaType: z.string().min(1).optional(),
  body: z.string().min(1).optional(), authorizationId: z.string(), agentId: agentIdSchema, agentName: z.string().min(1),
}, async ({ topicId, filePath, mediaType, body, authorizationId, agentId, agentName }) => {
  await ensureSessionOwnership(agentId);
  await client.consumeAuthorization(authorizationId, { topicId, requestedBy: agentId, kind: "file_attachment" });
  const attachment = await client.uploadAttachment(topicId, filePath, mediaType);
  const message = await client.postMessage(topicId, body || `Voici le fichier demandé : ${attachment.name}`, agentId, agentName, [attachment.id], undefined, sessionId);
  rememberCursor(topicId, message.createdAt);
  listenerCursors.remember(topicId, message.createdAt);
  setActivePresence({ id: agentId, name: agentName, status: "listening" });
  await sendPresenceHeartbeat(true);
  return result({ message, attachment });
});
server.tool("list_messages", "List topic messages, optionally after an ISO timestamp. This explicit history read does not acknowledge or advance the continuous listener cursor. Each message includes durable attachment metadata; call read_attachment with its id to access the file.", {
  topicId: z.string(), since: z.string().datetime().optional(),
}, async ({ topicId, since }) => {
  const messages = await client.listMessages(topicId, since);
  rememberCursor(topicId, messages.at(-1)?.createdAt);
  return result(messages);
});
server.registerTool("wait_for_messages", {
  description: "Keep an agent listening for new topic messages. Return every message since the last per-topic cursor when a direct mention or an eligible @tous/@all mention wakes the listener. The result includes cursors, a map keyed by topic id; pass that map back on the next call when available. An explicit list_messages or get_topic read never acknowledges the listener. timeoutSeconds is capped at 60 seconds; repeat the call with the returned cursor map after a timeout.",
  inputSchema: {
    topicId: z.string().optional().describe("Optional priority topic; the listener still monitors every conversation."), agentId: agentIdSchema.describe("Required stable identity of the listening agent; never omit it."), since: z.string().datetime().optional(),
    cursors: z.record(z.string(), z.string().datetime()).optional().describe("Optional per-topic cursors returned by the previous wait_for_messages result."),
    agentName: z.string().optional(), model: z.string().optional(),
    timeoutSeconds: z.number().int().min(1).max(60).optional(),
  },
  outputSchema: waitForMessagesOutputSchema,
}, async ({ topicId, agentId, agentName, model, since, cursors, timeoutSeconds }) => {
  const deadline = Date.now() + (timeoutSeconds || 60) * 1000;
  const initialCursor = listenerCursors.begin(since, cursors);
  const cursorForTopic = (candidateTopicId: string) => listenerCursors.forTopic(candidateTopicId);
  activeListenCalls += 1;
  try {
    if (agentId) {
      const registered = (await client.listAgents()).find((agent) => agent.id === agentId);
      if (registered?.status === "offline" || (registered?.sessionId && registered.sessionId !== sessionId)) return result({ timedOut: false, disconnected: true, cursor: initialCursor, cursors: listenerCursors.snapshot(), messages: [] });
      setActivePresence({ id: agentId, name: agentName || registered?.name || agentId, model: model || registered?.model, status: "listening" });
      await sendPresenceHeartbeat(true);
    }
    while (Date.now() < deadline) {
      if (agentId) await sendPresenceHeartbeat();
      const availableTopics = await client.listTopics();
      const topics = topicId
        ? [...availableTopics.filter((topic) => topic.id === topicId), ...availableTopics.filter((topic) => topic.id !== topicId)]
        : availableTopics;
      for (const topic of topics) {
        const cursor = cursorForTopic(topic.id);
        const messages = await client.listMessages(topic.id, cursor);
      // Mentions only decide WHEN to wake up (so a busy topic doesn't fire on every unrelated
      // reply). Once woken, return every message since the last checkpoint, not just the ones that
      // mention this agent — otherwise an exchange between other participants that never mentions
      // this agent is silently skipped forever, even though it's part of the same conversation.
      const relevant = messages.filter((message) =>
        message.mentions.includes(agentId)
        || (topicIncludesAgent(topic, agentId) && (message.mentions.includes("tous") || message.mentions.includes("all"))),
      );
      if (relevant.length) {
        const nextCursor = messages.at(-1)?.createdAt || cursor;
        listenerCursors.remember(topic.id, nextCursor);
        if (agentId) {
          const topicContext = topic.title ? topic : await client.getTopic(topic.id).catch(() => undefined);
          if (topicContext) {
            setTopicPresence({ id: agentId, name: agentName || agentId, model, status: "working" }, topicContext);
          } else {
            setActivePresence({ id: agentId, name: agentName || agentId, model, status: "working", activeTopicId: topic.id });
          }
          await sendPresenceHeartbeat(true);
        }
        return result({ timedOut: false, disconnected: false, topicId: topic.id, cursor: nextCursor, cursors: listenerCursors.snapshot(), messages });
      }
      }
      if (agentId) {
        const agent = (await client.listAgents()).find((candidate) => candidate.id === agentId);
        if (agent?.status === "offline" || (agent?.sessionId && agent.sessionId !== sessionId)) {
          clearActivePresence(agentId);
          return result({ timedOut: false, disconnected: true, cursor: topicId ? cursorForTopic(topicId) : initialCursor, cursors: listenerCursors.snapshot(), messages: [] });
        }
        const tasks = (await client.listTasks({ activeOnly: true }))
          .filter((task) => !task.assignedAgentId || task.assignedAgentId === agentId)
          .filter((task) => task.status === "pending" || task.status === "waiting_for_input");
        if (tasks.length) {
          const taskTopic = topics.find((topic) => topic.id === tasks[0].topicId)
            || await client.getTopic(tasks[0].topicId).catch(() => undefined);
          if (taskTopic) {
            setTopicPresence({ id: agentId, name: agentName || agentId, model, status: "working" }, taskTopic);
          } else {
            setActivePresence({ id: agentId, name: agentName || agentId, model, status: "working" });
          }
          await sendPresenceHeartbeat(true);
          return result({ timedOut: false, disconnected: false, cursor: topicId ? cursorForTopic(topicId) : initialCursor, cursors: listenerCursors.snapshot(), messages: [], tasks });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return result({ timedOut: true, disconnected: false, cursor: topicId ? cursorForTopic(topicId) : initialCursor, cursors: listenerCursors.snapshot(), messages: [] });
  } finally {
    // Do not flip to "away" the instant this call returns: a caller looping wait_for_messages
    // (return -> pick next call -> call again) needs a brief gap to be tolerated, or every cycle
    // flickers listening/away/listening. The periodic heartbeat above already stops refreshing
    // once activeListenCalls hits 0, so a caller that genuinely stops gets caught by the server's
    // own presenceStaleAfterMs window (store.ts) instead of an instant, flicker-prone flip here.
    activeListenCalls = Math.max(0, activeListenCalls - 1);
  }
});
server.tool("register_agent", "Register or refresh an agent presence at the table. Every agent must declare its actual runtime identity and model; never reuse a default or previously observed model name. On the first registration of this MCP process, a session collision triggers one automatic handoff; the agent must not ask the user to paste takeover JSON. The displaced process receives disconnected and must stop. If the handoff does not succeed, stop retrying. An explicit takeover=true is reserved for a user-authorized exceptional recovery.", {
  id: agentIdSchema.describe("Stable lowercase agent id, for example codex, claude, or expert."),
  name: z.string().trim().min(1).max(80).describe("Agent display name, for example Codex, Claude, or Expert."),
  model: z.string().trim().min(1).describe("Exact current model identifier, for example gpt-5.6-sol or claude-sonnet-5."),
  status: z.enum(["online", "listening", "working", "away", "offline"]).optional(),
  takeover: z.boolean().optional().describe("Explicit recovery only: take ownership from a stale or phantom session after the user asks for it."),
  activeTopicId: z.string().optional(), activeTopicTitle: z.string().trim().min(1).max(200).optional(),
}, async ({ id, name, model, status, takeover, activeTopicId, activeTopicTitle }) => {
  const presence = { id, name, model, sessionId, status: status || "online", activeTopicId, activeTopicTitle };
  const isInitialRegistration = sessionRecoveryGate.markInitialRegistration(id);
  let agent = await client.registerAgent({ ...presence, claimSession: true, takeover });
  let recoveredFromSessionHandoff = false;
  if (
    presence.status !== "offline"
    && !takeover
    && agent.sessionId
    && agent.sessionId !== sessionId
    && isInitialRegistration
  ) {
    agent = await client.registerAgent({ ...presence, claimSession: true, takeover: true });
    recoveredFromSessionHandoff = agent.sessionId === sessionId;
  }
  if (presence.status !== "offline" && agent.sessionId && agent.sessionId !== sessionId) {
    clearActivePresence(id);
    return result({
      registered: false,
      disconnected: true,
      handoffAttempted: isInitialRegistration && !takeover,
      reason: `Agent ${id} is already owned by another Consilium MCP session. The automatic one-time handoff did not succeed; stop retrying and end this listener session.`,
      owner: agent,
    });
  }
  if (presence.status === "offline") clearActivePresence(id);
  else setActivePresence(presence);
  return result({ ...agent, registered: true, recoveredFromSessionHandoff });
});
server.tool("list_agents", "List agents known to Consilium and their presence.", {}, async () => result(await client.listAgents()));
server.tool("disconnect_agent", "Disconnect an agent from its continuous listening loop.", {
  agentId: z.string().min(1),
}, async ({ agentId }) => {
  clearActivePresence(agentId);
  return result(await client.disconnectAgent(agentId, sessionId));
});
server.tool("read_attachment", "Read the complete base64 content of a durable attachment using the id included in a message. Decode base64 using the attachment name and mediaType.", {
  attachmentId: z.string().min(1),
}, async ({ attachmentId }) => result(await client.getAttachment(attachmentId)));
server.tool("list_tasks", "List shared tasks and their instructions, approvals, progress, and results.", {
  topicId: z.string().optional(), assignedAgentId: z.string().optional(), activeOnly: z.boolean().optional(),
}, async (input) => result(await client.listTasks(input)));
server.tool("get_task", "Read the complete current state of one task.", {
  taskId: z.string(),
}, async ({ taskId }) => result(await client.getTask(taskId)));
server.tool("create_task", "Create an explicit task. Use a clientRequestId to make retries idempotent.", {
  topicId: z.string(), title: z.string().min(1), description: z.string().default(""),
  requestedBy: z.string().min(1), assignedAgentId: z.string().optional(), clientRequestId: z.string().optional(),
}, async (input) => result(await client.createTask(input)));
server.tool("claim_task", "Atomically claim a pending task for an agent or one of its workers.", {
  taskId: z.string(), agentId: z.string().min(1), workerId: z.string().optional(),
}, async ({ taskId, agentId, workerId }) => result(await client.claimTask(taskId, agentId, workerId)));
server.tool("update_task_status", "Update task progress, lifecycle state, result, or failure.", {
  taskId: z.string(),
  status: z.enum(["pending", "claimed", "running", "awaiting_approval", "waiting_for_input", "completed", "failed", "cancelled"]).optional(),
  progress: z.number().int().min(0).max(100).optional(), result: z.string().optional(),
  error: z.string().optional(), workerId: z.string().optional(),
}, async ({ taskId, ...input }) => result(await client.updateTask(taskId, input)));
server.tool("add_task_instruction", "Add a durable instruction to a task without replacing its original objective.", {
  taskId: z.string(), authorId: z.string().min(1), authorName: z.string().min(1), body: z.string().min(1),
}, async ({ taskId, ...input }) => result(await client.addTaskInstruction(taskId, input)));
server.tool("request_approval", "Pause a task and request explicit human authorization before an action.", {
  taskId: z.string(), requestedBy: z.string().min(1), action: z.string().min(1), details: z.string().min(1),
  riskLevel: z.enum(["free", "confirmation", "restricted"]),
}, async ({ taskId, ...input }) => result(await client.requestApproval(taskId, input)));
server.tool("resolve_approval", "Approve or reject a pending task action as a human decision.", {
  taskId: z.string(), approvalId: z.string(), decision: z.enum(["approved", "rejected"]),
  resolvedBy: z.string().min(1), decisionNote: z.string().optional(),
}, async ({ taskId, approvalId, ...input }) => result(await client.resolveApproval(taskId, approvalId, input)));
server.tool("cancel_task", "Cancel a pending or running task and signal its worker to stop.", {
  taskId: z.string(), requestedBy: z.string().min(1),
}, async ({ taskId, requestedBy }) => result(await client.cancelTask(taskId, requestedBy)));

await server.connect(new StdioServerTransport());
