import type { Translate } from "../../i18n";

export function formatFileSize(size: number, t: Translate, locale: string) {
  if (size < 1024) return t("common.fileSize.bytes", { value: size });
  if (size < 1024 * 1024) return t("common.fileSize.kilobytes", { value: Math.ceil(size / 1024) });
  const megabytes = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(size / (1024 * 1024));
  return t("common.fileSize.megabytes", { value: megabytes });
}
