import "./Icon.scss";
export function Icon({ name, filled = false }: { name: string; filled?: boolean }) {
  return <span className={`icon material-symbols-rounded${filled ? " icon--filled" : ""}`} aria-hidden="true">{name}</span>;
}
