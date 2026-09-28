import assert from "node:assert/strict";
import test from "node:test";
import { ListenerCursorStore } from "../src/listenerCursors.js";

test("keeps independent listener cursors when another topic wakes the wait", () => {
  const cursors = new ListenerCursorStore();
  cursors.begin("2026-08-09T09:00:00.000Z", undefined, "2026-08-09T09:00:00.000Z");

  assert.equal(cursors.forTopic("topic-a"), "2026-08-09T09:00:00.000Z");
  assert.equal(cursors.forTopic("topic-b"), "2026-08-09T09:00:00.000Z");
  cursors.remember("topic-a", "2026-08-09T09:05:00.000Z");

  assert.deepEqual(cursors.snapshot(), {
    "topic-a": "2026-08-09T09:05:00.000Z",
    "topic-b": "2026-08-09T09:00:00.000Z",
  });
});

test("accepts a returned cursor map after an MCP restart without collapsing it to one cursor", () => {
  const cursors = new ListenerCursorStore();
  const supplied = {
    "topic-a": "2026-08-09T09:05:00.000Z",
    "topic-b": "2026-08-09T09:02:00.000Z",
  };

  cursors.begin("2026-08-09T09:05:00.000Z", supplied, "2026-08-09T10:00:00.000Z");

  assert.equal(cursors.forTopic("topic-a"), supplied["topic-a"]);
  assert.equal(cursors.forTopic("topic-b"), supplied["topic-b"]);
  assert.equal(cursors.forTopic("topic-c"), "2026-08-09T09:02:00.000Z");
});

test("persisted cursors survive a restart and only move forward across processes", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { ListenerCursorFile } = await import("../src/listenerCursors.js");
  const directory = await mkdtemp(join(tmpdir(), "consilium-cursors-"));
  try {
    const mcp = new ListenerCursorStore(new ListenerCursorFile(directory));
    mcp.bind("claude");
    mcp.remember("topic-a", "2026-09-28T10:00:00.000Z");

    const background = new ListenerCursorStore(new ListenerCursorFile(directory));
    background.bind("claude");
    assert.equal(background.get("topic-a"), "2026-09-28T10:00:00.000Z");
    background.remember("topic-a", "2026-09-28T10:05:00.000Z");

    // A stale writer cannot move the shared position backwards.
    mcp.remember("topic-a", "2026-09-28T10:01:00.000Z");
    const restarted = new ListenerCursorStore(new ListenerCursorFile(directory));
    restarted.bind("claude");
    assert.equal(restarted.get("topic-a"), "2026-09-28T10:05:00.000Z");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
