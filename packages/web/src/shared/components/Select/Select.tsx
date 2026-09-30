import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon/Icon";
import "./Select.scss";

export interface SelectOption<Value extends string> {
  value: Value;
  label: string;
}

interface SelectProps<Value extends string> {
  value: Value;
  options: SelectOption<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  /** Accessible name when no visible element labels the select. */
  label?: string;
  /** Id of the element that labels the select. */
  labelledBy?: string;
}

interface MenuPlacement {
  top?: number;
  bottom?: number;
  right: number;
  minWidth: number;
  maxHeight: number;
  above: boolean;
}

const CLOSE_ANIMATION_MS = 140;
const MENU_OFFSET = 6;
const VIEWPORT_MARGIN = 12;

// The menu is portalled to <body> with fixed positioning so a dialog or panel with
// `overflow: hidden` can never clip it. Focus stays on the trigger (aria-activedescendant).
export function Select<Value extends string>({ value, options, onChange, disabled, label, labelledBy }: SelectProps<Value>) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<MenuPlacement>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const updatePlacement = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_OFFSET - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_OFFSET - VIEWPORT_MARGIN;
    const above = menu.scrollHeight > spaceBelow && spaceAbove > spaceBelow;
    setPlacement({
      top: above ? undefined : rect.bottom + MENU_OFFSET,
      bottom: above ? window.innerHeight - rect.top + MENU_OFFSET : undefined,
      right: window.innerWidth - rect.right,
      minWidth: rect.width,
      maxHeight: Math.max(120, above ? spaceAbove : spaceBelow),
      above,
    });
  }, []);

  const openMenu = () => {
    setActiveIndex(selectedIndex);
    setRendered(true);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (rendered) updatePlacement();
  }, [rendered, updatePlacement]);

  useEffect(() => {
    if (open || !rendered) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setRendered(false), reducedMotion ? 0 : CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, updatePlacement]);

  useEffect(() => {
    if (open) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); setActiveIndex((index) => Math.min(last, index + 1)); break;
      case "ArrowUp": event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); break;
      case "Home": event.preventDefault(); setActiveIndex(0); break;
      case "End": event.preventDefault(); setActiveIndex(last); break;
      case "Enter":
      case " ": event.preventDefault(); choose(activeIndex); break;
      // Keep Escape from also closing the dialog that hosts the select.
      case "Escape": event.preventDefault(); event.stopPropagation(); setOpen(false); break;
      case "Tab": setOpen(false); break;
    }
  };

  return <div className="select">
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      className={`select__trigger${open ? " select__trigger--open" : ""}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={rendered ? listboxId : undefined}
      aria-activedescendant={open ? optionId(activeIndex) : undefined}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => open ? setOpen(false) : openMenu()}
      onKeyDown={handleKeyDown}
    >
      <span className="select__value">{options[selectedIndex]?.label}</span>
      <Icon name="expand_more" />
    </button>
    {rendered && createPortal(
      <div
        ref={menuRef}
        id={listboxId}
        role="listbox"
        className={`select__menu${open ? "" : " select__menu--closing"}${placement?.above ? " select__menu--above" : ""}`}
        aria-label={label}
        aria-labelledby={labelledBy}
        style={placement}
        onMouseDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => <div
          id={optionId(index)}
          key={option.value}
          role="option"
          aria-selected={option.value === value}
          className={`select__option${option.value === value ? " select__option--selected" : ""}${index === activeIndex ? " select__option--active" : ""}`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(index)}
        >
          <span>{option.label}</span>
          {option.value === value && <Icon name="check" />}
        </div>)}
      </div>,
      document.body,
    )}
  </div>;
}
