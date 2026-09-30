import "./Switch.scss";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name when no visible element labels the switch. */
  label?: string;
  /** Id of the element that labels the switch. */
  labelledBy?: string;
}

export function Switch({ checked, onChange, disabled, label, labelledBy }: SwitchProps) {
  return <button
    type="button"
    role="switch"
    className={`switch${checked ? " switch--checked" : ""}`}
    aria-checked={checked}
    aria-label={label}
    aria-labelledby={labelledBy}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  ><span className="switch__thumb" /></button>;
}
