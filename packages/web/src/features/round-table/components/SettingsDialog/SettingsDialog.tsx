import { useEffect, useRef, useState } from "react";
import { localeNames, locales, useTranslation, type LanguagePreference, type Locale, type Translate } from "../../../../i18n";
import type { NotificationPermissionState } from "../../../notifications/useSystemNotifications";
import { NotificationToggle } from "../../../notifications/components/NotificationToggle/NotificationToggle";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { Select, type SelectOption } from "../../../../shared/components/Select/Select";
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

const notificationStatus = (permission: NotificationPermissionState, t: Translate) => {
  if (permission === "unsupported") return t("settingsDialog.notifications.status.unsupported");
  if (permission === "denied") return t("settingsDialog.notifications.status.denied");
  if (permission === "default") return t("settingsDialog.notifications.status.default");
  return t("settingsDialog.notifications.description");
};


export function SettingsDialog({ open, onClose, notificationPermission, notificationsEnabled, onToggleNotifications, onSync }: SettingsDialogProps) {
  const { t, preference, setPreference } = useTranslation();
  const { spinning: syncing, runSpinCycle } = useSpinCycle();
  const languageOptions: SelectOption<LanguagePreference>[] = [
    { value: "auto", label: t("settingsDialog.language.auto") },
    ...(Object.keys(locales) as Locale[]).map((code) => ({ value: code, label: localeNames[code] })),
  ];
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
          <span>{t("settingsDialog.header.eyebrow")}</span>
          <h2 id="settings-dialog-title">{t("settingsDialog.header.title")}</h2>
        </div>
        <button ref={closeButtonRef} type="button" onClick={closeWithAnimation} aria-label={t("settingsDialog.header.close")}><Icon name="close" /></button>
      </header>

      <div className="settings-dialog__body">
        <section className="settings-dialog__row">
          <div className="settings-dialog__row-copy"><strong id="settings-language-title">{t("settingsDialog.language.title")}</strong><p>{t("settingsDialog.language.description")}</p></div>
          <Select value={preference} options={languageOptions} onChange={setPreference} labelledBy="settings-language-title" />
        </section>

        <section className="settings-dialog__row">
          <div className="settings-dialog__row-copy"><strong>{t("settingsDialog.notifications.title")}</strong><p>{notificationStatus(notificationPermission, t)}</p></div>
          <NotificationToggle permission={notificationPermission} enabled={notificationsEnabled} onToggle={onToggleNotifications} />
        </section>

        <section className="settings-dialog__row settings-dialog__row--stacked">
          <div className="settings-dialog__row-copy"><strong>{t("settingsDialog.mcp.title")}</strong><p>{t("settingsDialog.mcp.description")}</p></div>
          <button className={`settings-dialog__sync${syncing ? " settings-dialog__sync--loading" : ""}`} type="button" disabled={syncing} onClick={() => void runSpinCycle(onSync)}><Icon name="sync" />{syncing ? t("settingsDialog.mcp.syncing") : t("settingsDialog.mcp.sync")}</button>
        </section>
      </div>
    </section>
  </div>;
}
