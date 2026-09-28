import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "node:crypto";
import { SessionRecoveryGate } from "./sessionRecovery.js";
import { z } from "zod";
import { ConsiliumClient } from "./client.js";
import { ListenerCursorFile, ListenerCursorStore } from "./listenerCursors.js";
import { waitForMessagesOutputSchema } from "./toolSchemas.js";
import { toolResult as result } from "./toolResult.js";
import { JsonSchemaDialectTransport } from "./schemaDialectTransport.js";
import { boundMessages, compactMessage, messagesForAgent, wakeOnValues } from "./listenerWake.js";
import { judgeOwnership } from "./ownership.js";
import { deliverBatches, pendingTasksFor, scanTopics, topicIncludesAgent, type TopicBatch } from "./listenerScan.js";

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
const presenceHeartbeatIntervalMs = 5_000;
const listenerCursorFile = new ListenerCursorFile();
const sessionRecoveryGate = new SessionRecoveryGate();

// One MCP process can serve several agents: a host may share a single server between sessions, and
// each agent registers under its own id. Every piece of read and presence state is therefore keyed
// by agent id. With shared state, one agent's post_message acknowledged the messages addressed to
// another agent, whose next wait_for_messages then started after them and never delivered them.
interface AgentState {
  presence?: ActivePresence;
  heartbeatInFlight: boolean;
  activeListenCalls: number;
  lastHeartbeatAt: number;
  // Most recent message this agent read per topic: lets post_message close the gap created while it
  // was preparing a reply, even when the caller does not repeat its cursor.
  readCursors: Map<string, string>;
  listener: ListenerCursorStore;
}
const agentStates = new Map<string, AgentState>();

const stateFor = (agentId: string) => {
  let state = agentStates.get(agentId);
  if (!state) {
    state = { heartbeatInFlight: false, activeListenCalls: 0, lastHeartbeatAt: 0, readCursors: new Map(), listener: new ListenerCursorStore(listenerCursorFile) };
    state.listener.bind(agentId);
    agentStates.set(agentId, state);
  }
  return state;
};

// Tools without an agent identity (get_topic, list_messages) may only remember a read position when
// the caller is unambiguous: an explicit agentId, or the only agent this process has seen.
const readerFor = (agentId?: string) => agentId || (agentStates.size === 1 ? [...agentStates.keys()][0] : undefined);

const rememberCursor = (agentId: string | undefined, topicId: string, cursor?: string) => {
  const reader = readerFor(agentId);
  if (reader && cursor) stateFor(reader).readCursors.set(topicId, cursor);
};

const setActivePresence = (presence: PresenceUpdate) => {
  const state = stateFor(presence.id);
  const previousModel = state.presence?.model;
  const nextPresence = { ...presence, sessionId: presence.sessionId || sessionId, model: presence.model?.trim() || previousModel };
  if (state.presence?.sessionId !== nextPresence.sessionId) state.lastHeartbeatAt = 0;
  state.presence = nextPresence;
};

const clearActivePresence = (agentId?: string) => {
  if (!agentId) for (const state of agentStates.values()) state.presence = undefined;
  else {
    const state = agentStates.get(agentId);
    if (state) state.presence = undefined;
  }
};

// The previous owner stopped heartbeating (MCP restart, crash): take the agent over silently.
const adoptAgent = async (agent: { id: string; name: string; model?: string }) => {
  await client.registerAgent({ id: agent.id, name: agent.name, model: agent.model, sessionId, status: "listening", claimSession: true, takeover: true });
  setActivePresence({ id: agent.id, name: agent.name, model: agent.model, status: "listening" });
};

const ensureSessionOwnership = async (agentId: string) => {
  const registered = (await client.listAgents()).find((agent) => agent.id === agentId);
  if (!registered || registered.status === "offline") {
    clearActivePresence(agentId);
    throw new Error(`Agent ${agentId} is not connected (never registered or disconnected). Call register_agent with agentId "${agentId}" once, then retry.`);
  }
  const ownership = judgeOwnership(registered, sessionId, undefined);
  if (ownership.kind === "adopt") {
    await adoptAgent(registered);
    return;
  }
  if (ownership.kind !== "mine") {
    clearActivePresence(agentId);
    throw new Error(`Agent ${agentId} is currently owned by another live Consilium MCP session. If this conversation restarted, call register_agent once to take it over; otherwise stop.`);
  }
};

const setTopicPresence = (presence: Omit<ActivePresence, "sessionId" | "activeTopicId" | "activeTopicTitle"> & { sessionId?: string }, topic: { id: string; title: string }) => {
  setActivePresence({ ...presence, activeTopicId: topic.id, activeTopicTitle: topic.title });
};

const sendPresenceHeartbeat = async (agentId: string, force = false) => {
  const state = stateFor(agentId);
  const presence = state.presence;
  const now = Date.now();
  if (!presence || state.heartbeatInFlight || (!force && now - state.lastHeartbeatAt < presenceHeartbeatIntervalMs)) return;
  state.lastHeartbeatAt = now;
  state.heartbeatInFlight = true;
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
    state.heartbeatInFlight = false;
  }
};

// Only keep republishing presence while a wait_for_messages call is genuinely blocked in its poll
// loop below. Without this guard the interval would keep announcing "listening" forever after the
// agent's turn ends, defeating the server's own staleness timeout (see store.ts presenceStaleAfterMs)
// and making the UI lie about whether anyone is actually there.
const heartbeatTimer = setInterval(() => {
  for (const [agentId, state] of agentStates) if (state.activeListenCalls > 0) void sendPresenceHeartbeat(agentId);
}, 5_000);
heartbeatTimer.unref();

server.tool("list_topics", "List every shared discussion topic, ordered by recent activity.", {}, async () => result(await client.listTopics()));
server.tool("get_topic", "Read one topic and its complete shared conversation. Pass agentId when several agents share this MCP server so the read position is remembered for the right agent.", { topicId: z.string(), agentId: agentIdSchema.optional() }, async ({ topicId, agentId }) => {
  const [topic, messages] = await Promise.all([client.getTopic(topicId), client.listMessages(topicId)]);
  rememberCursor(agentId, topicId, messages.at(-1)?.createdAt);
  return result({ topic, messages: messages.map(compactMessage) });
});
server.tool("switch_conversation", "Move the agent's working focus to another conversation and return its current context. This does not disconnect the agent: its global listener remains available for mentions in every other conversation.", {
  topicId: z.string(), agentId: agentIdSchema, agentName: z.string().min(1), model: z.string().optional(),
}, async ({ topicId, agentId, agentName, model }) => {
  await ensureSessionOwnership(agentId);
  const [topic, messages] = await Promise.all([client.getTopic(topicId), client.listMessages(topicId)]);
  rememberCursor(agentId, topicId, messages.at(-1)?.createdAt);
  setTopicPresence({ id: agentId, name: agentName, model, status: "working" }, topic);
  await sendPresenceHeartbeat(agentId, true);
  return result({ topic, messages: messages.map(compactMessage), focused: true, listeningOtherTopics: true });
});
server.tool("release_conversation", "Release the agent's current conversation focus without disconnecting it. The agent becomes available/listening again and can return to the released conversation when it is mentioned.", {
  agentId: agentIdSchema, agentName: z.string().optional(), model: z.string().optional(),
}, async ({ agentId, agentName, model }) => {
  const registered = (await client.listAgents()).find((agent) => agent.id === agentId);
  if (!registered || registered.status === "offline" || (registered.sessionId && registered.sessionId !== sessionId)) return result({ released: false, disconnected: true });
  setActivePresence({ id: agentId, name: agentName || registered?.name || agentId, model: model || registered?.model, status: "listening" });
  await sendPresenceHeartbeat(agentId, true);
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
server.tool("post_message", "Post an agent reply or request into a topic. Use replyToId to create a durable reply to a specific message. Returns only messageId, createdAt and cursor for the posted message (verbose=true echoes the full message), plus the messages from others published since this agent's last read cursor (or the optional since cursor), bounded to the most recent ones with an omitted count. Without any known cursor (for example after a restart), the catch-up starts after the agent's own last message in the topic. Read those messages before waiting again so messages published while preparing a reply are not skipped. Text inside `code` or ``` blocks is never parsed as a mention. Mention a participating agent with @<agentId>, the human with @vous, participating agents in this topic with @tous or @all, and reference another conversation with #<mentionKey>. When a received message contains topicMentions, call get_topic for the referenced conversation before answering when its context is relevant.", {
  topicId: z.string(), body: z.string().min(1).describe("Include @vous whenever the human is a recipient; use @<agentId> only for an agent already participating in this topic, @tous/@all for all participants, and #<mentionKey> to reference another conversation."), agentId: agentIdSchema, agentName: z.string().min(1), since: z.string().datetime().optional(), replyToId: z.string().optional(),
  verbose: z.boolean().optional().describe("Echo the full posted message. Off by default to keep the agent context small."),
}, async ({ topicId, body, agentId, agentName, since, replyToId, verbose }) => {
  await ensureSessionOwnership(agentId);
  const state = stateFor(agentId);
  state.listener.bind(agentId);
  const knownCursors = [state.readCursors.get(topicId), state.listener.get(topicId)].filter((cursor): cursor is string => Boolean(cursor));
  const cursorBeforePost = since || knownCursors.sort().at(-1);
  const message = await client.postMessage(topicId, body, agentId, agentName, [], replyToId, sessionId);
  let messagesSinceRead = await client.listMessages(topicId, cursorBeforePost);
  if (!cursorBeforePost) {
    // No read position survived (MCP restart): replaying the whole topic once cost 184k characters.
    // What the agent has not seen is, at most, what others said after its own previous message.
    const previousOwn = messagesSinceRead.filter((candidate) => candidate.authorId === agentId && candidate.id !== message.id).at(-1);
    messagesSinceRead = previousOwn ? messagesSinceRead.filter((candidate) => candidate.createdAt > previousOwn.createdAt) : [];
  }
  const cursor = messagesSinceRead.at(-1)?.createdAt || message.createdAt;
  const catchUp = boundMessages(messagesForAgent(messagesSinceRead, agentId), (candidate) => candidate.mentions.includes(agentId));
  rememberCursor(agentId, topicId, cursor);
  state.listener.remember(topicId, cursor);
  setActivePresence({ id: agentId, name: agentName, status: "listening" });
  await sendPresenceHeartbeat(agentId, true);
  return result({
    messageId: message.id,
    createdAt: message.createdAt,
    ...(verbose ? { message } : {}),
    cursor,
    messages: catchUp.messages,
    ...(catchUp.omitted ? { omitted: catchUp.omitted } : {}),
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
  rememberCursor(agentId, topicId, message.createdAt);
  stateFor(agentId).listener.remember(topicId, message.createdAt);
  setActivePresence({ id: agentId, name: agentName, status: "listening" });
  await sendPresenceHeartbeat(agentId, true);
  return result({ message, attachment });
});
server.tool("list_messages", "List topic messages, optionally after an ISO timestamp. This explicit history read does not acknowledge or advance the continuous listener cursor. Each message includes durable attachment metadata; call read_attachment with its id to access the file.", {
  topicId: z.string(), since: z.string().datetime().optional(), agentId: agentIdSchema.optional().describe("Pass when several agents share this MCP server."),
}, async ({ topicId, since, agentId }) => {
  const messages = await client.listMessages(topicId, since);
  rememberCursor(agentId, topicId, messages.at(-1)?.createdAt);
  return result(messages.map(compactMessage));
});
const defaultWaitSeconds = 50;
// Clients abort a call after their own tool timeout, which a server cannot see. Lower this to the
// client's limit (MCP_TOOL_TIMEOUT / tool_timeout_sec) so longer requests are shortened, not aborted.
const configuredMaxWait = Number(process.env.CONSILIUM_MAX_WAIT_SECONDS);
const maxWaitSeconds = Number.isInteger(configuredMaxWait) && configuredMaxWait >= 1 ? Math.min(configuredMaxWait, 1_800) : 1_800;
const progressIntervalMs = 15_000;
const pollIntervalMs = 1_000;
const unavailableRetryMs = 3_000;

const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  if (ms <= 0 || signal.aborted) return resolve();
  const timer = setTimeout(done, ms);
  function done() {
    clearTimeout(timer);
    signal.removeEventListener("abort", done);
    resolve();
  }
  signal.addEventListener("abort", done, { once: true });
});

server.registerTool("wait_for_messages", {
  description: "Keep an agent listening for new topic messages in a single long call. Returns immediately when a message that wakes this agent is already waiting after its per-topic cursors, otherwise blocks until one arrives or timeoutSeconds elapses. By default (wakeOn=\"mentions\") only a direct mention or an eligible @tous/@all wakes the agent early. Every result delivers the unread messages from others, including on timeout (timedOut: true with messages that did not wake the agent), so never double-check with list_messages. Results are bounded to the most recent messages plus every mention; omitted counts the rest. The result includes cursors, a map keyed by topic id; pass it back on the next call. Cursors persist per agent across MCP restarts. A temporarily unreachable Consilium server is retried until the deadline (serverUnavailable: true if it never came back). Every call costs a full model turn: prefer one long wait (600-1800 seconds) over many short ones, or the consilium-listen background command when the host supports background commands. timeoutSeconds defaults to 50 and is capped at 1800; the server sends progress notifications every 15 seconds when the client supplies a progress token.",
  inputSchema: {
    topicId: z.string().optional().describe("Optional priority topic; the listener still monitors every conversation."), agentId: agentIdSchema.describe("Required stable identity of the listening agent; never omit it."), since: z.string().datetime().optional(),
    cursors: z.record(z.string(), z.string().datetime()).optional().describe("Optional per-topic cursors returned by the previous wait_for_messages result."),
    agentName: z.string().optional(), model: z.string().optional(),
    timeoutSeconds: z.number().int().min(1).max(1_800).optional().describe(`Defaults to ${defaultWaitSeconds}; this server caps it at ${maxWaitSeconds}. Raise it when the MCP client tool timeout allows long calls.`),
    timeoutMs: z.number().int().min(1_000).optional().describe("Alias of timeoutSeconds in milliseconds. Prefer timeoutSeconds."),
    wakeOn: z.enum(wakeOnValues).optional().describe("What returns early. mentions (default): direct mention or eligible @tous/@all. human: also any human message in a participating topic that does not address other agents only. any: every message from others in a participating topic."),
  },
  outputSchema: waitForMessagesOutputSchema,
}, async ({ topicId, agentId, agentName, model, since, cursors, timeoutSeconds: requestedTimeoutSeconds, timeoutMs, wakeOn: requestedWakeOn }, extra) => {
  const timeoutSeconds = Math.min(requestedTimeoutSeconds ?? (timeoutMs ? Math.ceil(timeoutMs / 1_000) : defaultWaitSeconds), maxWaitSeconds);
  const wakeOn = requestedWakeOn || "mentions";
  const startedAt = Date.now();
  const deadline = startedAt + timeoutSeconds * 1000;
  const progressToken = extra._meta?.progressToken;
  let nextProgressAt = startedAt + progressIntervalMs;
  const state = stateFor(agentId);
  const listenerCursors = state.listener;
  listenerCursors.bind(agentId);
  const initialCursor = listenerCursors.begin(since, cursors);
  const currentCursor = () => topicId ? listenerCursors.forTopic(topicId) : initialCursor;
  const base = () => ({ disconnected: false, cursor: currentCursor(), cursors: listenerCursors.snapshot() });
  // A cancelled request (client timeout or user interrupt) must not acknowledge anything: its result
  // is never read, so advancing the cursor here would silently drop the messages it carried.
  const cancelled = () => result({ ...base(), timedOut: false, messages: [] });
  let observedOwnerSeenAt: string | undefined;
  const deliver = (batches: TopicBatch[], timedOut: boolean) => {
    const { messages, omitted } = deliverBatches(batches, listenerCursors, agentId, wakeOn);
    return result({
      ...base(), timedOut, messages,
      ...(batches.length === 1 ? { topicId: batches[0].topic.id } : {}),
      ...(omitted ? { omitted } : {}),
    });
  };
  const markWorking = async (topic?: { id: string; title: string }) => {
    if (topic?.title) setTopicPresence({ id: agentId, name: agentName || agentId, model, status: "working" }, topic);
    else setActivePresence({ id: agentId, name: agentName || agentId, model, status: "working", activeTopicId: topic?.id });
    await sendPresenceHeartbeat(agentId, true);
  };
  state.activeListenCalls += 1;
  try {
    let unread: TopicBatch[] = [];
    let registered = false;
    let serverUnavailable = false;
    while (Date.now() < deadline) {
      if (extra.signal.aborted) return cancelled();
      if (progressToken !== undefined && Date.now() >= nextProgressAt) {
        nextProgressAt = Date.now() + progressIntervalMs;
        await extra.sendNotification({
          method: "notifications/progress",
          params: { progressToken, progress: Math.floor((Date.now() - startedAt) / 1000), total: Math.floor((deadline - startedAt) / 1000), message: "listening" },
        }).catch(() => undefined);
      }
      try {
        const agent = (await client.listAgents()).find((candidate) => candidate.id === agentId);
        const ownership = judgeOwnership(agent, sessionId, observedOwnerSeenAt);
        if (ownership.kind === "offline" || ownership.kind === "replaced") {
          clearActivePresence(agentId);
          return result({ ...base(), timedOut: false, disconnected: true, reason: ownership.kind, messages: [] });
        }
        if (ownership.kind === "contested") {
          // A foreign session id right after a restart is either a dead owner or a live duplicate;
          // its heartbeat tells which within seconds. Until then neither consume nor stop.
          observedOwnerSeenAt ??= agent?.lastSeenAt;
          await pause(Math.min(pollIntervalMs, deadline - Date.now()), extra.signal);
          continue;
        }
        if (ownership.kind === "adopt" && agent) await adoptAgent(agent);
        if (!registered) {
          setActivePresence({ id: agentId, name: agentName || agent?.name || agentId, model: model || agent?.model, status: "listening" });
          await sendPresenceHeartbeat(agentId, true);
          registered = true;
        } else {
          await sendPresenceHeartbeat(agentId);
        }
        const scan = await scanTopics(client, listenerCursors, agentId, wakeOn, topicId);
        serverUnavailable = false;
        unread = scan.unread;
        if (scan.woken) {
          if (extra.signal.aborted) return cancelled();
          await markWorking(scan.woken.topic);
          return deliver([scan.woken], false);
        }
        const tasks = await pendingTasksFor(client, agentId);
        if (tasks.length) {
          await markWorking(scan.topics.find((topic) => topic.id === tasks[0].topicId) || await client.getTopic(tasks[0].topicId).catch(() => undefined));
          return result({ ...base(), timedOut: false, messages: [], tasks });
        }
      } catch {
        // The Consilium server is unreachable (restart, network blip). Keep this single call alive and
        // retry instead of failing: a failed call costs the agent a turn and a fresh re-registration.
        serverUnavailable = true;
        await pause(Math.min(unavailableRetryMs, deadline - Date.now()), extra.signal);
        continue;
      }
      // Never sleep past the deadline: overshooting it is what made clients with a fixed request
      // timeout abort calls that were meant to end just under it.
      await pause(Math.min(pollIntervalMs, deadline - Date.now()), extra.signal);
    }
    if (extra.signal.aborted) return cancelled();
    // The turn is spent anyway when the wait expires: hand over what arrived instead of only counting
    // it, which forced an extra list_messages turn every time.
    if (unread.length) return deliver(unread, true);
    return result({ ...base(), timedOut: true, messages: [], ...(serverUnavailable ? { serverUnavailable } : {}) });
  } finally {
    // Do not flip to "away" the instant this call returns: a caller looping wait_for_messages
    // (return -> pick next call -> call again) needs a brief gap to be tolerated, or every cycle
    // flickers listening/away/listening. The periodic heartbeat above already stops refreshing
    // once activeListenCalls hits 0, so a caller that genuinely stops gets caught by the server's
    // own presenceStaleAfterMs window (store.ts) instead of an instant, flicker-prone flip here.
    state.activeListenCalls = Math.max(0, state.activeListenCalls - 1);
  }
});
server.tool("register_agent", "Register or refresh an agent presence at the table. Every agent must declare its actual runtime identity and model; never reuse a default or previously observed model name. On the first registration of this MCP process, a session collision triggers one automatic handoff; the agent must not ask the user to paste takeover JSON. The displaced process receives disconnected and must stop. If the handoff does not succeed, stop retrying. An explicit takeover=true is reserved for a user-authorized exceptional recovery.", {
  agentId: agentIdSchema.optional().describe("Stable lowercase agent id, for example codex, claude, or expert. Same name as in every other tool."),
  agentName: z.string().trim().min(1).max(80).optional().describe("Agent display name, for example Codex, Claude, or Expert."),
  id: agentIdSchema.optional().describe("Legacy alias of agentId."),
  name: z.string().trim().min(1).max(80).optional().describe("Legacy alias of agentName."),
  model: z.string().trim().min(1).describe("Exact current model identifier, for example gpt-5.6-sol or claude-sonnet-5."),
  status: z.enum(["online", "listening", "working", "away", "offline"]).optional(),
  takeover: z.boolean().optional().describe("Explicit recovery only: take ownership from a stale or phantom session after the user asks for it."),
  activeTopicId: z.string().optional(), activeTopicTitle: z.string().trim().min(1).max(200).optional(),
}, async ({ agentId, agentName, id: legacyId, name: legacyName, model, status, takeover, activeTopicId, activeTopicTitle }) => {
  const id = agentId || legacyId;
  const name = agentName || legacyName;
  if (!id || !name) throw new Error("register_agent requires agentId and agentName.");
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

await server.connect(new JsonSchemaDialectTransport(new StdioServerTransport()));
