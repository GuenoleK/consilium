import { useTranslation } from "../../../../i18n";
import { Switch } from "../../../../shared/components/Switch/Switch";
import type { NotificationPermissionState } from "../../useSystemNotifications";

interface NotificationToggleProps {
  permission: NotificationPermissionState;
  enabled: boolean;
  onToggle: () => void;
}

export function NotificationToggle({ permission, enabled, onToggle }: NotificationToggleProps) {
  const { t } = useTranslation();
  const unavailable = permission === "unsupported" || permission === "denied";
  return <Switch checked={enabled} disabled={unavailable} onChange={onToggle} label={t("notificationToggle.label")} />;
}
