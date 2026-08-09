const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Keep a readable text fallback for older MCP clients while exposing object
 * results through the protocol's structuredContent field for typed clients.
 */
export const toolResult = (value: unknown) => {
  const serialized = JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text" as const, text: serialized === undefined ? "null" : serialized }],
    ...(isJsonObject(value) ? { structuredContent: value } : {}),
  };
};
