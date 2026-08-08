import type { Topic } from "@consilium/core";
import { Icon } from "../../../../../../shared/components/Icon/Icon";
import "./ConversationSuggestions.scss";

interface ConversationSuggestionsProps {
  topics: Topic[];
  activeIndex: number;
  onSelect: (topic: Topic) => void;
}

export function ConversationSuggestions({ topics, activeIndex, onSelect }: ConversationSuggestionsProps) {
  return <div id="conversation-suggestions" className="conversation-suggestions" role="listbox" aria-label="Conversations à référencer">
    <span className="conversation-suggestions__label">Référencer une conversation</span>
    {topics.map((topic, index) => <button
      id={`conversation-option-${topic.mentionKey}`}
      className={`conversation-suggestions__item${index === activeIndex ? " conversation-suggestions__item--active" : ""}`}
      key={topic.id}
      role="option"
      aria-selected={index === activeIndex}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(topic)}
    >
      <span className="conversation-suggestions__icon"><Icon name="forum" /></span>
      <span className="conversation-suggestions__identity"><strong>{topic.title}</strong><small>#{topic.mentionKey} · {topic.messageCount} message{topic.messageCount === 1 ? "" : "s"}</small></span>
    </button>)}
  </div>;
}
