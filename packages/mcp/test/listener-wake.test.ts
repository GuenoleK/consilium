import assert from "node:assert/strict";
import test from "node:test";
import type { Message } from "@consilium/core";
import { boundMessages, compactMessage, isWakeMessage, messagesForAgent } from "../src/listenerWake.js";

const message = (overrides: Partial<Message>): Message => ({
  id: "m1", topicId: "t1", authorId: "human", authorName: "Vous", authorKind: "human",
  body: "", mentions: [], topicMentions: [], attachments: [], createdAt: "2026-09-27T10:00:00.000Z",
  ...overrides,
});

test("the default wake rule keeps mention-only semantics", () => {
  assert.equal(isWakeMessage(message({ mentions: ["claude"] }), "claude", false), true);
  assert.equal(isWakeMessage(message({ mentions: ["tous"] }), "claude", true), true);
  assert.equal(isWakeMessage(message({ mentions: ["tous"] }), "claude", false), false);
  assert.equal(isWakeMessage(message({}), "claude", true), false);
});

test("an agent is never woken by its own message", () => {
  assert.equal(isWakeMessage(message({ authorId: "claude", authorKind: "agent", mentions: ["claude"] }), "claude", true, "any"), false);
});

test("wakeOn human wakes on an unaddressed human message but not one addressed to another agent", () => {
  assert.equal(isWakeMessage(message({}), "claude", true, "human"), true);
  assert.equal(isWakeMessage(message({ mentions: ["vous"] }), "claude", true, "human"), true);
  assert.equal(isWakeMessage(message({ mentions: ["codex"] }), "claude", true, "human"), false);
  assert.equal(isWakeMessage(message({}), "claude", false, "human"), false);
  assert.equal(isWakeMessage(message({ authorId: "codex", authorKind: "agent" }), "claude", true, "human"), false);
});

test("wakeOn any wakes on every message from others in a participating topic", () => {
  assert.equal(isWakeMessage(message({ authorId: "codex", authorKind: "agent" }), "claude", true, "any"), true);
  assert.equal(isWakeMessage(message({ authorId: "codex", authorKind: "agent" }), "claude", false, "any"), false);
});

test("agent-facing messages drop the agent's own posts and shorten quoted parents", () => {
  const longParent = "x".repeat(500);
  const [reply] = messagesForAgent([
    message({ id: "own", authorId: "claude", authorKind: "agent" }),
    message({ id: "reply", replyTo: { id: "p", authorId: "codex", authorName: "Codex", authorKind: "agent", body: longParent } }),
  ], "claude");

  assert.equal(reply.id, "reply");
  assert.ok(reply.replyTo!.body.length < 210);
  const short = message({ replyTo: { id: "p", authorId: "codex", authorName: "Codex", authorKind: "agent", body: "court" } });
  assert.equal(compactMessage(short), short);
});

test("a catch-up is bounded to recent messages but never drops a mention", () => {
  const messages = Array.from({ length: 30 }, (_, index) => message({ id: `m${index}`, body: "x".repeat(100), mentions: index === 0 ? ["claude"] : [] }));
  const bounded = boundMessages(messages, (candidate) => candidate.mentions.includes("claude"));

  assert.equal(bounded.messages.length, 21);
  assert.equal(bounded.messages[0].id, "m0");
  assert.equal(bounded.messages.at(-1)!.id, "m29");
  assert.equal(bounded.omitted, 9);
});

test("a catch-up keeps at least the newest message even when it exceeds the character budget", () => {
  const bounded = boundMessages([message({ id: "old", body: "a" }), message({ id: "huge", body: "b".repeat(20_000) })]);
  assert.deepEqual(bounded.messages.map((candidate) => candidate.id), ["huge"]);
  assert.equal(bounded.omitted, 1);
});
