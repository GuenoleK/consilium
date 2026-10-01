import { useEffect, useRef, useState } from "react";
import type { Agent } from "@consilium/core";
import { useTranslation } from "../../../../../i18n";
import { Icon } from "../../../../../shared/components/Icon/Icon";
import "./ParticipantPicker.scss";

interface ParticipantPickerProps {
  agents: Agent[];
  participantIds: string[];
  onAdd: (agentId: string) => Promise<void>;
}

export function ParticipantPicker({ agents, participantIds, onAdd }: ParticipantPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [addingId, setAddingId] = useState<string>();
  const [error, setError] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const participantSet = new Set(participantIds.map((id) => id.toLowerCase()));
  const availableAgents = agents.filter((agent) => !participantSet.has(agent.id.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const addAgent = async (agent: Agent) => {
    setAddingId(agent.id);
    setError("");
    try {
      await onAdd(agent.id);
      setOpen(false);
    } catch {
      setError(t("participantPicker.error"));
    } finally {
      setAddingId(undefined);
    }
  };

  return <div ref={pickerRef} className="participant-picker" onClick={(event) => event.stopPropagation()}>
    <button
      className="participant-picker__trigger"
      type="button"
      disabled={!availableAgents.length}
      aria-expanded={open}
      aria-controls="participant-picker-options"
      aria-label={availableAgents.length ? t("participantPicker.add") : t("participantPicker.allParticipating")}
      title={availableAgents.length ? t("participantPicker.addShort") : t("participantPicker.allParticipating")}
      onClick={() => setOpen((current) => !current)}
    ><Icon name="person_add" /></button>
    {open && <div id="participant-picker-options" className="participant-picker__options" role="menu" aria-label={t("participantPicker.menu")}>
      <span className="participant-picker__label">{t("participantPicker.label")}</span>
      {availableAgents.map((agent) => <button
        className="participant-picker__option"
        type="button"
        role="menuitem"
        key={agent.id}
        disabled={addingId === agent.id}
        onClick={() => void addAgent(agent)}
      >
        <span className={`participant-picker__status participant-picker__status--${agent.status}`} />
        <span className="participant-picker__identity"><strong>{agent.name}</strong><small>@{agent.id} · {t(`agentStatus.${agent.status}`)}</small></span>
        {addingId === agent.id && <Icon name="progress_activity" />}
      </button>)}
      {error && <small className="participant-picker__error" role="alert">{error}</small>}
    </div>}
  </div>;
}
