import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";

const draft7Dialect = "http://json-schema.org/draft-07/schema#";
const draft2020Dialect = "https://json-schema.org/draft/2020-12/schema";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeSchemaDialect = (schema: unknown) => {
  if (!isObject(schema) || schema.$schema !== draft7Dialect) return schema;
  return { ...schema, $schema: draft2020Dialect };
};

/**
 * The MCP SDK 1.29 serializes Zod schemas as draft-07 even though the MCP
 * tool contract uses JSON Schema 2020-12. The generated schema is compatible
 * after changing only its dialect marker, so normalize tool listings at the
 * protocol boundary before they reach strict clients.
 */
export const normalizeToolSchemaDialects = (message: JSONRPCMessage): JSONRPCMessage => {
  const envelope = message as unknown as JsonObject;
  if (!isObject(envelope)) return message;
  const result = envelope.result;
  if (!isObject(result) || !Array.isArray(result.tools)) return message;

  return {
    ...envelope,
    result: {
      ...result,
      tools: result.tools.map((tool: unknown) => {
        if (!isObject(tool)) return tool;
        return {
          ...tool,
          inputSchema: normalizeSchemaDialect(tool.inputSchema),
          outputSchema: normalizeSchemaDialect(tool.outputSchema),
        };
      }),
    },
  } as unknown as JSONRPCMessage;
};

export class JsonSchemaDialectTransport implements Transport {
  constructor(private readonly transport: Transport) {}

  get onclose() {
    return this.transport.onclose;
  }

  set onclose(handler: (() => void) | undefined) {
    this.transport.onclose = handler;
  }

  get onerror() {
    return this.transport.onerror;
  }

  set onerror(handler: ((error: Error) => void) | undefined) {
    this.transport.onerror = handler;
  }

  get onmessage() {
    return this.transport.onmessage;
  }

  set onmessage(handler: ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined) {
    this.transport.onmessage = handler;
  }

  get sessionId() {
    return this.transport.sessionId;
  }

  set sessionId(value: string | undefined) {
    this.transport.sessionId = value;
  }

  setProtocolVersion(version: string) {
    this.transport.setProtocolVersion?.(version);
  }

  start() {
    return this.transport.start();
  }

  send(message: JSONRPCMessage, options?: TransportSendOptions) {
    return this.transport.send(normalizeToolSchemaDialects(message), options);
  }

  close() {
    return this.transport.close();
  }
}
