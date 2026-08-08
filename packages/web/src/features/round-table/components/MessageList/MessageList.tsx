import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Agent, Message } from "@consilium/core";
import { api } from "../../../../core/api";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { RichText } from "../../../../shared/components/RichText/RichText";
import { AgentTypingIndicator } from "../AgentTypingIndicator/AgentTypingIndicator";
import { MediaGallery } from "./MediaGallery";
import "./MessageList.scss";
const time = (value: string) => new Intl.DateTimeFormat("fr", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const fileExtension = (name: string) => name.includes(".") ? name.split(".").pop()?.toUpperCase() : "FICHIER";
const renderAttachment = (attachment: Message["attachments"][number]) => {
  if (attachment.mediaType.startsWith("image/") || attachment.mediaType.startsWith("video/")) return null;
  const url = api.attachmentUrl(attachment.id);
  if (attachment.mediaType.startsWith("audio/")) return <div className="message-list__media"><audio src={url} controls preload="metadata" /><a href={url} target="_blank" rel="noreferrer">{attachment.name}</a></div>;
  return <a className="message-list__file" href={api.attachmentUrl(attachment.id, true)} download title={`Télécharger ${attachment.name}`}>
    <Icon name="draft" />
    <strong>{attachment.name}</strong>
    <span><small>{fileExtension(attachment.name)}</small><small>{Math.ceil(attachment.size / 1024)} Ko</small></span>
    <Icon name="download" />
  </a>;
};
const copyRenderedRichText = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) return false;
  const previousRanges = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);

  try {
    return document.execCommand("copy");
  } finally {
    selection.removeAllRanges();
    previousRanges.forEach((previousRange) => selection.addRange(previousRange));
    activeElement?.focus({ preventScroll: true });
  }
};

const copyRichText = async (element: HTMLElement, fallback: string) => {
  const html = element.querySelector(".rich-text")?.innerHTML || element.innerHTML;
  const text = fallback.trim();

  try {
    if (copyRenderedRichText(element)) return;
  } catch {
    // Continue with the asynchronous Clipboard API below.
  }

  if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function") {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]);
      return;
    } catch {
      // Fall back to the plain-text Clipboard API below.
    }
  }

  if (typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Report an unsupported clipboard operation below.
    }
  }

  throw new Error("La copie n'est pas disponible dans ce navigateur.");
};

type CopyFeedback = { messageId: string; status: "copied" | "failed" };

export const MessageList = memo(function MessageList({ messages, typingAgents, hasMoreBefore, loadingOlder, onLoadOlder, onReply, onOpenTopic }: {
  messages: Message[];
  typingAgents: Agent[];
  hasMoreBefore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReply: (message: Message) => void;
  onOpenTopic: (topicId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const prependScrollPositionRef = useRef<{ height: number; top: number } | undefined>(undefined);
  const isPrependingRef = useRef(false);
  const bodyRefs = useRef(new Map<string, HTMLDivElement>());
  const copyFeedbackTimerRef = useRef<number | undefined>(undefined);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>();
  let enteringMessageId: string | undefined;

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current) window.clearTimeout(copyFeedbackTimerRef.current);
  }, []);

  if (initializedRef.current && !isPrependingRef.current && document.visibilityState === "visible") {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (!knownMessageIdsRef.current.has(messages[index].id)) {
        enteringMessageId = messages[index].id;
        break;
      }
    }
  }

  useLayoutEffect(() => {
    const list = listRef.current;
    const previousPosition = prependScrollPositionRef.current;
    if (list && previousPosition) {
      list.scrollTop = previousPosition.top + list.scrollHeight - previousPosition.height;
      prependScrollPositionRef.current = undefined;
      isPrependingRef.current = false;
    } else if (list && shouldFollowRef.current) list.scrollTop = list.scrollHeight;
    knownMessageIdsRef.current = new Set(messages.map((message) => message.id));
    initializedRef.current = true;
  }, [messages]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && shouldFollowRef.current && !prependScrollPositionRef.current) list.scrollTop = list.scrollHeight;
  }, [typingAgents]);

  const loadOlder = () => {
    const list = listRef.current;
    if (list) {
      prependScrollPositionRef.current = { height: list.scrollHeight, top: list.scrollTop };
      shouldFollowRef.current = false;
      isPrependingRef.current = true;
    }
    onLoadOlder();
  };

  const copyMessage = async (message: Message) => {
    const bodyElement = bodyRefs.current.get(message.id);
    if (!bodyElement || !message.body) return;

    try {
      await copyRichText(bodyElement, message.body);
      setCopyFeedback({ messageId: message.id, status: "copied" });
    } catch {
      setCopyFeedback({ messageId: message.id, status: "failed" });
    }
    if (copyFeedbackTimerRef.current) window.clearTimeout(copyFeedbackTimerRef.current);
    copyFeedbackTimerRef.current = window.setTimeout(() => setCopyFeedback(undefined), 1800);
  };

  return <div
    className="message-list"
    ref={listRef}
    onScroll={(event) => {
      const list = event.currentTarget;
      shouldFollowRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    }}
  >
    <div className="message-list__day"><span>Aujourd’hui</span></div>
    {hasMoreBefore && <div className="message-list__history"><button type="button" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? "Chargement…" : "Afficher les messages précédents"}</button></div>}
    {messages.map((message) => <article className={`message-list__message message-list__message--${message.authorKind}${message.id === enteringMessageId ? " message-list__message--entering" : ""}`} key={message.id}>
      <div className="message-list__avatar">{message.authorKind === "human" ? "VO" : message.authorName.slice(0, 2).toUpperCase()}</div>
      <div className="message-list__content">
        <header><strong>{message.authorName}</strong><span>{time(message.createdAt)}</span>{message.authorKind === "agent" && <em>Agent</em>}</header>
        {message.replyTo && <div className="message-list__reply"><Icon name="reply" /><span><strong>{message.replyTo.authorName}</strong><small>{message.replyTo.body || "Pièce jointe"}</small></span></div>}
        {message.attachments.length > 0 && <><MediaGallery attachments={message.attachments} /><div className="message-list__attachments">{message.attachments.filter((attachment) => !attachment.mediaType.startsWith("image/") && !attachment.mediaType.startsWith("video/")).map((attachment) => <div key={attachment.id}>{renderAttachment(attachment)}</div>)}</div></>}
        {message.body && <div
          ref={(element) => {
            if (element) bodyRefs.current.set(message.id, element);
            else bodyRefs.current.delete(message.id);
          }}
          className="message-list__body"
        ><RichText topicReferences={message.topicMentions} onTopicReference={onOpenTopic}>{message.body}</RichText></div>}
        <div className="message-list__actions">
          <button className="message-list__action message-list__reply-action" type="button" onClick={() => onReply(message)} aria-label={`Répondre au message de ${message.authorName}`}><Icon name="reply" />Répondre</button>
          {message.body && <button
            className={`message-list__action message-list__copy-action${copyFeedback?.messageId === message.id ? ` message-list__copy-action--${copyFeedback.status}` : ""}`}
            type="button"
            onClick={() => void copyMessage(message)}
            aria-label={copyFeedback?.messageId === message.id ? (copyFeedback.status === "copied" ? "Réponse copiée" : "Échec de la copie") : "Copier la réponse"}
            title={copyFeedback?.messageId === message.id ? (copyFeedback.status === "copied" ? "Réponse copiée" : "Échec de la copie") : "Copier la réponse avec sa mise en forme"}
          ><Icon name={copyFeedback?.messageId === message.id && copyFeedback.status === "copied" ? "check" : "content_copy"} />{copyFeedback?.messageId === message.id ? (copyFeedback.status === "copied" ? "Copié" : "Échec") : "Copier"}</button>}
        </div>
      </div>
    </article>)}
    <AgentTypingIndicator agents={typingAgents} onHeightSettled={() => {
      const list = listRef.current;
      if (list && shouldFollowRef.current) list.scrollTop = list.scrollHeight;
    }} />
  </div>;
});
