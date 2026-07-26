import { useState } from "react";
import type { Agent, ConsiliumTask } from "@consilium/core";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { TaskItem } from "./TaskItem";
import "./TaskQueue.scss";

interface TaskQueueProps {
  tasks: ConsiliumTask[];
  agents: Agent[];
  onCreate: (input: { title: string; description: string; assignedAgentId?: string }) => Promise<void>;
  onInstruction: (taskId: string, body: string) => Promise<void>;
  onResolve: (taskId: string, approvalId: string, decision: "approved" | "rejected", note?: string) => Promise<void>;
  onCancel: (taskId: string) => Promise<void>;
}

export function TaskQueue({ tasks, agents, onCreate, onInstruction, onResolve, onCancel }: TaskQueueProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const pendingCount = tasks.filter((task) => task.status === "awaiting_approval" || task.status === "waiting_for_input").length;

  return <section className="task-queue">
    <header className="task-queue__header">
      <div><span>Tâches</span><strong>{tasks.length} dans ce sujet{pendingCount ? ` · ${pendingCount} décision` : ""}</strong></div>
      <button onClick={() => setCreating((open) => !open)} aria-label="Créer une tâche" title="Créer une tâche"><Icon name={creating ? "close" : "add_task"} /></button>
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
      <button disabled={!title.trim()}><Icon name="play_arrow" />Créer la tâche</button>
    </form>}
    <div className="task-queue__list">
      {tasks.length ? tasks.map((task) => <TaskItem key={task.id} task={task} onInstruction={onInstruction} onResolve={onResolve} onCancel={onCancel} />) : <div className="task-queue__empty"><Icon name="task_alt" /><p>Aucune tâche. Créez-en une pour déléguer un travail à un agent.</p></div>}
    </div>
  </section>;
}
