import { useState } from "react";
import type { ConsiliumTask } from "@consilium/core";
import { useTranslation } from "../../../../i18n";
import { Icon } from "../../../../shared/components/Icon/Icon";

interface TaskItemProps {
  task: ConsiliumTask;
  onInstruction: (taskId: string, body: string) => Promise<void>;
  onResolve: (taskId: string, approvalId: string, decision: "approved" | "rejected", note?: string) => Promise<void>;
  onCancel: (taskId: string) => void | Promise<void>;
  onArchive: (taskId: string) => Promise<void>;
  onUnarchive: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => void | Promise<void>;
}

export function TaskItem({ task, onInstruction, onResolve, onCancel, onArchive, onUnarchive, onDelete }: TaskItemProps) {
  const { t } = useTranslation();
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const pendingApproval = task.approvals.find((approval) => approval.status === "pending");
  const terminal = ["completed", "failed", "cancelled"].includes(task.status);
  const archived = Boolean(task.archivedAt);

  return <article className={`task-item task-item--${task.status}${archived ? " task-item--archived" : ""}`}>
    <header className="task-item__header"><span className="task-item__status">{t(`taskStatus.${task.status}`)}</span><span>{task.progress}%</span></header>
    <h3 className="task-item__title">{task.title}</h3>
    {task.description && <p className="task-item__description">{task.description}</p>}
    {task.progress > 0 && !terminal && <div className="task-item__progress"><i style={{ width: `${task.progress}%` }} /></div>}
    {pendingApproval && <section className="task-item__approval">
      <div><Icon name="policy" /><strong>{pendingApproval.action}</strong></div>
      <p>{pendingApproval.details}</p>
      <small>{t(pendingApproval.riskLevel === "restricted" ? "taskItem.approval.riskRestricted" : "taskItem.approval.riskConfirmation")}</small>
      <div className="task-item__approval-actions">
        <button onClick={() => void onResolve(task.id, pendingApproval.id, "rejected", t("taskItem.approval.rejectedNote"))}><Icon name="block" />{t("taskItem.approval.block")}</button>
        <button className="task-item__approve" onClick={() => void onResolve(task.id, pendingApproval.id, "approved")}><Icon name="check" />{t("taskItem.approval.allow")}</button>
      </div>
    </section>}
    {task.result && <p className="task-item__result"><Icon name="task_alt" />{task.result}</p>}
    {task.error && <p className="task-item__error"><Icon name="error" />{task.error}</p>}
    {task.instructions.length > 0 && <small className="task-item__instruction-count">{t("taskItem.instructions.count", { count: task.instructions.length })}</small>}
    <div className="task-item__actions">
      {!terminal && !archived && <>
        <button type="button" onClick={() => setInstructionOpen((open) => !open)}><Icon name="add_comment" />{t("taskItem.actions.instruct")}</button>
        <button type="button" onClick={() => void onCancel(task.id)}><Icon name="stop_circle" />{t("taskItem.actions.stop")}</button>
      </>}
      {!archived && <button type="button" onClick={() => void onArchive(task.id)}><Icon name="archive" />{t("taskItem.actions.archive")}</button>}
      {archived && <button type="button" onClick={() => void onUnarchive(task.id)}><Icon name="unarchive" />{t("taskItem.actions.unarchive")}</button>}
      <button type="button" className="task-item__delete" onClick={() => void onDelete(task.id)}><Icon name="delete_forever" />{t("taskItem.actions.delete")}</button>
    </div>
    {instructionOpen && !archived && <form className="task-item__instruction-form" onSubmit={(event) => {
      event.preventDefault();
      if (!instruction.trim()) return;
      void onInstruction(task.id, instruction.trim()).then(() => { setInstruction(""); setInstructionOpen(false); });
    }}>
      <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={t("taskItem.instructions.placeholder")} autoFocus />
      <button disabled={!instruction.trim()}>{t("taskItem.instructions.send")}</button>
    </form>}
  </article>;
}
