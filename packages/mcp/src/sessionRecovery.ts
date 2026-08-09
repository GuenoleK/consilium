/**
 * A stable agent id has one owner per MCP process. If a newly connected process
 * finds an existing owner, it may perform one handoff; the displaced process
 * will receive `disconnected: true` on its next listener check and must stop.
 * The gate prevents two already-running processes from endlessly stealing the
 * same identity from each other.
 */
export class SessionRecoveryGate {
  private readonly attemptedAgentIds = new Set<string>();

  markInitialRegistration(agentId: string) {
    if (this.attemptedAgentIds.has(agentId)) return false;
    this.attemptedAgentIds.add(agentId);
    return true;
  }
}
