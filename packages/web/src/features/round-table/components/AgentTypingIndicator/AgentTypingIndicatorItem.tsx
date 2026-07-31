import type { Agent } from "@consilium/core";

interface AgentTypingIndicatorItemProps {
  agent: Agent;
  color: "blue" | "purple";
  leaving: boolean;
  onExit: (agentId: string) => void;
}

export function AgentTypingIndicatorItem({ agent, color, leaving, onExit }: AgentTypingIndicatorItemProps) {
  return <article className={`agent-typing-indicator__item${leaving ? " agent-typing-indicator__item--leaving" : ""}`} role="status" onAnimationEnd={(event) => { if (leaving && event.currentTarget === event.target) onExit(agent.id); }}>
    <span className={`agent-typing-indicator__avatar agent-typing-indicator__avatar--${color}`} aria-hidden="true">{agent.name.slice(0, 2).toUpperCase()}</span>
    <div className="agent-typing-indicator__content">
      <header><strong>{agent.name}</strong><small>En réflexion</small></header>
      <span className="agent-typing-indicator__bubble" aria-label={`${agent.name} est en train d'écrire`}>
        <i /><i /><i />
      </span>
    </div>
  </article>;
}
