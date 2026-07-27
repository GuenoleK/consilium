import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "../../../../shared/components/Icon/Icon";
import "./NewTopicDialog.scss";

interface NewTopicDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; description: string }) => Promise<void>;
}

export function NewTopicDialog({ open, onClose, onCreate }: NewTopicDialogProps) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

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
      setTitle("");
      setDescription("");
      setError("");
      setSubmitting(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => titleRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!rendered) return null;

  const closeWithAnimation = () => {
    if (submitting || closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
      setTitle("");
      setDescription("");
      setError("");
      onClose();
    }, 180);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onCreate({ title: title.trim(), description: description.trim() });
      onClose();
    } catch {
      setError("Le sujet n’a pas pu être créé. Vérifiez que Consilium est bien démarré.");
      setSubmitting(false);
    }
  };

  return <div
    className={`new-topic-dialog${closing ? " new-topic-dialog--closing" : ""}`}
    role="presentation"
    onClick={(event) => { if (event.target === event.currentTarget) closeWithAnimation(); }}
    onKeyDown={(event) => { if (event.key === "Escape") closeWithAnimation(); }}
  >
    <section className="new-topic-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="new-topic-dialog-title">
      <header className="new-topic-dialog__header">
        <span className="new-topic-dialog__icon"><Icon name="forum" filled /></span>
        <div>
          <span>Nouveau sujet</span>
          <h2 id="new-topic-dialog-title">Ouvrir une nouvelle table</h2>
        </div>
        <button type="button" onClick={closeWithAnimation} disabled={submitting} aria-label="Fermer"><Icon name="close" /></button>
      </header>

      <form className="new-topic-dialog__form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>Nom du sujet</span>
          <input
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="Ex. Refonte de l’onboarding"
            disabled={submitting}
            required
          />
        </label>

        <label>
          <span>Contexte <small>Optionnel</small></span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={240}
            placeholder="Donnez aux participants quelques repères pour commencer la discussion…"
            disabled={submitting}
          />
          <small className="new-topic-dialog__count">{description.length}/240</small>
        </label>

        {error && <p className="new-topic-dialog__error" role="alert"><Icon name="error" />{error}</p>}

        <footer className="new-topic-dialog__actions">
          <button type="button" className="new-topic-dialog__cancel" onClick={closeWithAnimation} disabled={submitting}>Annuler</button>
          <button
            type="submit"
            className={`new-topic-dialog__submit${submitting ? " new-topic-dialog__submit--loading" : ""}`}
            disabled={!title.trim() || submitting}
          >
            <Icon name={submitting ? "progress_activity" : "add"} />
            {submitting ? "Création…" : "Créer le sujet"}
          </button>
        </footer>
      </form>
    </section>
  </div>;
}
