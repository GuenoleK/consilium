import { useCallback, useEffect, useRef, useState } from "react";

const DIGEST_DELAY_MS = 30_000;
const MIN_NOTIFICATION_INTERVAL_MS = 5 * 60_000;
const STORAGE_KEY = "consilium-system-notifications-enabled";

export type NotificationPermissionState = "unsupported" | "default" | "denied" | "granted";

export interface AttentionEvent {
  id: string;
  title: string;
  body: string;
  kind: "mention" | "approval" | "authorization";
}

const notificationPermission = (): NotificationPermissionState => {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
};

const readEnabled = () => {
  try { return window.localStorage.getItem(STORAGE_KEY) !== "false"; } catch { return true; }
};

const saveEnabled = (enabled: boolean) => {
  try { window.localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* Storage may be disabled. */ }
};

const digestBody = (events: AttentionEvent[]) => {
  if (events.length === 1) return events[0].body;
  const counts = events.reduce<Record<AttentionEvent["kind"], number>>((current, event) => {
    current[event.kind] += 1;
    return current;
  }, { mention: 0, approval: 0, authorization: 0 });
  const parts = [
    counts.mention && `${counts.mention} mention${counts.mention > 1 ? "s" : ""}`,
    counts.approval && `${counts.approval} validation${counts.approval > 1 ? "s" : ""}`,
    counts.authorization && `${counts.authorization} autorisation${counts.authorization > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return parts.join(" · ");
};

export function useSystemNotifications(events: AttentionEvent[], ready: boolean) {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => notificationPermission());
  const [enabled, setEnabled] = useState(() => permission === "granted" && readEnabled());
  const knownEventIds = useRef(new Set<string>());
  const initialized = useRef(false);
  const pendingEvents = useRef<AttentionEvent[]>([]);
  const flushTimer = useRef<number | undefined>(undefined);
  const lastNotificationAt = useRef(0);

  const flush = useCallback(() => {
    flushTimer.current = undefined;
    const queued = pendingEvents.current.splice(0);
    if (!queued.length || !enabled || permission !== "granted" || document.visibilityState === "visible" && document.hasFocus()) return;
    const uniqueEvents = [...new Map(queued.map((event) => [event.id, event])).values()];
    const notification = new Notification(
      uniqueEvents.length === 1 ? uniqueEvents[0].title : `Consilium · ${uniqueEvents.length} demandes d’attention`,
      { body: digestBody(uniqueEvents), tag: "consilium-attention" },
    );
    notification.onclick = () => { window.focus(); notification.close(); };
    lastNotificationAt.current = Date.now();
  }, [enabled, permission]);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    const cooldown = Math.max(0, lastNotificationAt.current + MIN_NOTIFICATION_INTERVAL_MS - Date.now());
    flushTimer.current = window.setTimeout(flush, Math.max(DIGEST_DELAY_MS, cooldown));
  }, [flush]);

  useEffect(() => () => {
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
  }, []);

  useEffect(() => {
    if (!ready) {
      initialized.current = false;
      knownEventIds.current.clear();
      return;
    }
    if (!initialized.current) {
      knownEventIds.current = new Set(events.map((event) => event.id));
      initialized.current = true;
      return;
    }
    const newEvents = events.filter((event) => !knownEventIds.current.has(event.id));
    events.forEach((event) => knownEventIds.current.add(event.id));
    if (!newEvents.length || !enabled || permission !== "granted" || document.visibilityState === "visible" && document.hasFocus()) return;
    pendingEvents.current.push(...newEvents);
    scheduleFlush();
  }, [enabled, events, permission, ready, scheduleFlush]);

  const toggle = useCallback(async () => {
    const currentPermission = notificationPermission();
    if (currentPermission === "unsupported" || currentPermission === "denied") {
      setPermission(currentPermission);
      return;
    }
    if (currentPermission === "granted") {
      setEnabled((current) => {
        const next = !current;
        saveEnabled(next);
        return next;
      });
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      saveEnabled(true);
      setEnabled(true);
    }
  }, []);

  return { permission, enabled, toggle };
}
