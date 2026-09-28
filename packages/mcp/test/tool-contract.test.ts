import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonSchemaDialectTransport } from "../src/schemaDialectTransport.js";
import { waitForMessagesOutputSchema } from "../src/toolSchemas.js";
import { toolResult } from "../src/toolResult.js";

const deliveredMessage = {
  id: "message-1",
  topicId: "topic-1",
  authorId: "human",
  authorName: "Vous",
  authorKind: "human" as const,
  body: "@codex-ailo-android",
  mentions: ["codex-ailo-android"],
  topicMentions: [],
  attachments: [],
  createdAt: "2026-08-09T01:14:02.173Z",
};

const deliveredResult = {
  timedOut: false,
  disconnected: false,
  cursor: deliveredMessage.createdAt,
  cursors: { [deliveredMessage.topicId]: deliveredMessage.createdAt },
  topicId: deliveredMessage.topicId,
  messages: [deliveredMessage],
};

test("object tool results are available as structuredContent and text fallback", () => {
  const response = toolResult(deliveredResult);

  assert.deepEqual(response.structuredContent, deliveredResult);
  assert.deepEqual(JSON.parse(response.content[0].text), deliveredResult);
});

test("wait_for_messages output schema distinguishes delivery from timeout", () => {
  const parsed = waitForMessagesOutputSchema.parse(deliveredResult);

  assert.equal(parsed.timedOut, false);
  assert.equal(parsed.messages.length, 1);
  assert.equal(parsed.messages[0].mentions[0], "codex-ailo-android");
  assert.equal(parsed.cursor, deliveredMessage.createdAt);
  assert.equal(parsed.cursors?.[deliveredMessage.topicId], deliveredMessage.createdAt);

  const timeout = waitForMessagesOutputSchema.parse({
    timedOut: true,
    disconnected: false,
    cursor: deliveredMessage.createdAt,
    messages: [],
  });
  assert.equal(timeout.timedOut, true);
  assert.equal(timeout.messages.length, 0);
});

test("wait_for_messages publishes a JSON Schema 2020-12 output contract", async () => {
  const server = new McpServer({ name: "consilium-test", version: "0.1.0" });
  server.registerTool("wait_for_messages", {
    outputSchema: waitForMessagesOutputSchema,
  }, async () => toolResult(deliveredResult));

  const client = new Client({ name: "consilium-test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(new JsonSchemaDialectTransport(serverTransport)), client.connect(clientTransport)]);
  try {
    const listedTool = (await client.listTools()).tools.find((tool) => tool.name === "wait_for_messages");
    assert.ok(listedTool?.outputSchema);
    assert.equal(listedTool.outputSchema["$schema"], "https://json-schema.org/draft/2020-12/schema");

    const response = await client.callTool({ name: "wait_for_messages", arguments: {} });
    assert.deepEqual(response.structuredContent, deliveredResult);
  } finally {
    await client.close();
    await server.close();
  }
});

test("an unparsed MCP envelope is rejected instead of being mistaken for a timeout", () => {
  const envelope = {
    content: [{ type: "text", text: JSON.stringify(deliveredResult) }],
  };

  assert.throws(() => waitForMessagesOutputSchema.parse(envelope));
  const decoded = waitForMessagesOutputSchema.parse(JSON.parse(envelope.content[0].text));
  assert.equal(decoded.messages[0].id, deliveredMessage.id);
});
