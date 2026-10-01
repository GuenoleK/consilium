import type { Topic } from "@consilium/core";
import { useTranslation } from "../../../../i18n";
import { Icon } from "../../../../shared/components/Icon/Icon";
import "./TopicList.scss";

interface TopicListProps { topics: Topic[]; activeId?: string; unreadTopicIds: Set<string>; onSelect: (id: string) => void; onCreate: () => void; onMobileClose?: () => void; }
export function TopicList({ topics, activeId, unreadTopicIds, onSelect, onCreate, onMobileClose }: TopicListProps) {
  const { t } = useTranslation();
  return <aside className="topic-list">
    <div className="topic-list__brand"><span className="topic-list__crest">C</span><div><strong>Consilium</strong><small>{t("topicList.brand.tagline")}</small></div><button className="topic-list__mobile-close" onClick={onMobileClose} aria-label={t("topicList.mobileClose")}><Icon name="close" /></button></div>
    <button className="topic-list__create" onClick={onCreate}><Icon name="add" />{t("topicList.create")}</button>
    <div className="topic-list__heading"><span>{t("topicList.heading")}</span><span className="topic-list__count">{topics.length}</span></div>
    <nav className="topic-list__items" aria-label={t("topicList.navigation")}>
      {topics.map((topic) => {
        const unread = unreadTopicIds.has(topic.id);
        return <button key={topic.id} className={`topic-list__item${topic.id === activeId ? " topic-list__item--active" : ""}`} onClick={() => onSelect(topic.id)} aria-label={unread ? t("topicList.itemUnread", { title: topic.title }) : topic.title}>
          <span className="topic-list__item-icon"><Icon name="forum" filled={topic.id === activeId} /></span>
          <span className="topic-list__item-copy"><strong>{topic.title}</strong><small>{t("common.messageCount", { count: topic.messageCount })}</small></span>
          {unread && <span className="topic-list__unread" aria-hidden="true" />}
        </button>;
      })}
    </nav>
  </aside>;
}
