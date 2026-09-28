import type { Message } from "@consilium/core";

/**
 * - mentions: wake only on a direct mention or an eligible @tous/@all (default, cheapest).
 * - human: also wake on a human message in a topic the agent participates in, unless that message
 *   explicitly addresses other agents only.
 * - any: wake on every message from someone else in a topic the agent participates in.
 */
export const wakeOnValues = ["mentions", "human", "any"] as const;
export type WakeOn = (typeof wakeOnValues)[number];

const broadcastMentions = new Set(["tous", "all"]);
const nonAgentMentions = new Set(["vous", "tous", "all"]);

export const isWakeMessage = (message: Message, agentId: string, participating: boolean, wakeOn: WakeOn = "mentions") => {
  const self = agentId.toLowerCase();
  if (message.authorId.toLowerCase() === self) return false;
  if (message.mentions.includes(self)) return true;
  if (!participating) return false;
  if (message.mentions.some((mention) => broadcastMentions.has(mention))) return true;
  if (wakeOn === "any") return true;
  if (wakeOn === "human" && message.authorKind === "human") {
    return !message.mentions.some((mention) => !nonAgentMentions.has(mention));
  }
  return false;
};

const replyExcerptLength = 200;

/**
 * Every MCP result stays in the agent's context and is re-read on each following turn. The quoted
 * parent of a reply only needs enough text to be recognised; its full body is already in the thread.
 */
export const compactMessage = (message: Message): Message => {
  if (!message.replyTo || message.replyTo.body.length <= replyExcerptLength) return message;
  return { ...message, replyTo: { ...message.replyTo, body: `${message.replyTo.body.slice(0, replyExcerptLength)}…` } };
};

export const messagesForAgent = (messages: Message[], agentId: string) =>
  messages.filter((message) => message.authorId.toLowerCase() !== agentId.toLowerCase()).map(compactMessage);

export const catchUpLimits = { maxMessages: 20, maxChars: 8_000 };

/**
 * Bound what one result can inject into the agent context. The newest messages are kept up to the
 * budget, and messages that must be answered (mentions) are always kept even when older. The
 * omitted count tells the agent it can page the rest with list_messages if it really needs it.
 */
export const boundMessages = (messages: Message[], mustKeep: (message: Message) => boolean = () => false, limits = catchUpLimits) => {
  const kept = new Set<Message>();
  let chars = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const size = messages[index].body.length;
    if (kept.size >= limits.maxMessages || (kept.size > 0 && chars + size > limits.maxChars)) break;
    kept.add(messages[index]);
    chars += size;
  }
  for (const message of messages) if (mustKeep(message)) kept.add(message);
  const bounded = messages.filter((message) => kept.has(message));
  return { messages: bounded, omitted: messages.length - bounded.length };
};
