import { useTranslation } from "../../../../i18n";
import { Icon } from "../../../../shared/components/Icon/Icon";
import "./ConversationActions.scss";

interface ConversationActionsProps {
  disabled?: boolean;
  onReset: () => void;
  onDelete: () => void;
}

export function ConversationActions({ disabled, onReset, onDelete }: ConversationActionsProps) {
  const { t } = useTranslation();
  return <div className="conversation-actions">
    <button disabled={disabled} onClick={onReset} title={t("conversationActions.resetTitle")} aria-label={t("conversationActions.resetLabel")}><Icon name="delete_history" /></button>
    <button className="conversation-actions__delete" disabled={disabled} onClick={onDelete} title={t("conversationActions.deleteTitle")} aria-label={t("conversationActions.deleteLabel")}><Icon name="delete" /></button>
  </div>;
}
