import { useEffect, useRef, useState } from "react";
import type { NotificationPermissionState } from "../../../notifications/useSystemNotifications";
import { NotificationToggle } from "../../../notifications/components/NotificationToggle/NotificationToggle";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { useSpinCycle } from "../../../../shared/hooks/useSpinCycle";
import "./SettingsDialog.scss";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  notificationPermission: NotificationPermissionState;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onSync: () => Promise<void>;
}

const notificationStatus = (permission: NotificationPermissionState, enabled: boolean) => {
  if (permission === "unsupported") return "Ce navigateur ne prend pas en charge les notifications système.";
  if (permission === "denied") return "Les notifications sont bloquées dans les réglages du navigateur.";
  if (permission === "default") return "Autorisez les notifications pour être averti hors de la fenêtre.";
  return enabled ? "Les notifications système sont activées." : "Les notifications sont autorisées mais désactivées.";
};

export function SettingsDialog({ open, onClose, notificationPermission, notificationsEnabled, onToggleNotifications, onSync }: SettingsDialogProps) {
  const { spinning: syncing, runSpinCycle } = useSpinCycle();
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }

    if (!rendered) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!rendered) return null;

  const closeWithAnimation = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
      onClose();
    }, 180);
  };

  return <div
    className={`settings-dialog${closing ? " settings-dialog--closing" : ""}`}
    role="presentation"
    onClick={(event) => { if (event.target === event.currentTarget) closeWithAnimation(); }}
    onKeyDown={(event) => { if (event.key === "Escape") closeWithAnimation(); }}
  >
    <section className="settings-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
      <header className="settings-dialog__header">
        <span className="settings-dialog__icon"><Icon name="settings" /></span>
        <div>
          <span>Configuration</span>
          <h2 id="settings-dialog-title">Paramètres de Consilium</h2>
        </div>
        <button ref={closeButtonRef} type="button" onClick={closeWithAnimation} aria-label="Fermer les paramètres"><Icon name="close" /></button>
      </header>

      <div className="settings-dialog__body">
        <section className="settings-dialog__section">
          <div className="settings-dialog__section-heading"><span className="settings-dialog__section-icon"><Icon name="notifications" /></span><div><strong>Notifications</strong><p>Recevoir une alerte lorsque Consilium attend votre attention.</p></div></div>
          <div className="settings-dialog__setting-row">
            <span>{notificationStatus(notificationPermission, notificationsEnabled)}</span>
            <NotificationToggle permission={notificationPermission} enabled={notificationsEnabled} onToggle={onToggleNotifications} />
          </div>
        </section>

        <section className="settings-dialog__section">
          <div className="settings-dialog__section-heading"><span className="settings-dialog__section-icon"><Icon name="hub" /></span><div><strong>Connexion MCP</strong><p>Le contexte partagé reste disponible pour les agents connectés.</p></div></div>
          <div className="settings-dialog__connection"><span><i />MCP connecté</span><small>Contexte partagé en direct</small></div>
          <button className="settings-dialog__sync" type="button" disabled={syncing} onClick={() => void runSpinCycle(onSync)}><Icon name="sync" />{syncing ? "Synchronisation…" : "Synchroniser maintenant"}</button>
        </section>
      </div>
    </section>
  </div>;
}
