import { useEffect, useState } from "react";
import { api, type RemoteAccessStatus } from "../../../../core/api";
import { Icon } from "../../../../shared/components/Icon/Icon";
import "./RemoteAccessIndicator.scss";

export function RemoteAccessIndicator() {
  const [status, setStatus] = useState<RemoteAccessStatus>();

  useEffect(() => {
    const refresh = () => void api.remoteAccess().then(setStatus).catch(() => setStatus(undefined));
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!status) return null;

  const label = !status.available
    ? "Tailscale non installé"
    : status.enabled
      ? "Accès distant actif"
      : "Accès distant inactif";

  return <div
    className={`remote-access-indicator remote-access-indicator--${status.enabled ? "active" : "inactive"}`}
    title={status.url || label}
  >
    <Icon name={status.enabled ? "encrypted" : "private_connectivity"} />
    <span>{label}</span>
  </div>;
}
