import { AttachmentItem } from "./AttachmentItem";
import "./AttachmentList.scss";

export function AttachmentList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  return <ul className="attachment-list" aria-label="Fichiers joints">
    {files.map((file, index) =>
      <AttachmentItem key={`${file.name}-${file.size}-${file.lastModified}-${index}`} file={file} onRemove={() => onRemove(index)} />,
    )}
  </ul>;
}
