import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ConsiliumClient } from "./client.js";

const client = new ConsiliumClient();
const server = new McpServer({ name: "consilium", version: "0.1.0" });
const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const agentIdSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/);
type PresenceStatus = "online" | "listening" | "working" | "away" | "offline";
interface ActivePresence { id: string; name: string; model?: string; status: PresenceStatus; }
let activePresence: ActivePresence | undefined;
let heartbeatInFlight = false;
let activeListenCalls = 0;

const setActivePresence = (presence: ActivePresence) => {
  const previousModel = activePresence?.id === presence.id ? activePresence.model : undefined;
  activePresence = { ...presence, model: presence.model?.trim() || previousModel };
};

const clearActivePresence = (agentId?: string) => {
  if (!agentId || activePresence?.id === agentId) activePresence = undefined;
};

const sendPresenceHeartbeat = async () => {
  if (!activePresence || heartbeatInFlight) return;
  heartbeatInFlight = true;
  try {
    const registered = (await client.listAgents()).find((agent) => agent.id === activePresence?.id);
    if (registered?.status === "offline") {
      clearActivePresence(registered.id);
      return;
    }
    if (activePresence) await client.registerAgent(activePresence);
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
server.tool("get_topic", "Read one topic and its complete shared conversation.", { topicId: z.string() }, async ({ topicId }) =>
  result({ topic: await client.getTopic(topicId), messages: await client.listMessages(topicId) }),
);
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
server.tool("post_message", "Post an agent reply or request into a topic. Use @mentions to address other agents.", {
  topicId: z.string(), body: z.string().min(1), agentId: agentIdSchema, agentName: z.string().min(1),
}, async ({ topicId, body, agentId, agentName }) => {
  const message = await client.postMessage(topicId, body, agentId, agentName);
  setActivePresence({ id: agentId, name: agentName, status: "listening" });
  await sendPresenceHeartbeat();
  return result(message);
});
server.tool("list_messages", "List topic messages, optionally after an ISO timestamp. Each message includes durable attachment metadata; call read_attachment with its id to access the file.", {
  topicId: z.string(), since: z.string().datetime().optional(),
}, async ({ topicId, since }) => result(await client.listMessages(topicId, since)));
server.tool("wait_for_messages", "Keep an agent listening for new topic messages. Wakes up only when a message mentions this agent (or @tous/@all), but once woken returns every message since the last call's cursor, not just the ones that mention this agent — read them all, because a governance-relevant exchange between other participants that never mentions this agent is easy to miss otherwise; do not assume another agent's paraphrase of that exchange is complete. Returned messages include durable attachments that can be opened with read_attachment. timeoutSeconds is capped at 60: longer single calls become unreliable over the stdio transport. To honor a 'stay listening' request, call this again immediately in a tight silent loop (no reply text between calls) each time it returns timedOut=true, accumulating elapsed time across calls yourself. Only break silence to report back once a real message arrives, or once about 10 minutes have passed with nothing but timeouts, at which point register_agent with status 'away' and tell the user you disconnected after 10 minutes of inactivity. Narrating every empty timeout defeats the point of this loop.", {
  topicId: z.string(), agentId: agentIdSchema.optional(), since: z.string().datetime().optional(),
  agentName: z.string().optional(), model: z.string().optional(),
  timeoutSeconds: z.number().int().min(1).max(60).optional(),
}, async ({ topicId, agentId, agentName, model, since, timeoutSeconds }) => {
  const deadline = Date.now() + (timeoutSeconds || 60) * 1000;
  const cursor = since || new Date().toISOString();
  activeListenCalls += 1;
  try {
    if (agentId) {
      const registered = (await client.listAgents()).find((agent) => agent.id === agentId);
      if (registered?.status === "offline") return result({ timedOut: false, disconnected: true, cursor, messages: [] });
      setActivePresence({ id: agentId, name: agentName || registered?.name || agentId, model: model || registered?.model, status: "listening" });
      await sendPresenceHeartbeat();
    }
    while (Date.now() < deadline) {
      const messages = await client.listMessages(topicId, cursor);
      // Mentions only decide WHEN to wake up (so a busy topic doesn't fire on every unrelated
      // reply). Once woken, return every message since the last checkpoint, not just the ones that
      // mention this agent — otherwise an exchange between other participants that never mentions
      // this agent is silently skipped forever, even though it's part of the same conversation.
      const relevant = agentId ? messages.filter((message) =>
        message.mentions.includes(agentId) || message.mentions.includes("tous") || message.mentions.includes("all"),
      ) : messages;
      if (relevant.length) {
        if (agentId) {
          setActivePresence({ id: agentId, name: agentName || agentId, model, status: "working" });
          await sendPresenceHeartbeat();
        }
        return result({ timedOut: false, disconnected: false, cursor: messages.at(-1)?.createdAt, messages });
      }
      if (agentId) {
        const agent = (await client.listAgents()).find((candidate) => candidate.id === agentId);
        if (agent?.status === "offline") {
          clearActivePresence(agentId);
          return result({ timedOut: false, disconnected: true, cursor, messages: [] });
        }
        const tasks = (await client.listTasks({ activeOnly: true }))
          .filter((task) => !task.assignedAgentId || task.assignedAgentId === agentId)
          .filter((task) => task.status === "pending" || task.status === "waiting_for_input");
        if (tasks.length) {
          setActivePresence({ id: agentId, name: agentName || agentId, model, status: "working" });
          await sendPresenceHeartbeat();
          return result({ timedOut: false, disconnected: false, cursor, messages: [], tasks });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return result({ timedOut: true, disconnected: false, cursor, messages: [] });
  } finally {
    // Do not flip to "away" the instant this call returns: a caller looping wait_for_messages
    // (return -> pick next call -> call again) needs a brief gap to be tolerated, or every cycle
    // flickers listening/away/listening. The periodic heartbeat above already stops refreshing
    // once activeListenCalls hits 0, so a caller that genuinely stops gets caught by the server's
    // own presenceStaleAfterMs window (store.ts) instead of an instant, flicker-prone flip here.
    activeListenCalls = Math.max(0, activeListenCalls - 1);
  }
});
server.tool("register_agent", "Register or refresh an agent presence at the table. Every agent must declare its actual runtime identity and model; never reuse a default or previously observed model name.", {
  id: agentIdSchema.describe("Stable lowercase agent id, for example codex, claude, or expert."),
  name: z.string().trim().min(1).max(80).describe("Agent display name, for example Codex, Claude, or Expert."),
  model: z.string().trim().min(1).describe("Exact current model identifier, for example gpt-5.6-sol or claude-sonnet-5."),
  status: z.enum(["online", "listening", "working", "away", "offline"]).optional(),
}, async ({ id, name, model, status }) => {
  const presence = { id, name, model, status: status || "online" };
  const agent = await client.registerAgent(presence);
  if (presence.status === "offline") clearActivePresence(id);
  else setActivePresence(presence);
  return result(agent);
});
server.tool("list_agents", "List agents known to Consilium and their presence.", {}, async () => result(await client.listAgents()));
server.tool("disconnect_agent", "Disconnect an agent from its continuous listening loop.", {
  agentId: z.string().min(1),
}, async ({ agentId }) => {
  clearActivePresence(agentId);
  return result(await client.disconnectAgent(agentId));
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
