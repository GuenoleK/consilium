import type { Agent, ConsiliumTask } from "@consilium/core";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { useSpinCycle } from "../../../../shared/hooks/useSpinCycle";
import { TaskQueue } from "../TaskQueue/TaskQueue";
import "./AgentPanel.scss";
const initials = (name: string) => name.slice(0, 2).toUpperCase();
const statusLabels: Record<Agent["status"], string> = {
  online: "Connecté",
  listening: "En écoute",
  working: "En réflexion",
  away: "Inactif",
  offline: "Déconnecté",
};
interface AgentPanelProps {
  agents: Agent[];
  activeTopicId?: string;
  tasks: ConsiliumTask[];
  onDisconnect: (id: string) => void;
  onRefreshAgents: () => Promise<void>;
  onCreateTask: (input: { title: string; description: string; assignedAgentId?: string }) => Promise<void>;
  onTaskInstruction: (taskId: string, body: string) => Promise<void>;
  onResolveApproval: (taskId: string, approvalId: string, decision: "approved" | "rejected", note?: string) => Promise<void>;
  onCancelTask: (taskId: string) => void | Promise<void>;
  onArchiveTask: (taskId: string) => Promise<void>;
  onUnarchiveTask: (taskId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
  onClose?: () => void;
  onMobileClose?: () => void;
}
export function AgentPanel({ agents, activeTopicId, tasks, onDisconnect, onRefreshAgents, onCreateTask, onTaskInstruction, onResolveApproval, onCancelTask, onArchiveTask, onUnarchiveTask, onDeleteTask, onClose, onMobileClose }: AgentPanelProps) {
  const { spinning: refreshing, runSpinCycle } = useSpinCycle();
  const connectedAgents = agents.filter((agent) => agent.status !== "offline" && agent.status !== "away");
  const visibleAgents = agents.filter((agent) => agent.status !== "offline");
  const participantCount = connectedAgents.length + 1;
  return <aside className="agent-panel">
    <div className="agent-panel__header"><div><span>Autour de la table</span><strong>{participantCount} participant{participantCount > 1 ? "s" : ""} connecté{participantCount > 1 ? "s" : ""}</strong></div><div className="agent-panel__header-actions"><button className={refreshing ? "agent-panel__refresh agent-panel__refresh--loading" : "agent-panel__refresh"} disabled={refreshing} onClick={() => void runSpinCycle(onRefreshAgents)} aria-label="Rafraîchir les agents" title="Rafraîchir les agents"><Icon name="refresh" /></button>{onClose && <button className="agent-panel__drawer-close" onClick={onClose} aria-label="Fermer les participants" title="Fermer les participants"><Icon name="close" /></button>}<button className="agent-panel__mobile-close" onClick={onMobileClose} aria-label="Fermer les participants"><Icon name="close" /></button></div></div>
    <div className="agent-panel__human"><span className="agent-panel__avatar-wrap"><span className="agent-panel__avatar agent-panel__avatar--human">VO</span><i className="agent-panel__status agent-panel__status--online" title="En ligne" /></span><div><strong>Vous</strong><small>Hôte de la discussion</small></div></div>
    <div className="agent-panel__label">Agents</div>
    <div className="agent-panel__agents">
      {visibleAgents.map((agent, index) => <div className={`agent-panel__agent agent-panel__agent--${agent.status}`} key={agent.id}>
        <span className="agent-panel__avatar-wrap"><span className={`agent-panel__avatar agent-panel__avatar--${index % 2 ? "purple" : "blue"}`}>{initials(agent.name)}</span><i className={`agent-panel__status agent-panel__status--${agent.status}`} title={agent.status} /></span>
        <div>
          <strong>{agent.name}</strong>
          <small className="agent-panel__agent-meta">
            <span>{agent.status === "working" && agent.activeTopicId && agent.activeTopicId !== activeTopicId ? `Occupé dans « ${agent.activeTopicTitle || "une autre conversation"} »` : `${agent.model || "Modèle non déclaré"} · ${statusLabels[agent.status]}`}</span>
            {agent.status === "working" && <span className="agent-panel__thinking" aria-label="Réflexion en cours">
              <i /><i /><i />
            </span>}
          </small>
        </div>
        {agent.status !== "offline" && <button className="agent-panel__disconnect" onClick={() => onDisconnect(agent.id)} aria-label={`Déconnecter ${agent.name}`} title={`Déconnecter ${agent.name}`}><Icon name="link_off" /></button>}
      </div>)}
      {visibleAgents.length === 0 && <p className="agent-panel__empty">Aucun agent enregistré. Demandez à un agent de rejoindre Consilium.</p>}
    </div>
    <TaskQueue
      tasks={tasks}
      agents={connectedAgents}
      onCreate={onCreateTask}
      onInstruction={onTaskInstruction}
      onResolve={onResolveApproval}
      onCancel={onCancelTask}
      onArchive={onArchiveTask}
      onUnarchive={onUnarchiveTask}
      onDelete={onDeleteTask}
    />
  </aside>;
}
