import { useRef, useState } from "react";
import type { Agent } from "@consilium/core";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { MentionSuggestions } from "./components/MentionSuggestions/MentionSuggestions";
import "./MessageComposer.scss";
interface MentionContext { start: number; end: number; query: string; }
const connectedStatuses = new Set<Agent["status"]>(["online", "listening", "working"]);

export function MessageComposer({ agents, disabled, onSend }: { agents: Agent[]; disabled?: boolean; onSend: (body: string, files: File[]) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [mentionContext, setMentionContext] = useState<MentionContext>();
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionAgents = agents
    .filter((agent) => connectedStatuses.has(agent.status))
    .filter((agent) => !mentionContext?.query || agent.id.includes(mentionContext.query) || agent.name.toLowerCase().includes(mentionContext.query))
    .slice(0, 8);

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
    if (!body.trim() && !files.length) return;
    await onSend(body.trim() || "Média partagé", files);
    setBody(""); setFiles([]);
  };
  return <div className="message-composer">
    <div className="message-composer__box">
      <textarea
        ref={textareaRef}
        value={body}
        disabled={disabled}
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
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); }
        }}
        placeholder="Écrivez un message… Tapez @ pour mentionner un agent"
        aria-label="Votre message"
        aria-autocomplete="list"
        aria-controls={mentionContext && mentionAgents.length ? "mention-suggestions" : undefined}
        aria-activedescendant={mentionContext && mentionAgents.length ? `mention-option-${mentionAgents[activeMentionIndex]?.id}` : undefined}
      />
      {mentionContext && mentionAgents.length > 0 && <MentionSuggestions agents={mentionAgents} activeIndex={activeMentionIndex} onSelect={selectMention} />}
      {files.length > 0 && <div className="message-composer__files">{files.map((file, index) => <span key={`${file.name}-${index}`}><Icon name="draft" />{file.name}<button onClick={() => setFiles((current) => current.filter((_, candidate) => candidate !== index))} aria-label={`Retirer ${file.name}`}><Icon name="close" /></button></span>)}</div>}
      <input ref={inputRef} className="message-composer__file-input" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json" onChange={(event) => { setFiles((current) => [...current, ...Array.from(event.target.files || [])]); event.target.value = ""; }} />
      <div className="message-composer__tools"><button onClick={() => inputRef.current?.click()} aria-label="Joindre des médias"><Icon name="attach_file" /></button><button aria-label="Insérer du code"><Icon name="code" /></button><span>25 Mo maximum par fichier</span><button className="message-composer__send" disabled={(!body.trim() && !files.length) || disabled} onClick={() => void submit()} aria-label="Envoyer"><Icon name="arrow_upward" /></button></div>
    </div>
    <small>Les agents mentionnés recevront ce message via MCP.</small>
  </div>;
}
