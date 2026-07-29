import { memo, useLayoutEffect, useRef } from "react";
import type { Message } from "@consilium/core";
import { api } from "../../../../core/api";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { RichText } from "../../../../shared/components/RichText/RichText";
import "./MessageList.scss";
const time = (value: string) => new Intl.DateTimeFormat("fr", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const fileExtension = (name: string) => name.includes(".") ? name.split(".").pop()?.toUpperCase() : "FICHIER";
const renderAttachment = (attachment: Message["attachments"][number]) => {
  const url = api.attachmentUrl(attachment.id);
  if (attachment.mediaType.startsWith("image/")) return <a className="message-list__media message-list__media--image" href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.name} loading="lazy" decoding="async" /><span>{attachment.name}</span></a>;
  if (attachment.mediaType.startsWith("video/")) return <div className="message-list__media"><video src={url} controls preload="none" /><a href={url} target="_blank" rel="noreferrer">{attachment.name}</a></div>;
  if (attachment.mediaType.startsWith("audio/")) return <div className="message-list__media"><audio src={url} controls preload="metadata" /><a href={url} target="_blank" rel="noreferrer">{attachment.name}</a></div>;
  return <a className="message-list__file" href={api.attachmentUrl(attachment.id, true)} download title={`Télécharger ${attachment.name}`}>
    <Icon name="draft" />
    <strong>{attachment.name}</strong>
    <span><small>{fileExtension(attachment.name)}</small><small>{Math.ceil(attachment.size / 1024)} Ko</small></span>
    <Icon name="download" />
  </a>;
};
export const MessageList = memo(function MessageList({ messages, hasMoreBefore, loadingOlder, onLoadOlder, onReply }: {
  messages: Message[];
  hasMoreBefore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReply: (message: Message) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const prependScrollPositionRef = useRef<{ height: number; top: number } | undefined>(undefined);
  const isPrependingRef = useRef(false);
  let enteringMessageId: string | undefined;

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

  const loadOlder = () => {
    const list = listRef.current;
    if (list) {
      prependScrollPositionRef.current = { height: list.scrollHeight, top: list.scrollTop };
      shouldFollowRef.current = false;
      isPrependingRef.current = true;
    }
    onLoadOlder();
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
        {message.attachments.length > 0 && <div className="message-list__attachments">{message.attachments.map((attachment) => <div key={attachment.id}>{renderAttachment(attachment)}</div>)}</div>}
        {message.body && <div className="message-list__body"><RichText>{message.body}</RichText></div>}
        <button className="message-list__reply-action" type="button" onClick={() => onReply(message)} aria-label={`Répondre au message de ${message.authorName}`}><Icon name="reply" />Répondre</button>
      </div>
    </article>)}
  </div>;
});
