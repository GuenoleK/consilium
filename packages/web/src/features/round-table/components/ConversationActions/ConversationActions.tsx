import { Icon } from "../../../../shared/components/Icon/Icon";
import "./ConversationActions.scss";

interface ConversationActionsProps {
  disabled?: boolean;
  onReset: () => void;
  onDelete: () => void;
}

export function ConversationActions({ disabled, onReset, onDelete }: ConversationActionsProps) {
  return <div className="conversation-actions">
    <button disabled={disabled} onClick={onReset} title="Vider les messages" aria-label="Réinitialiser la conversation"><Icon name="delete_history" /></button>
    <button className="conversation-actions__delete" disabled={disabled} onClick={onDelete} title="Supprimer le sujet" aria-label="Supprimer la conversation"><Icon name="delete" /></button>
  </div>;
}
