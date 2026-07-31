import { useEffect, useState } from "react";
import type { Agent } from "@consilium/core";
import { AgentTypingIndicatorItem } from "./AgentTypingIndicatorItem";
import "./AgentTypingIndicator.scss";

interface AgentTypingIndicatorProps {
  agents: Agent[];
  onHeightSettled: () => void;
}

interface RenderedTypingAgent {
  agent: Agent;
  leaving: boolean;
}

export function AgentTypingIndicator({ agents, onHeightSettled }: AgentTypingIndicatorProps) {
  const [renderedAgents, setRenderedAgents] = useState<RenderedTypingAgent[]>(() => agents.map((agent) => ({ agent, leaving: false })));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRenderedAgents(agents.map((agent) => ({ agent, leaving: false })));
      return;
    }

    setRenderedAgents((current) => {
      const nextById = new Map(agents.map((agent) => [agent.id, agent]));
      const retained = current.map(({ agent }) => {
        const nextAgent = nextById.get(agent.id);
        return nextAgent ? { agent: nextAgent, leaving: false } : { agent, leaving: true };
      });
      const retainedIds = new Set(retained.map(({ agent }) => agent.id));
      return [...retained, ...agents.filter((agent) => !retainedIds.has(agent.id)).map((agent) => ({ agent, leaving: false }))];
    });
  }, [agents]);

  return <div className={`agent-typing-indicator${renderedAgents.length ? " agent-typing-indicator--active" : ""}`} aria-label="Agents en réflexion" aria-live={agents.length ? "polite" : undefined} onTransitionEnd={(event) => { if (event.target === event.currentTarget && event.propertyName === "max-height") onHeightSettled(); }}>
    {renderedAgents.map(({ agent, leaving }, index) => <AgentTypingIndicatorItem agent={agent} color={index % 2 ? "purple" : "blue"} leaving={leaving} onExit={(agentId) => setRenderedAgents((current) => current.filter(({ agent: currentAgent }) => currentAgent.id !== agentId))} key={agent.id} />)}
  </div>;
}
