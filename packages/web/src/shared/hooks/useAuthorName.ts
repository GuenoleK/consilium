import { useCallback } from "react";
import { useTranslation } from "../../i18n";

/** Name to display for a message author: the human is always shown as "You" in the UI language. */
export function useAuthorName() {
  const { t } = useTranslation();
  return useCallback((author: { authorKind: string; authorName: string }) =>
    author.authorKind === "human" ? t("common.you") : author.authorName, [t]);
}
