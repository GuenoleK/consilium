import { useEffect, useState } from "react";
import { Icon } from "../../../../../../shared/components/Icon/Icon";

const formatSize = (size: number) => {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
};

const fileKind = (file: File) => {
  const extension = file.name.split(".").pop()?.toUpperCase();
  if (file.type.startsWith("image/")) return { icon: "image", label: extension || "IMAGE" };
  if (file.type.startsWith("video/")) return { icon: "movie", label: extension || "VIDÉO" };
  if (file.type.startsWith("audio/")) return { icon: "audio_file", label: extension || "AUDIO" };
  if (file.type === "application/pdf") return { icon: "picture_as_pdf", label: "PDF" };
  if (extension === "JSON") return { icon: "data_object", label: "JSON" };
  if (extension === "MD") return { icon: "markdown", label: "MD" };
  return { icon: "description", label: extension || "FICHIER" };
};

export function AttachmentItem({ file, onRemove }: { file: File; onRemove: () => void }) {
  const kind = fileKind(file);
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
      <small>{kind.label} · {formatSize(file.size)}</small>
    </span>
    <button type="button" onClick={onRemove} aria-label={`Retirer ${file.name}`}><Icon name="close" /></button>
  </li>;
}
