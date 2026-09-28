import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type ListenerCursorMap = Record<string, string>;

const earliestCursor = (cursors?: ListenerCursorMap) => {
  const values = Object.values(cursors || {});
  return values.sort((left, right) => left.localeCompare(right))[0];
};

export const mergeCursors = (base: ListenerCursorMap, next: ListenerCursorMap) => {
  const merged = { ...base };
  for (const [topicId, cursor] of Object.entries(next)) {
    if (!merged[topicId] || cursor > merged[topicId]) merged[topicId] = cursor;
  }
  return merged;
};

/**
 * Acknowledged listener positions, one small file per agent outside the repository. The MCP
 * process and the background `consilium-listen` command share it, so a restart or a switch between
 * them resumes where the agent stopped instead of replaying the whole history or skipping messages.
 */
export class ListenerCursorFile {
  constructor(private readonly directory = process.env.CONSILIUM_LISTENER_DIR || join(homedir(), ".consilium", "listeners")) {}

  private path(agentId: string) {
    return join(this.directory, `${agentId}.json`);
  }

  read(agentId: string): ListenerCursorMap {
    try {
      const parsed = JSON.parse(readFileSync(this.path(agentId), "utf8"));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  merge(agentId: string, cursors: ListenerCursorMap) {
    const merged = mergeCursors(this.read(agentId), cursors);
    try {
      mkdirSync(this.directory, { recursive: true });
      const temporary = `${this.path(agentId)}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(merged));
      renameSync(temporary, this.path(agentId));
    } catch {
      // Persistence is a resume aid; the in-memory cursors stay authoritative for this process.
    }
    return merged;
  }
}

/**
 * Keeps the acknowledgement position used by wait_for_messages separate from
 * cursors used by explicit history reads. A cursor returned for topic A must
 * never become the fallback cursor for topic B.
 */
export class ListenerCursorStore {
  private readonly cursors = new Map<string, string>();
  private baseline?: string;
  private boundAgentId?: string;

  constructor(private readonly file?: ListenerCursorFile) {}

  begin(since?: string, supplied?: ListenerCursorMap, now = new Date().toISOString()) {
    this.baseline ??= earliestCursor(supplied) || since || now;
    for (const [topicId, cursor] of Object.entries(supplied || {})) {
      const current = this.cursors.get(topicId);
      if (!current || cursor > current) this.cursors.set(topicId, cursor);
    }
    return this.baseline;
  }

  /** Attach the agent's persisted cursors and pull in any progress made by another process. */
  bind(agentId: string) {
    if (!this.file) return;
    this.boundAgentId = agentId;
    for (const [topicId, cursor] of Object.entries(this.file.read(agentId))) {
      const current = this.cursors.get(topicId);
      if (!current || cursor > current) this.cursors.set(topicId, cursor);
    }
  }

  forTopic(topicId: string) {
    const current = this.cursors.get(topicId);
    if (current) return current;
    const cursor = this.baseline || new Date().toISOString();
    this.cursors.set(topicId, cursor);
    return cursor;
  }

  get(topicId: string) {
    return this.cursors.get(topicId);
  }

  remember(topicId: string, cursor?: string) {
    if (!cursor) return;
    this.cursors.set(topicId, cursor);
    if (this.file && this.boundAgentId) this.file.merge(this.boundAgentId, { [topicId]: cursor });
  }

  snapshot(): ListenerCursorMap {
    return Object.fromEntries(this.cursors);
  }
}
