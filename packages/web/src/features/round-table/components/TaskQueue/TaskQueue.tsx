import { useState } from "react";
import type { Agent, ConsiliumTask } from "@consilium/core";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { TaskItem } from "./TaskItem";
import "./TaskQueue.scss";

const terminalTaskStatuses = new Set<ConsiliumTask["status"]>(["completed", "failed", "cancelled"]);

interface TaskQueueProps {
  tasks: ConsiliumTask[];
  agents: Agent[];
  onCreate: (input: { title: string; description: string; assignedAgentId?: string }) => Promise<void>;
  onInstruction: (taskId: string, body: string) => Promise<void>;
  onResolve: (taskId: string, approvalId: string, decision: "approved" | "rejected", note?: string) => Promise<void>;
  onCancel: (taskId: string) => void | Promise<void>;
  onArchive: (taskId: string) => Promise<void>;
  onUnarchive: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => void | Promise<void>;
}

export function TaskQueue({ tasks, agents, onCreate, onInstruction, onResolve, onCancel, onArchive, onUnarchive, onDelete }: TaskQueueProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [activeOpen, setActiveOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const activeTasks = tasks.filter((task) => !task.archivedAt && !terminalTaskStatuses.has(task.status));
  const completedTasks = tasks.filter((task) => !task.archivedAt && terminalTaskStatuses.has(task.status));
  const archivedTasks = tasks.filter((task) => Boolean(task.archivedAt));
  const pendingCount = activeTasks.filter((task) => task.status === "awaiting_approval" || task.status === "waiting_for_input").length;
  const renderTasks = (sectionTasks: ConsiliumTask[], emptyMessage: string) => sectionTasks.length ? (
    <div className="task-queue__list">
      {sectionTasks.map((task) => <TaskItem key={task.id} task={task} onInstruction={onInstruction} onResolve={onResolve} onCancel={onCancel} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} />)}
    </div>
  ) : (
    <div className="task-queue__empty"><Icon name="task_alt" /><p>{emptyMessage}</p></div>
  );

  return <section className="task-queue">
    <header className="task-queue__header">
      <div><span>Tâches</span><strong>{tasks.length} dans ce sujet{pendingCount ? ` · ${pendingCount} décision` : ""}</strong></div>
      <button type="button" onClick={() => setCreating((open) => !open)} aria-label="Créer une tâche" title="Créer une tâche"><Icon name={creating ? "close" : "add_task"} /></button>
    </header>
    {creating && <form className="task-queue__form" onSubmit={(event) => {
      event.preventDefault();
      if (!title.trim()) return;
      void onCreate({ title: title.trim(), description: description.trim(), assignedAgentId: assignedAgentId || undefined })
        .then(() => { setTitle(""); setDescription(""); setAssignedAgentId(""); setCreating(false); });
    }}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de la tâche" autoFocus />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Résultat attendu et contraintes" />
      <select value={assignedAgentId} onChange={(event) => setAssignedAgentId(event.target.value)}>
        <option value="">Agent non assigné</option>
        {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      </select>
      <button type="submit" disabled={!title.trim()}><Icon name="play_arrow" />Créer la tâche</button>
    </form>}
    <details className="task-queue__section task-queue__section--active" open={activeOpen} onToggle={(event) => setActiveOpen(event.currentTarget.open)}>
      <summary className="task-queue__section-summary">
        <span><Icon name="chevron_right" />Tâches actives</span>
        <strong>{activeTasks.length}</strong>
      </summary>
      {renderTasks(activeTasks, "Aucune tâche active. Créez-en une pour déléguer un travail à un agent.")}
    </details>
    <details className="task-queue__section task-queue__section--completed" open={completedOpen} onToggle={(event) => setCompletedOpen(event.currentTarget.open)}>
      <summary className="task-queue__section-summary">
        <span><Icon name="chevron_right" />Tâches terminées</span>
        <strong>{completedTasks.length}</strong>
      </summary>
      {renderTasks(completedTasks, "Aucune tâche terminée.")}
    </details>
    <details className="task-queue__section task-queue__section--archived" open={archivedOpen} onToggle={(event) => setArchivedOpen(event.currentTarget.open)}>
      <summary className="task-queue__section-summary">
        <span><Icon name="chevron_right" />Tâches archivées</span>
        <strong>{archivedTasks.length}</strong>
      </summary>
      {renderTasks(archivedTasks, "Aucune tâche archivée.")}
    </details>
  </section>;
}
