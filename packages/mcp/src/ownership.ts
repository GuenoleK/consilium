/**
 * Who owns an agent id, seen from one MCP process. Every process draws a fresh session id, so an
 * MCP restart (app restart, crash, new conversation) meets a record still owned by the dead process.
 * Treating that as "replaced" made the first wait_for_messages after every restart return
 * disconnected, and agents rightly stopped: listening sessions were far shorter than needed.
 *
 * A live owner refreshes lastSeenAt every few seconds while it waits, a dead one stops. The
 * verdict is therefore reached from that heartbeat, never from the session id alone.
 */
export const ownerGoneAfterMs = 12_000;

export interface OwnedAgent {
  status: string;
  sessionId?: string;
  lastSeenAt: string;
}

export type Ownership =
  | { kind: "mine" }
  | { kind: "offline" }
  /** Another live session is heartbeating for this agent id: this process must stop. */
  | { kind: "replaced" }
  /** The previous owner went silent: this process may take the agent over. */
  | { kind: "adopt" }
  /** Another session owns it and its liveness is not decided yet: observe again shortly. */
  | { kind: "contested" };

export const judgeOwnership = (
  agent: OwnedAgent | undefined,
  sessionId: string,
  observedLastSeenAt: string | undefined,
  now = Date.now(),
): Ownership => {
  if (!agent) return { kind: "mine" };
  if (agent.status === "offline") return { kind: "offline" };
  if (!agent.sessionId || agent.sessionId === sessionId) return { kind: "mine" };
  if (observedLastSeenAt && agent.lastSeenAt > observedLastSeenAt) return { kind: "replaced" };
  if (now - new Date(agent.lastSeenAt).getTime() > ownerGoneAfterMs) return { kind: "adopt" };
  return { kind: "contested" };
};
