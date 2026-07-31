import { useEffect, useRef, useState } from "react";
import type { Message } from "@consilium/core";
import { api } from "../../../../core/api";
import { Icon } from "../../../../shared/components/Icon/Icon";
import "./MediaGallery.scss";

type Attachment = Message["attachments"][number];

const isVisualMedium = (attachment: Attachment) => attachment.mediaType.startsWith("image/") || attachment.mediaType.startsWith("video/");

export function MediaGallery({ attachments }: { attachments: Attachment[] }) {
  const media = attachments.filter(isVisualMedium);
  const [activeIndex, setActiveIndex] = useState<number>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const activeMedia = activeIndex === undefined ? undefined : media[activeIndex];

  useEffect(() => {
    if (!activeMedia) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(undefined);
      if (media.length < 2) return;
      if (event.key === "ArrowLeft") setActiveIndex((index) => index === undefined ? index : (index - 1 + media.length) % media.length);
      if (event.key === "ArrowRight") setActiveIndex((index) => index === undefined ? index : (index + 1) % media.length);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [activeMedia, media.length]);

  if (media.length === 0) return null;

  const previous = () => { setDetailsOpen(false); setActiveIndex((index) => index === undefined ? index : (index - 1 + media.length) % media.length); };
  const next = () => { setDetailsOpen(false); setActiveIndex((index) => index === undefined ? index : (index + 1) % media.length); };

  return <>
    <ul className="media-gallery" aria-label="Médias joints">
      {media.map((attachment, index) => {
        const url = api.attachmentUrl(attachment.id);
        const isVideo = attachment.mediaType.startsWith("video/");
        return <li className="media-gallery__item" key={attachment.id}>
          <button type="button" className="media-gallery__preview" onClick={() => { setDetailsOpen(false); setActiveIndex(index); }} aria-label={`Ouvrir ${attachment.name}`}>
            {isVideo
              ? <video src={url} muted playsInline preload="metadata" aria-hidden="true" />
              : <img src={url} alt={attachment.name} loading="lazy" decoding="async" />}
            {isVideo && <span className="media-gallery__play"><Icon name="play_arrow" filled /></span>}
          </button>
          <span className="media-gallery__name" title={attachment.name}>{attachment.name}</span>
        </li>;
      })}
    </ul>

    {activeMedia && activeIndex !== undefined && <div className="media-viewer" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) { setDetailsOpen(false); setActiveIndex(undefined); } }}>
      <section className="media-viewer__panel" role="dialog" aria-modal="true" aria-label={`Aperçu de ${activeMedia.name}`}>
        <header className="media-viewer__header">
          <div className="media-viewer__actions">
            <button type="button" onClick={() => setDetailsOpen((open) => !open)} aria-label={`Informations sur ${activeMedia.name}`} aria-expanded={detailsOpen} aria-controls={`media-viewer-details-${activeMedia.id}`}><Icon name="info" /></button>
          <button ref={closeButtonRef} type="button" onClick={() => setActiveIndex(undefined)} aria-label="Fermer l’aperçu"><Icon name="close" /></button>
          </div>
          {detailsOpen && <span className="media-viewer__tooltip" id={`media-viewer-details-${activeMedia.id}`} role="tooltip">{activeMedia.name}</span>}
        </header>
        <div className="media-viewer__content">
          {activeMedia.mediaType.startsWith("video/")
            ? <video src={api.attachmentUrl(activeMedia.id)} controls autoPlay playsInline />
            : <img src={api.attachmentUrl(activeMedia.id)} alt={activeMedia.name} />}
        </div>
        {media.length > 1 && <>
          <button type="button" className="media-viewer__navigate media-viewer__navigate--previous" onClick={previous} aria-label="Média précédent"><Icon name="chevron_left" /></button>
          <button type="button" className="media-viewer__navigate media-viewer__navigate--next" onClick={next} aria-label="Média suivant"><Icon name="chevron_right" /></button>
          <span className="media-viewer__counter">{activeIndex + 1} / {media.length}</span>
        </>}
      </section>
    </div>}
  </>;
}
