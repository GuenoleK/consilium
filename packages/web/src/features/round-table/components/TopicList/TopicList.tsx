import type { Topic } from "@consilium/core";
import { Icon } from "../../../../shared/components/Icon/Icon";
import "./TopicList.scss";

interface TopicListProps { topics: Topic[]; activeId?: string; unreadTopicIds: Set<string>; onSelect: (id: string) => void; onCreate: () => void; onMobileClose?: () => void; }
export function TopicList({ topics, activeId, unreadTopicIds, onSelect, onCreate, onMobileClose }: TopicListProps) {
  return <aside className="topic-list">
    <div className="topic-list__brand"><span className="topic-list__crest">C</span><div><strong>Consilium</strong><small>La table ronde</small></div><button className="topic-list__mobile-close" onClick={onMobileClose} aria-label="Fermer les sujets"><Icon name="close" /></button></div>
    <button className="topic-list__create" onClick={onCreate}><Icon name="add" />Nouveau sujet</button>
    <div className="topic-list__heading"><span>Sujets</span><span className="topic-list__count">{topics.length}</span></div>
    <nav className="topic-list__items" aria-label="Sujets de discussion">
      {topics.map((topic) => {
        const unread = unreadTopicIds.has(topic.id);
        return <button key={topic.id} className={`topic-list__item${topic.id === activeId ? " topic-list__item--active" : ""}`} onClick={() => onSelect(topic.id)} aria-label={`${topic.title}${unread ? " · Messages non lus" : ""}`}>
          <span className="topic-list__item-icon"><Icon name="forum" filled={topic.id === activeId} /></span>
          <span className="topic-list__item-copy"><strong>{topic.title}</strong><small>{topic.messageCount} message{topic.messageCount !== 1 ? "s" : ""}</small></span>
          {unread && <span className="topic-list__unread" aria-hidden="true" />}
        </button>;
      })}
    </nav>
  </aside>;
}
