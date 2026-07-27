import type { Agent } from "@consilium/core";
import "./MentionSuggestions.scss";

interface MentionSuggestionsProps {
  agents: Agent[];
  activeIndex: number;
  onSelect: (agent: Agent) => void;
}

const initials = (name: string) => name.slice(0, 2).toUpperCase();

export function MentionSuggestions({ agents, activeIndex, onSelect }: MentionSuggestionsProps) {
  return <div id="mention-suggestions" className="mention-suggestions" role="listbox" aria-label="Agents connectés">
    <span className="mention-suggestions__label">Mentionner un agent</span>
    {agents.map((agent, index) => <button
      id={`mention-option-${agent.id}`}
      className={`mention-suggestions__item${index === activeIndex ? " mention-suggestions__item--active" : ""}`}
      key={agent.id}
      role="option"
      aria-selected={index === activeIndex}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(agent)}
    >
      <span className="mention-suggestions__avatar">{initials(agent.name)}</span>
      <span className="mention-suggestions__identity"><strong>{agent.name}</strong><small>@{agent.id} · {agent.model || "Modèle non déclaré"}</small></span>
      <i className={`mention-suggestions__status mention-suggestions__status--${agent.status}`} />
    </button>)}
  </div>;
}
