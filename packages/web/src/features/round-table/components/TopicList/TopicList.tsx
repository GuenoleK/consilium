import type { Topic } from "@consilium/core";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { useSpinCycle } from "../../../../shared/hooks/useSpinCycle";
import "./TopicList.scss";

interface TopicListProps { topics: Topic[]; activeId?: string; onSelect: (id: string) => void; onCreate: () => void; onSync: () => Promise<void>; onMobileClose?: () => void; }
export function TopicList({ topics, activeId, onSelect, onCreate, onSync, onMobileClose }: TopicListProps) {
  const { spinning: syncing, runSpinCycle } = useSpinCycle();
  return <aside className="topic-list">
    <div className="topic-list__brand"><span className="topic-list__crest">C</span><div><strong>Consilium</strong><small>La table ronde</small></div><button className="topic-list__mobile-close" onClick={onMobileClose} aria-label="Fermer les sujets"><Icon name="close" /></button></div>
    <button className="topic-list__create" onClick={onCreate}><Icon name="add" />Nouveau sujet</button>
    <div className="topic-list__heading"><span>Sujets</span><span className="topic-list__count">{topics.length}</span></div>
    <nav className="topic-list__items" aria-label="Sujets de discussion">
      {topics.map((topic) => <button key={topic.id} className={`topic-list__item${topic.id === activeId ? " topic-list__item--active" : ""}`} onClick={() => onSelect(topic.id)}>
        <span className="topic-list__item-icon"><Icon name="forum" filled={topic.id === activeId} /></span>
        <span className="topic-list__item-copy"><strong>{topic.title}</strong><small>{topic.messageCount} message{topic.messageCount !== 1 ? "s" : ""}</small></span>
      </button>)}
    </nav>
    <div className="topic-list__footer">
      <span className="topic-list__footer-icon"><Icon name="hub" /></span>
      <span className="topic-list__footer-copy"><strong>MCP connecté</strong><small>Contexte partagé en direct</small></span>
      <span className="topic-list__footer-controls"><button className={syncing ? "topic-list__sync topic-list__sync--loading" : "topic-list__sync"} disabled={syncing} onClick={() => void runSpinCycle(onSync)} aria-label="Synchroniser Consilium" title="Synchroniser les sujets, messages, tâches et agents"><Icon name="sync" /></button></span>
    </div>
  </aside>;
}
