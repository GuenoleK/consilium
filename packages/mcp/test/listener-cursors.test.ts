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
