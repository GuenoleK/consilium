export type ListenerCursorMap = Record<string, string>;

const earliestCursor = (cursors?: ListenerCursorMap) => {
  const values = Object.values(cursors || {});
  return values.sort((left, right) => left.localeCompare(right))[0];
};

/**
 * Keeps the acknowledgement position used by wait_for_messages separate from
 * cursors used by explicit history reads. A cursor returned for topic A must
 * never become the fallback cursor for topic B.
 */
export class ListenerCursorStore {
  private readonly cursors = new Map<string, string>();
  private baseline?: string;

  begin(since?: string, supplied?: ListenerCursorMap, now = new Date().toISOString()) {
    this.baseline ??= earliestCursor(supplied) || since || now;
    for (const [topicId, cursor] of Object.entries(supplied || {})) {
      const current = this.cursors.get(topicId);
      if (!current || cursor > current) this.cursors.set(topicId, cursor);
    }
    return this.baseline;
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
    if (cursor) this.cursors.set(topicId, cursor);
  }

  snapshot(): ListenerCursorMap {
    return Object.fromEntries(this.cursors);
  }
}
