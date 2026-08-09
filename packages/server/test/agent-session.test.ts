import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { ConsiliumStore } from "../src/store.js";

test("agent messages require the current registered session", async () => {
  const directory = await mkdtemp(join(tmpdir(), "consilium-agent-session-"));

  try {
    const store = new ConsiliumStore(join(directory, "consilium.json"));
    const topic = (await store.listTopics())[0];
    await store.registerAgent({
      id: "expert",
      name: "Expert",
      model: "test",
      sessionId: "session-current",
      claimSession: true,
      status: "listening",
    });
    const app = createApp(store);
    const request = (sessionId?: string) => app.request(new Request(`http://consilium.test/api/topics/${topic.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        authorId: "expert",
        authorName: "Expert",
        authorKind: "agent",
        body: "@vous message de test",
        ...(sessionId ? { sessionId } : {}),
      }),
    }));

    assert.equal((await request("session-old")).status, 409);
    assert.equal((await request()).status, 409);
    assert.equal((await request("session-current")).status, 201);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
