import assert from "node:assert/strict";
import test from "node:test";
import { judgeOwnership, ownerGoneAfterMs } from "../src/ownership.js";

const now = Date.parse("2026-09-29T10:00:00.000Z");
const agent = (overrides: Partial<{ status: string; sessionId: string; lastSeenAt: string }> = {}) => ({
  status: "listening", sessionId: "old", lastSeenAt: new Date(now - 1_000).toISOString(), ...overrides,
});

test("an agent owned by this session, or by nobody, is mine", () => {
  assert.equal(judgeOwnership(agent({ sessionId: "me" }), "me", undefined, now).kind, "mine");
  assert.equal(judgeOwnership(agent({ sessionId: undefined }), "me", undefined, now).kind, "mine");
  assert.equal(judgeOwnership(undefined, "me", undefined, now).kind, "mine");
});

test("an explicitly disconnected agent stays disconnected", () => {
  assert.equal(judgeOwnership(agent({ status: "offline" }), "me", undefined, now).kind, "offline");
});

test("a freshly seen foreign owner is contested until its heartbeat proves it alive or silent", () => {
  assert.equal(judgeOwnership(agent(), "me", undefined, now).kind, "contested");
});

test("a foreign owner whose heartbeat advanced is alive: this process is replaced", () => {
  const first = agent();
  const later = agent({ lastSeenAt: new Date(now + 5_000).toISOString() });
  assert.equal(judgeOwnership(later, "me", first.lastSeenAt, now + 6_000).kind, "replaced");
});

test("a foreign owner silent past the threshold is gone: an MCP restart adopts the agent", () => {
  const silent = agent({ lastSeenAt: new Date(now - ownerGoneAfterMs - 1).toISOString() });
  assert.equal(judgeOwnership(silent, "me", silent.lastSeenAt, now).kind, "adopt");
  assert.equal(judgeOwnership(agent({ status: "away", lastSeenAt: new Date(now - 300_000).toISOString() }), "me", undefined, now).kind, "adopt");
});
