import { useTranslation } from "../../../../../../i18n";
import { AttachmentItem } from "./AttachmentItem";
import "./AttachmentList.scss";

export function AttachmentList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const { t } = useTranslation();
  return <ul className="attachment-list" aria-label={t("attachmentList.label")}>
    {files.map((file, index) =>
      <AttachmentItem key={`${file.name}-${file.size}-${file.lastModified}-${index}`} file={file} onRemove={() => onRemove(index)} />,
    )}
  </ul>;
}
