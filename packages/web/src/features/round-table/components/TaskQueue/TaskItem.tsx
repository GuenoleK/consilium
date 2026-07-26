import { useState } from "react";
import type { ConsiliumTask } from "@consilium/core";
import { Icon } from "../../../../shared/components/Icon/Icon";

const statusLabels: Record<ConsiliumTask["status"], string> = {
  pending: "À prendre", claimed: "Prise en charge", running: "En cours",
  awaiting_approval: "Votre décision", waiting_for_input: "Instruction attendue",
  completed: "Terminée", failed: "Échec", cancelled: "Annulée",
};

interface TaskItemProps {
  task: ConsiliumTask;
  onInstruction: (taskId: string, body: string) => Promise<void>;
  onResolve: (taskId: string, approvalId: string, decision: "approved" | "rejected", note?: string) => Promise<void>;
  onCancel: (taskId: string) => Promise<void>;
}

export function TaskItem({ task, onInstruction, onResolve, onCancel }: TaskItemProps) {
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const pendingApproval = task.approvals.find((approval) => approval.status === "pending");
  const terminal = ["completed", "failed", "cancelled"].includes(task.status);

  return <article className={`task-item task-item--${task.status}`}>
    <header className="task-item__header"><span className="task-item__status">{statusLabels[task.status]}</span><span>{task.progress}%</span></header>
    <h3 className="task-item__title">{task.title}</h3>
    {task.description && <p className="task-item__description">{task.description}</p>}
    {task.progress > 0 && !terminal && <div className="task-item__progress"><i style={{ width: `${task.progress}%` }} /></div>}
    {pendingApproval && <section className="task-item__approval">
      <div><Icon name="policy" /><strong>{pendingApproval.action}</strong></div>
      <p>{pendingApproval.details}</p>
      <small>Risque : {pendingApproval.riskLevel === "restricted" ? "sensible" : "confirmation"}</small>
      <div className="task-item__approval-actions">
        <button onClick={() => void onResolve(task.id, pendingApproval.id, "rejected", "Action refusée depuis Consilium")}><Icon name="block" />Bloquer</button>
        <button className="task-item__approve" onClick={() => void onResolve(task.id, pendingApproval.id, "approved")}><Icon name="check" />Autoriser</button>
      </div>
    </section>}
    {task.result && <p className="task-item__result"><Icon name="task_alt" />{task.result}</p>}
    {task.error && <p className="task-item__error"><Icon name="error" />{task.error}</p>}
    {task.instructions.length > 0 && <small className="task-item__instruction-count">{task.instructions.length} instruction{task.instructions.length > 1 ? "s" : ""} complémentaire{task.instructions.length > 1 ? "s" : ""}</small>}
    {!terminal && <div className="task-item__actions">
      <button onClick={() => setInstructionOpen((open) => !open)}><Icon name="add_comment" />Instruire</button>
      <button onClick={() => void onCancel(task.id)}><Icon name="stop_circle" />Arrêter</button>
    </div>}
    {instructionOpen && <form className="task-item__instruction-form" onSubmit={(event) => {
      event.preventDefault();
      if (!instruction.trim()) return;
      void onInstruction(task.id, instruction.trim()).then(() => { setInstruction(""); setInstructionOpen(false); });
    }}>
      <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Ajoutez une contrainte ou une précision…" autoFocus />
      <button disabled={!instruction.trim()}>Envoyer l’instruction</button>
    </form>}
  </article>;
}
