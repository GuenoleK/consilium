import type { Agent } from "@consilium/core";
import { useTranslation } from "../../../../i18n";

interface AgentTypingIndicatorItemProps {
  agent: Agent;
  color: "blue" | "purple";
  leaving: boolean;
  onExit: (agentId: string) => void;
}

export function AgentTypingIndicatorItem({ agent, color, leaving, onExit }: AgentTypingIndicatorItemProps) {
  const { t } = useTranslation();
  return <article className={`agent-typing-indicator__item${leaving ? " agent-typing-indicator__item--leaving" : ""}`} role="status" onAnimationEnd={(event) => { if (leaving && event.currentTarget === event.target) onExit(agent.id); }}>
    <span className={`agent-typing-indicator__avatar agent-typing-indicator__avatar--${color}`} aria-hidden="true">{agent.name.slice(0, 2).toUpperCase()}</span>
    <div className="agent-typing-indicator__content">
      <header><strong>{agent.name}</strong><small>{t("agentTypingIndicator.status")}</small></header>
      <span className="agent-typing-indicator__bubble" aria-label={t("agentTypingIndicator.typing", { name: agent.name })}>
        <i /><i /><i />
      </span>
    </div>
  </article>;
}
