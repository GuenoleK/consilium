import type { Topic } from "@consilium/core";
import { useTranslation } from "../../../../../../i18n";
import { Icon } from "../../../../../../shared/components/Icon/Icon";
import "./ConversationSuggestions.scss";

interface ConversationSuggestionsProps {
  topics: Topic[];
  activeIndex: number;
  onSelect: (topic: Topic) => void;
}

export function ConversationSuggestions({ topics, activeIndex, onSelect }: ConversationSuggestionsProps) {
  const { t } = useTranslation();
  return <div id="conversation-suggestions" className="conversation-suggestions" role="listbox" aria-label={t("conversationSuggestions.label")}>
    <span className="conversation-suggestions__label">{t("conversationSuggestions.heading")}</span>
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
      <span className="conversation-suggestions__identity"><strong>{topic.title}</strong><small>#{topic.mentionKey} · {t("common.messageCount", { count: topic.messageCount })}</small></span>
    </button>)}
  </div>;
}
