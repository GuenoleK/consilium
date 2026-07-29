import { Icon } from "../../../../shared/components/Icon/Icon";
import type { NotificationPermissionState } from "../../useSystemNotifications";
import "./NotificationToggle.scss";

interface NotificationToggleProps {
  permission: NotificationPermissionState;
  enabled: boolean;
  onToggle: () => void;
}

const labels: Record<NotificationPermissionState, string> = {
  unsupported: "Les notifications système ne sont pas prises en charge par ce navigateur",
  default: "Activer les notifications système",
  denied: "Les notifications système sont bloquées dans les réglages du navigateur",
  granted: "",
};

export function NotificationToggle({ permission, enabled, onToggle }: NotificationToggleProps) {
  const unavailable = permission === "unsupported" || permission === "denied";
  const label = permission === "granted"
    ? enabled ? "Désactiver les notifications système" : "Activer les notifications système"
    : labels[permission];
  return <button
    type="button"
    className={`notification-toggle${enabled ? " notification-toggle--enabled" : ""}`}
    disabled={unavailable}
    onClick={onToggle}
    aria-label={label}
    title={label}
  ><Icon name={enabled ? "notifications_active" : "notifications"} /></button>;
}
