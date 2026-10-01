import { useEffect, useState } from "react";
import { useTranslation, type Translate } from "../../../../../../i18n";
import { Icon } from "../../../../../../shared/components/Icon/Icon";
import { formatFileSize } from "../../../../../../shared/utils/formatFileSize";

const fileKind = (file: File, t: Translate) => {
  const extension = file.name.split(".").pop()?.toUpperCase();
  if (file.type.startsWith("image/")) return { icon: "image", label: extension || t("common.fileKind.image") };
  if (file.type.startsWith("video/")) return { icon: "movie", label: extension || t("common.fileKind.video") };
  if (file.type.startsWith("audio/")) return { icon: "audio_file", label: extension || t("common.fileKind.audio") };
  if (file.type === "application/pdf") return { icon: "picture_as_pdf", label: "PDF" };
  if (extension === "JSON") return { icon: "data_object", label: "JSON" };
  if (extension === "MD") return { icon: "markdown", label: "MD" };
  return { icon: "description", label: extension || t("common.fileKind.file") };
};

export function AttachmentItem({ file, onRemove }: { file: File; onRemove: () => void }) {
  const { t, locale } = useTranslation();
  const kind = fileKind(file, t);
  const [previewUrl, setPreviewUrl] = useState<string>();

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <li className="attachment-list__item">
    {previewUrl ? <img className="attachment-list__preview" src={previewUrl} alt="" /> : <span className="attachment-list__icon"><Icon name={kind.icon} /></span>}
    <span className="attachment-list__copy">
      <strong title={file.name}>{file.name}</strong>
      <small>{kind.label} · {formatFileSize(file.size, t, locale)}</small>
    </span>
    <button type="button" onClick={onRemove} aria-label={t("attachmentList.remove", { name: file.name })}><Icon name="close" /></button>
  </li>;
}
