import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsiliumStore } from "../src/store.js";

test("a direct mention after a cursor remains visible with monotonic timestamps", async () => {
  const directory = await mkdtemp(join(tmpdir(), "consilium-listener-"));

  try {
    const store = new ConsiliumStore(join(directory, "consilium.json"));
    const topic = (await store.listTopics())[0];
    const agentId = "codex-ailo-android";

    await store.registerAgent({
      id: agentId,
      name: "Codex Android",
      model: "test",
      sessionId: "session-1",
      claimSession: true,
      status: "listening",
    });
    await store.addParticipant(topic.id, agentId);

    const first = await store.addMessage({
      topicId: topic.id,
      authorId: "human",
      authorName: "Vous",
      authorKind: "human",
      body: "avant la mention",
      attachments: [],
    });
    const directMention = await store.addMessage({
      topicId: topic.id,
      authorId: "human",
      authorName: "Vous",
      authorKind: "human",
      body: `@${agentId}`,
      attachments: [],
    });
    const secondMention = await store.addMessage({
      topicId: topic.id,
      authorId: "human",
      authorName: "Vous",
      authorKind: "human",
      body: `@${agentId} deuxieme mention`,
      attachments: [],
    });

    const messagesSinceFirst = await store.listMessages(topic.id, first.createdAt);
    assert.deepEqual(messagesSinceFirst.map((message) => message.id), [directMention.id, secondMention.id]);
    assert.deepEqual(directMention.mentions, [agentId]);
    assert.ok(directMention.createdAt > first.createdAt);
    assert.ok(secondMention.createdAt > directMention.createdAt);

    const messagesSinceDirectMention = await store.listMessages(topic.id, directMention.createdAt);
    assert.deepEqual(messagesSinceDirectMention.map((message) => message.id), [secondMention.id]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("serializes concurrent snapshot persistence without losing agents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "consilium-persist-"));

  try {
    const filePath = join(directory, "consilium.json");
    const store = new ConsiliumStore(filePath);
    await store.listTopics();

    const outcomes = await Promise.allSettled(Array.from({ length: 24 }, (_, index) => store.registerAgent({
      id: `race-${index}`,
      name: `Race ${index}`,
      model: "test",
      sessionId: `session-${index}`,
      claimSession: true,
      status: "listening",
    })));

    assert.deepEqual(outcomes.filter((outcome) => outcome.status === "rejected"), []);
    const snapshot = JSON.parse(await readFile(filePath, "utf8")) as { agents: unknown[] };
    assert.equal(snapshot.agents.length, 24);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not let a fresh agent session displace the current owner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "consilium-session-claim-"));

  try {
    const store = new ConsiliumStore(join(directory, "consilium.json"));
    await store.registerAgent({
      id: "expert",
      name: "Expert",
      model: "test",
      sessionId: "session-current",
      claimSession: true,
      status: "listening",
    });

    const rejectedClaim = await store.registerAgent({
      id: "expert",
      name: "Expert duplicate",
      model: "test",
      sessionId: "session-duplicate",
      claimSession: true,
      status: "listening",
    });
    assert.equal(rejectedClaim.sessionId, "session-current");
    assert.equal(rejectedClaim.name, "Expert");

    await store.disconnectAgent("expert", "session-current");
    const takeover = await store.registerAgent({
      id: "expert",
      name: "Expert reconnected",
      model: "test",
      sessionId: "session-reconnected",
      claimSession: true,
      status: "listening",
    });
    assert.equal(takeover.sessionId, "session-reconnected");
    assert.equal(takeover.name, "Expert reconnected");

    const forcedTakeover = await store.registerAgent({
      id: "expert",
      name: "Expert forced recovery",
      model: "test",
      sessionId: "session-forced",
      claimSession: true,
      takeover: true,
      status: "listening",
    });
    assert.equal(forcedTakeover.sessionId, "session-forced");
    assert.equal(forcedTakeover.name, "Expert forced recovery");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
