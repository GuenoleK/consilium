import type { ConsiliumTask, Message, Topic } from "@consilium/core";
import type { ConsiliumClient } from "./client.js";
import type { ListenerCursorStore } from "./listenerCursors.js";
import { boundMessages, isWakeMessage, messagesForAgent, type WakeOn } from "./listenerWake.js";

export const topicIncludesAgent = (topic: { participantIds: string[] }, agentId: string) =>
  topic.participantIds.some((participantId) => participantId.toLowerCase() === agentId.toLowerCase());

export interface TopicBatch {
  topic: Topic;
  /** Every message after the cursor, the agent's own included, so the cursor can move past them. */
  messages: Message[];
  participating: boolean;
  wakes: boolean;
}

/**
 * One polling pass over every topic. Stops at the first topic holding a message that wakes the
 * agent; other topics with unread messages are reported so a timeout can still deliver them.
 */
export const scanTopics = async (client: ConsiliumClient, cursors: ListenerCursorStore, agentId: string, wakeOn: WakeOn, priorityTopicId?: string) => {
  const availableTopics = await client.listTopics();
  const topics = priorityTopicId
    ? [...availableTopics.filter((topic) => topic.id === priorityTopicId), ...availableTopics.filter((topic) => topic.id !== priorityTopicId)]
    : availableTopics;
  const unread: TopicBatch[] = [];
  for (const topic of topics) {
    const messages = await client.listMessages(topic.id, cursors.forTopic(topic.id));
    if (!messagesForAgent(messages, agentId).length) continue;
    const participating = topicIncludesAgent(topic, agentId);
    const batch = { topic, messages, participating, wakes: messages.some((message) => isWakeMessage(message, agentId, participating, wakeOn)) };
    if (batch.wakes) return { topics, woken: batch, unread };
    unread.push(batch);
  }
  return { topics, woken: undefined, unread };
};

/** Acknowledge the batches and return what the agent should read, bounded for its context. */
export const deliverBatches = (batches: TopicBatch[], cursors: ListenerCursorStore, agentId: string, wakeOn: WakeOn) => {
  for (const batch of batches) cursors.remember(batch.topic.id, batch.messages.at(-1)?.createdAt);
  const participatingTopics = new Set(batches.filter((batch) => batch.participating).map((batch) => batch.topic.id));
  const { messages, omitted } = boundMessages(
    messagesForAgent(batches.flatMap((batch) => batch.messages), agentId),
    (message) => isWakeMessage(message, agentId, participatingTopics.has(message.topicId), wakeOn),
  );
  return { messages, omitted };
};

export const pendingTasksFor = async (client: ConsiliumClient, agentId: string): Promise<ConsiliumTask[]> =>
  (await client.listTasks({ activeOnly: true }))
    .filter((task) => !task.assignedAgentId || task.assignedAgentId === agentId)
    .filter((task) => task.status === "pending" || task.status === "waiting_for_input");
