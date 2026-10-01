import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Agent, Message } from "@consilium/core";
import { api } from "../../../../core/api";
import { useTranslation, type Translate } from "../../../../i18n";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { RichText } from "../../../../shared/components/RichText/RichText";
import { useAuthorName } from "../../../../shared/hooks/useAuthorName";
import { formatFileSize } from "../../../../shared/utils/formatFileSize";
import { AgentTypingIndicator } from "../AgentTypingIndicator/AgentTypingIndicator";
import { MediaGallery } from "./MediaGallery";
import "./MessageList.scss";
const formatTime = (value: string, locale: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const fileExtension = (name: string, fallback: string) => name.includes(".") ? name.split(".").pop()?.toUpperCase() : fallback;
const REPLY_TARGET_HIGHLIGHT_DURATION = 1800;
const renderAttachment = (attachment: Message["attachments"][number], t: Translate, locale: string) => {
  if (attachment.mediaType.startsWith("image/") || attachment.mediaType.startsWith("video/")) return null;
  const url = api.attachmentUrl(attachment.id);
  if (attachment.mediaType.startsWith("audio/")) return <div className="message-list__media"><audio src={url} controls preload="metadata" /><a href={url} target="_blank" rel="noreferrer">{attachment.name}</a></div>;
  return <a className="message-list__file" href={api.attachmentUrl(attachment.id, true)} download title={t("messageList.download", { name: attachment.name })}>
    <Icon name="draft" />
    <strong>{attachment.name}</strong>
    <span><small>{fileExtension(attachment.name, t("common.fileKind.file"))}</small><small>{formatFileSize(attachment.size, t, locale)}</small></span>
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

  throw new Error("Copying is not available in this browser.");
};

type CopyFeedback = { messageId: string; status: "copied" | "failed" };

export const MessageList = memo(function MessageList({ messages, typingAgents, hasMoreBefore, loadingOlder, onLoadOlder, onReply, onOpenTopic }: {
  messages: Message[];
  typingAgents: Agent[];
  hasMoreBefore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => Promise<void>;
  onReply: (message: Message) => void;
  onOpenTopic: (topicId: string) => void;
}) {
  const { t, locale } = useTranslation();
  const displayName = useAuthorName();
  const listRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const prependScrollPositionRef = useRef<{ height: number; top: number } | undefined>(undefined);
  const isPrependingRef = useRef(false);
  const messageRefs = useRef(new Map<string, HTMLElement>());
  const bodyRefs = useRef(new Map<string, HTMLDivElement>());
  const copyFeedbackTimerRef = useRef<number | undefined>(undefined);
  const replyTargetHighlightTimerRef = useRef<number | undefined>(undefined);
  const jumpLoadInFlightRef = useRef(false);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>();
  const [highlightedMessageId, setHighlightedMessageId] = useState<string>();
  const [pendingReplyTargetId, setPendingReplyTargetId] = useState<string>();
  let enteringMessageId: string | undefined;

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current) window.clearTimeout(copyFeedbackTimerRef.current);
    if (replyTargetHighlightTimerRef.current) window.clearTimeout(replyTargetHighlightTimerRef.current);
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

  const loadOlder = useCallback(() => {
    const list = listRef.current;
    if (list) {
      prependScrollPositionRef.current = { height: list.scrollHeight, top: list.scrollTop };
      shouldFollowRef.current = false;
      isPrependingRef.current = true;
    }
    return onLoadOlder();
  }, [onLoadOlder]);

  const highlightMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    if (replyTargetHighlightTimerRef.current) window.clearTimeout(replyTargetHighlightTimerRef.current);
    replyTargetHighlightTimerRef.current = window.setTimeout(() => setHighlightedMessageId(undefined), REPLY_TARGET_HIGHLIGHT_DURATION);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const target = messageRefs.current.get(messageId);
    if (!target) return false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
    highlightMessage(messageId);
    return true;
  }, [highlightMessage]);

  const jumpToMessage = useCallback((messageId: string) => {
    if (scrollToMessage(messageId)) return;
    setPendingReplyTargetId(messageId);
  }, [scrollToMessage]);

  useEffect(() => {
    if (!pendingReplyTargetId) return;
    if (scrollToMessage(pendingReplyTargetId)) {
      setPendingReplyTargetId(undefined);
      return;
    }
    if (!hasMoreBefore) {
      setPendingReplyTargetId(undefined);
      return;
    }
    if (loadingOlder || jumpLoadInFlightRef.current) return;
    jumpLoadInFlightRef.current = true;
    void loadOlder()
      .catch(() => undefined)
      .finally(() => {
        jumpLoadInFlightRef.current = false;
      });
  }, [hasMoreBefore, loadingOlder, loadOlder, messages, pendingReplyTargetId, scrollToMessage]);

  useEffect(() => {
    if (messages.length === 0) setPendingReplyTargetId(undefined);
  }, [messages.length]);

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
    <div className="message-list__day"><span>{t("messageList.today")}</span></div>
    {hasMoreBefore && <div className="message-list__history"><button type="button" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? t("messageList.loading") : t("messageList.loadOlder")}</button></div>}
    {messages.map((message) => <article
      className={`message-list__message message-list__message--${message.authorKind}${message.id === enteringMessageId ? " message-list__message--entering" : ""}${message.id === highlightedMessageId ? " message-list__message--highlighted" : ""}`}
      key={message.id}
      ref={(element) => {
        if (element) messageRefs.current.set(message.id, element);
        else messageRefs.current.delete(message.id);
      }}
      tabIndex={-1}
    >
      <div className="message-list__avatar">{displayName(message).slice(0, 2).toUpperCase()}</div>
      <div className="message-list__content">
        <header><strong>{displayName(message)}</strong><span>{formatTime(message.createdAt, locale)}</span>{message.authorKind === "agent" && <em>{t("messageList.agentBadge")}</em>}</header>
        {message.replyTo && <button
          className="message-list__reply"
          type="button"
          onClick={() => jumpToMessage(message.replyTo!.id)}
          aria-label={t("messageList.reply.jumpLabel", { name: displayName(message.replyTo) })}
          title={t("messageList.reply.jumpTitle")}
        ><Icon name="reply" /><span><strong>{displayName(message.replyTo)}</strong><small>{message.replyTo.body || t("common.attachment")}</small></span></button>}
        {message.attachments.length > 0 && <><MediaGallery attachments={message.attachments} /><div className="message-list__attachments">{message.attachments.filter((attachment) => !attachment.mediaType.startsWith("image/") && !attachment.mediaType.startsWith("video/")).map((attachment) => <div key={attachment.id}>{renderAttachment(attachment, t, locale)}</div>)}</div></>}
        {message.body && <div
          ref={(element) => {
            if (element) bodyRefs.current.set(message.id, element);
            else bodyRefs.current.delete(message.id);
          }}
          className="message-list__body"
        ><RichText topicReferences={message.topicMentions} onTopicReference={onOpenTopic}>{message.body}</RichText></div>}
        <div className="message-list__actions">
          <button className="message-list__action message-list__reply-action" type="button" onClick={() => onReply(message)} aria-label={t("messageList.reply.actionLabel", { name: displayName(message) })}><Icon name="reply" />{t("messageList.reply.action")}</button>
          {message.body && <button
            className={`message-list__action message-list__copy-action${copyFeedback?.messageId === message.id ? ` message-list__copy-action--${copyFeedback.status}` : ""}`}
            type="button"
            onClick={() => void copyMessage(message)}
            aria-label={copyFeedback?.messageId === message.id ? t(copyFeedback.status === "copied" ? "messageList.copy.copiedLabel" : "messageList.copy.failedLabel") : t("messageList.copy.label")}
            title={copyFeedback?.messageId === message.id ? t(copyFeedback.status === "copied" ? "messageList.copy.copiedLabel" : "messageList.copy.failedLabel") : t("messageList.copy.title")}
          ><Icon name={copyFeedback?.messageId === message.id && copyFeedback.status === "copied" ? "check" : "content_copy"} />{copyFeedback?.messageId === message.id ? t(copyFeedback.status === "copied" ? "messageList.copy.copied" : "messageList.copy.failed") : t("messageList.copy.action")}</button>}
        </div>
      </div>
    </article>)}
    <AgentTypingIndicator agents={typingAgents} onHeightSettled={() => {
      const list = listRef.current;
      if (list && shouldFollowRef.current) list.scrollTop = list.scrollHeight;
    }} />
  </div>;
});
