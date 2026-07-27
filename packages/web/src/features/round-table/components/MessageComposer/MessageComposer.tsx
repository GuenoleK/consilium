import { useRef, useState } from "react";
import type { Agent } from "@consilium/core";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { AttachmentList } from "./components/AttachmentList/AttachmentList";
import { MentionSuggestions } from "./components/MentionSuggestions/MentionSuggestions";
import "./MessageComposer.scss";

interface MentionContext { start: number; end: number; query: string; }
const connectedStatuses = new Set<Agent["status"]>(["online", "listening", "working"]);
const maximumFileSize = 25 * 1024 * 1024;

export function MessageComposer({ agents, disabled, onSend }: { agents: Agent[]; disabled?: boolean; onSend: (body: string, files: File[]) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [mentionContext, setMentionContext] = useState<MentionContext>();
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionAgents = agents
    .filter((agent) => connectedStatuses.has(agent.status))
    .filter((agent) => !mentionContext?.query || agent.id.includes(mentionContext.query) || agent.name.toLowerCase().includes(mentionContext.query))
    .slice(0, 8);

  const addFiles = (candidates: File[]) => {
    const accepted = candidates.filter((file) => file.size <= maximumFileSize);
    setFiles((current) => [...current, ...accepted]);
    setFileError(accepted.length === candidates.length ? "" : "Un fichier dépasse la limite de 25 Mo.");
  };
  const updateMentionContext = (value: string, cursor: number) => {
    const match = value.slice(0, cursor).match(/(?:^|\s)@([\p{L}\p{N}_-]*)$/u);
    setMentionContext(match ? { start: cursor - match[1].length - 1, end: cursor, query: match[1].toLowerCase() } : undefined);
    setActiveMentionIndex(0);
  };
  const selectMention = (agent: Agent) => {
    if (!mentionContext) return;
    const nextBody = `${body.slice(0, mentionContext.start)}@${agent.id} ${body.slice(mentionContext.end)}`;
    const cursor = mentionContext.start + agent.id.length + 2;
    setBody(nextBody);
    setMentionContext(undefined);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };
  const submit = async () => {
    if (isSending || (!body.trim() && !files.length)) return;
    const startedAt = Date.now();
    setIsSending(true);
    try {
      await onSend(body.trim() || "Fichier partagé", files);
      const remainingFeedbackTime = Math.max(0, 450 - (Date.now() - startedAt));
      if (remainingFeedbackTime) await new Promise((resolve) => window.setTimeout(resolve, remainingFeedbackTime));
      setBody("");
      setFiles([]);
      setFileError("");
    } finally {
      setIsSending(false);
    }
  };

  return <div className="message-composer">
    <div
      className={`message-composer__box${isDraggingFiles ? " message-composer__box--dragging" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setIsDraggingFiles(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFiles(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingFiles(false);
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {files.length > 0 && <AttachmentList files={files} onRemove={(index) => setFiles((current) => current.filter((_, candidate) => candidate !== index))} />}
      <textarea
        ref={textareaRef}
        value={body}
        disabled={disabled || isSending}
        onChange={(event) => { setBody(event.target.value); updateMentionContext(event.target.value, event.target.selectionStart); }}
        onClick={(event) => updateMentionContext(event.currentTarget.value, event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (mentionContext && mentionAgents.length) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActiveMentionIndex((current) => (current + (event.key === "ArrowDown" ? 1 : mentionAgents.length - 1)) % mentionAgents.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault(); selectMention(mentionAgents[activeMentionIndex]); return;
            }
            if (event.key === "Escape") { event.preventDefault(); setMentionContext(undefined); return; }
          }
          const isMobileComposer = window.matchMedia("(max-width: 720px)").matches;
          if (event.key === "Enter" && !event.shiftKey && !isMobileComposer && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder="Écrivez un message… Tapez @ pour mentionner un agent"
        aria-label="Votre message"
        aria-autocomplete="list"
        aria-controls={mentionContext && mentionAgents.length ? "mention-suggestions" : undefined}
        aria-activedescendant={mentionContext && mentionAgents.length ? `mention-option-${mentionAgents[activeMentionIndex]?.id}` : undefined}
      />
      {mentionContext && mentionAgents.length > 0 && <MentionSuggestions agents={mentionAgents} activeIndex={activeMentionIndex} onSelect={selectMention} />}
      <input ref={inputRef} className="message-composer__file-input" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json" onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
      {isDraggingFiles && <div className="message-composer__drop-hint"><Icon name="upload_file" />Déposer les fichiers ici</div>}
      <div className="message-composer__tools">
        <button type="button" disabled={isSending} onClick={() => inputRef.current?.click()} aria-label="Joindre des fichiers"><Icon name="add" /></button>
        <button type="button" disabled={isSending} aria-label="Insérer du code"><Icon name="code" /></button>
        <span className={fileError ? "message-composer__limit message-composer__limit--error" : "message-composer__limit"} role={fileError ? "alert" : undefined}>{fileError || "25 Mo maximum par fichier"}</span>
        <button type="button" className={`message-composer__send${isSending ? " message-composer__send--sending" : ""}`} disabled={(!body.trim() && !files.length) || disabled || isSending} onClick={() => void submit()} aria-label={isSending ? "Envoi en cours" : "Envoyer"} aria-busy={isSending}><Icon name="arrow_upward" /></button>
      </div>
    </div>
    <small>Les agents mentionnés reçoivent le message et peuvent ouvrir ses fichiers via MCP.</small>
  </div>;
}
