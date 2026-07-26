import { useLayoutEffect, useRef } from "react";
import type { Message } from "@consilium/core";
import { api } from "../../../../core/api";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { RichText } from "../../../../shared/components/RichText/RichText";
import "./MessageList.scss";
const time = (value: string) => new Intl.DateTimeFormat("fr", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const renderAttachment = (attachment: Message["attachments"][number]) => {
  const url = api.attachmentUrl(attachment.id);
  if (attachment.mediaType.startsWith("image/")) return <a className="message-list__media message-list__media--image" href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.name} /><span>{attachment.name}</span></a>;
  if (attachment.mediaType.startsWith("video/")) return <div className="message-list__media"><video src={url} controls preload="metadata" /><a href={url} target="_blank" rel="noreferrer">{attachment.name}</a></div>;
  if (attachment.mediaType.startsWith("audio/")) return <div className="message-list__media"><audio src={url} controls preload="metadata" /><a href={url} target="_blank" rel="noreferrer">{attachment.name}</a></div>;
  return <a className="message-list__file" href={url} target="_blank" rel="noreferrer"><Icon name="draft" /><span><strong>{attachment.name}</strong><small>{Math.ceil(attachment.size / 1024)} Ko</small></span><Icon name="download" /></a>;
};
export function MessageList({ messages }: { messages: Message[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && shouldFollowRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  return <div
    className="message-list"
    ref={listRef}
    onScroll={(event) => {
      const list = event.currentTarget;
      shouldFollowRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    }}
  >
    <div className="message-list__day"><span>Aujourd’hui</span></div>
    {messages.map((message) => <article className={`message-list__message message-list__message--${message.authorKind}`} key={message.id}>
      <div className="message-list__avatar">{message.authorKind === "human" ? "VO" : message.authorName.slice(0, 2).toUpperCase()}</div>
      <div className="message-list__content"><header><strong>{message.authorName}</strong><span>{time(message.createdAt)}</span>{message.authorKind === "agent" && <em>Agent</em>}</header><div className="message-list__body"><RichText>{message.body}</RichText></div>{message.attachments.length > 0 && <div className="message-list__attachments">{message.attachments.map((attachment) => <div key={attachment.id}>{renderAttachment(attachment)}</div>)}</div>}</div>
    </article>)}
  </div>;
}
