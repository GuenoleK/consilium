import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon/Icon";
import "./ConfirmDialog.scss";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
  confirmIcon?: string;
  icon?: string;
  danger?: boolean;
  errorMessage?: string;
}

const CLOSE_ANIMATION_MS = 180;

export function ConfirmDialog({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = "Confirmer",
  confirmIcon = "check",
  icon = "help",
  danger = false,
  errorMessage = "L’action n’a pas pu être effectuée. Réessayez.",
}: ConfirmDialogProps) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      setSubmitting(false);
      setError("");
      return;
    }

    if (!rendered) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
      setSubmitting(false);
      setError("");
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => cancelButtonRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!rendered) return null;

  const finishClose = () => {
    setRendered(false);
    setClosing(false);
    setSubmitting(false);
    setError("");
    onClose();
  };

  const closeWithAnimation = (allowSubmitting = false) => {
    if ((!allowSubmitting && submitting) || closing) return;
    setClosing(true);
    window.setTimeout(finishClose, CLOSE_ANIMATION_MS);
  };

  const confirmAction = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm();
      closeWithAnimation(true);
    } catch {
      setSubmitting(false);
      setError(errorMessage);
    }
  };

  return <div
    className={`confirm-dialog${closing ? " confirm-dialog--closing" : ""}`}
    role="presentation"
    onClick={(event) => { if (event.target === event.currentTarget) closeWithAnimation(); }}
    onKeyDown={(event) => { if (event.key === "Escape") closeWithAnimation(); }}
  >
    <section className="confirm-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <header className="confirm-dialog__header">
        <span className={`confirm-dialog__icon${danger ? " confirm-dialog__icon--danger" : ""}`}><Icon name={icon} /></span>
        <div>
          <span>Confirmation</span>
          <h2 id="confirm-dialog-title">{title}</h2>
        </div>
        <button type="button" onClick={() => closeWithAnimation()} disabled={submitting} aria-label="Fermer"><Icon name="close" /></button>
      </header>

      <div className="confirm-dialog__body">
        <p id="confirm-dialog-message" className="confirm-dialog__message">{message}</p>
        {error && <p className="confirm-dialog__error" role="alert"><Icon name="error" />{error}</p>}
        <footer className="confirm-dialog__actions">
          <button ref={cancelButtonRef} type="button" className="confirm-dialog__cancel" onClick={() => closeWithAnimation()} disabled={submitting}>Annuler</button>
          <button type="button" className={`confirm-dialog__confirm${danger ? " confirm-dialog__confirm--danger" : ""}`} onClick={() => void confirmAction()} disabled={submitting}>
            <Icon name={submitting ? "progress_activity" : confirmIcon} />
            {submitting ? "En cours…" : confirmLabel}
          </button>
        </footer>
      </div>
    </section>
  </div>;
}
