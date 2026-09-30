import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { Agent, ConsiliumTask, Topic } from "@consilium/core";
import { useTranslation } from "../../../../i18n";
import { Icon } from "../../../../shared/components/Icon/Icon";
import { useSpinCycle } from "../../../../shared/hooks/useSpinCycle";
import { TaskQueue } from "../TaskQueue/TaskQueue";
import { ParticipantPicker } from "./ParticipantPicker/ParticipantPicker";
import "./AgentPanel.scss";

const initials = (name: string) => name.slice(0, 2).toUpperCase();
const connectedStatuses = new Set<Agent["status"]>(["online", "listening", "working"]);

type RoomSortMode = "alphabetical" | "chronological" | "custom";
interface RoomPreference { mode: RoomSortMode; customOrder: string[]; }
interface RoomRecord { topic: Topic; agents: Agent[]; }
interface RoomDragState { sourceId: string; targetId: string; placement: "before" | "after"; clientX: number; clientY: number; }
interface PendingRoomPress { roomId: string; pointerId: number; timer: number; startX: number; startY: number; startedOnSummary: boolean; }

const roomSortStorageKey = "consilium-room-sort";
const roomSortModes = new Set<RoomSortMode>(["alphabetical", "chronological", "custom"]);

const readRoomPreference = (): RoomPreference => {
  if (typeof window === "undefined") return { mode: "alphabetical", customOrder: [] };
  try {
    const stored = JSON.parse(window.localStorage.getItem(roomSortStorageKey) || "null") as Partial<RoomPreference> | null;
    return {
      mode: stored?.mode && roomSortModes.has(stored.mode) ? stored.mode : "alphabetical",
      customOrder: Array.isArray(stored?.customOrder) ? stored.customOrder.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return { mode: "alphabetical", customOrder: [] };
  }
};

const compareRoomTitles = (locale: string) => (left: RoomRecord, right: RoomRecord) =>
  left.topic.title.localeCompare(right.topic.title, locale, { sensitivity: "base" }) || left.topic.id.localeCompare(right.topic.id);

const sortRooms = (rooms: RoomRecord[], preference: RoomPreference, locale: string) => {
  const compareRoomTitle = compareRoomTitles(locale);
  const sorted = [...rooms];
  if (preference.mode === "chronological") return sorted.sort((left, right) => left.topic.createdAt.localeCompare(right.topic.createdAt) || compareRoomTitle(left, right));
  if (preference.mode === "custom") {
    const customIndexes = new Map(preference.customOrder.map((id, index) => [id, index]));
    return sorted.sort((left, right) => {
      const leftIndex = customIndexes.get(left.topic.id);
      const rightIndex = customIndexes.get(right.topic.id);
      if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
      if (leftIndex !== undefined) return -1;
      if (rightIndex !== undefined) return 1;
      return compareRoomTitle(left, right);
    });
  }
  return sorted.sort(compareRoomTitle);
};

function AgentEntry({ agent, index, contextTopicId, onDisconnect, onDelete }: {
  agent: Agent;
  index: number;
  contextTopicId?: string;
  onDisconnect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const statusLabel = t(`agentStatus.${agent.status}`);
  const isWorkingElsewhere = agent.status === "working" && agent.activeTopicId && agent.activeTopicId !== contextTopicId;
  return <div className={`agent-panel__agent agent-panel__agent--${agent.status}`}>
    <span className="agent-panel__avatar-wrap"><span className={`agent-panel__avatar agent-panel__avatar--${index % 2 ? "purple" : "blue"}`}>{initials(agent.name)}</span><i className={`agent-panel__status agent-panel__status--${agent.status}`} title={statusLabel} /></span>
    <div>
      <strong>{agent.name}</strong>
      <small className="agent-panel__agent-meta">
        <span>{isWorkingElsewhere ? t("agentPanel.agents.busyElsewhere", { topic: agent.activeTopicTitle || t("agentPanel.agents.anotherConversation") }) : `${agent.model || t("common.unknownModel")} · ${statusLabel}`}</span>
        {agent.status === "working" && <span className="agent-panel__thinking" aria-label={t("agentPanel.agents.thinking")}><i /><i /><i /></span>}
      </small>
    </div>
    {agent.status === "offline"
      ? <button className="agent-panel__delete" type="button" onClick={() => onDelete(agent.id)} aria-label={t("agentPanel.agents.delete", { name: agent.name })} title={t("agentPanel.agents.delete", { name: agent.name })}><Icon name="delete_forever" /></button>
      : <button className="agent-panel__disconnect" type="button" onClick={() => onDisconnect(agent.id)} aria-label={t("agentPanel.agents.disconnect", { name: agent.name })} title={t("agentPanel.agents.disconnect", { name: agent.name })}><Icon name="link_off" /></button>}
  </div>;
}

interface AgentPanelProps {
  agents: Agent[];
  topics: Topic[];
  activeTopicId?: string;
  tasks: ConsiliumTask[];
  onDisconnect: (id: string) => void;
  onDeleteAgent: (id: string) => void;
  onAddParticipant: (topicId: string, agentId: string) => Promise<void>;
  onRefreshAgents: () => Promise<void>;
  onCreateTask: (input: { title: string; description: string; assignedAgentId?: string }) => Promise<void>;
  onTaskInstruction: (taskId: string, body: string) => Promise<void>;
  onResolveApproval: (taskId: string, approvalId: string, decision: "approved" | "rejected", note?: string) => Promise<void>;
  onCancelTask: (taskId: string) => void | Promise<void>;
  onArchiveTask: (taskId: string) => Promise<void>;
  onUnarchiveTask: (taskId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => void | Promise<void>;
  onClose?: () => void;
  onMobileClose?: () => void;
}

export function AgentPanel({ agents, topics, activeTopicId, tasks, onDisconnect, onDeleteAgent, onAddParticipant, onRefreshAgents, onCreateTask, onTaskInstruction, onResolveApproval, onCancelTask, onArchiveTask, onUnarchiveTask, onDeleteTask, onClose, onMobileClose }: AgentPanelProps) {
  const { t, locale } = useTranslation();
  const { spinning: refreshing, runSpinCycle } = useSpinCycle();
  const [freeExpanded, setFreeExpanded] = useState(true);
  const [expandedRoomIds, setExpandedRoomIds] = useState<Set<string>>(() => activeTopicId ? new Set([activeTopicId]) : new Set());
  const [roomPreference, setRoomPreference] = useState<RoomPreference>(readRoomPreference);
  const [roomSortMenuOpen, setRoomSortMenuOpen] = useState(false);
  const [roomDrag, setRoomDrag] = useState<RoomDragState>();
  const roomSortMenuRef = useRef<HTMLDivElement>(null);
  const pendingRoomPressRef = useRef<PendingRoomPress | undefined>(undefined);
  const roomDragRef = useRef<RoomDragState | undefined>(undefined);
  const suppressRoomClickRef = useRef(false);
  const topicAgentIds = new Set(topics.flatMap((topic) => topic.participantIds.map((participantId) => participantId.toLowerCase())));
  const freeAgents = agents.filter((agent) => !topicAgentIds.has(agent.id.toLowerCase()));
  const roomRecords = topics.map((topic) => ({
    topic,
    agents: agents.filter((agent) => topic.participantIds.some((participantId) => participantId.toLowerCase() === agent.id.toLowerCase())),
  }));
  const rooms = sortRooms(roomRecords, roomPreference, locale);
  const activeRoom = rooms.find((room) => room.topic.id === activeTopicId);
  const connectedActiveRoomAgents = activeRoom?.agents.filter((agent) => connectedStatuses.has(agent.status)) || [];
  const connectedAgents = agents.filter((agent) => connectedStatuses.has(agent.status));
  const participantCount = connectedActiveRoomAgents.length + 1;

  useEffect(() => {
    try { window.localStorage.setItem(roomSortStorageKey, JSON.stringify(roomPreference)); } catch { /* Preferences remain in memory when storage is unavailable. */ }
  }, [roomPreference]);

  useEffect(() => {
    if (!activeTopicId) return;
    setExpandedRoomIds((current) => current.size === 1 && current.has(activeTopicId) ? current : new Set([activeTopicId]));
  }, [activeTopicId]);

  useEffect(() => {
    if (!roomSortMenuOpen) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (roomSortMenuRef.current && !roomSortMenuRef.current.contains(event.target as Node)) setRoomSortMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRoomSortMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [roomSortMenuOpen]);

  const selectRoomSortMode = (mode: RoomSortMode) => {
    setRoomPreference((current) => ({
      mode,
      customOrder: mode === "custom" && !current.customOrder.length ? rooms.map(({ topic }) => topic.id) : current.customOrder,
    }));
    setRoomSortMenuOpen(false);
  };

  const clearPendingRoomPress = () => {
    const pending = pendingRoomPressRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingRoomPressRef.current = undefined;
  };

  const finishRoomDrag = () => {
    clearPendingRoomPress();
    roomDragRef.current = undefined;
    setRoomDrag(undefined);
  };

  const beginRoomDrag = (pending: PendingRoomPress, clientX: number, clientY: number) => {
    clearPendingRoomPress();
    suppressRoomClickRef.current = pending.startedOnSummary;
    const nextDrag = { sourceId: pending.roomId, targetId: pending.roomId, placement: "before" as const, clientX, clientY };
    roomDragRef.current = nextDrag;
    setRoomDrag(nextDrag);
  };

  const startRoomPress = (event: ReactPointerEvent<HTMLElement>, roomId: string) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, select, input, textarea, a, [role='menu']")) return;
    clearPendingRoomPress();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional on older browsers. */ }
    const timer = window.setTimeout(() => {
      const pending = pendingRoomPressRef.current;
      if (!pending || pending.pointerId !== event.pointerId) return;
      beginRoomDrag(pending, pending.startX, pending.startY);
    }, 360);
    pendingRoomPressRef.current = { roomId, pointerId: event.pointerId, timer, startX: event.clientX, startY: event.clientY, startedOnSummary: Boolean((event.target as HTMLElement).closest("summary")) };
  };

  const updateRoomDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pending = pendingRoomPressRef.current;
    if (pending) {
      const moved = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (moved <= 8 || event.pointerType !== "mouse") {
        if (moved > 8) clearPendingRoomPress();
        return;
      }
      beginRoomDrag(pending, event.clientX, event.clientY);
    }
    const currentDrag = roomDragRef.current;
    if (!currentDrag) return;
    event.preventDefault();
    const roomElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-room-id]");
    const targetId = roomElement?.dataset.roomId;
    if (!targetId) {
      const nextDrag = { ...currentDrag, clientX: event.clientX, clientY: event.clientY };
      roomDragRef.current = nextDrag;
      setRoomDrag(nextDrag);
      return;
    }
    const bounds = roomElement.getBoundingClientRect();
    const placement: RoomDragState["placement"] = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    const nextDrag = currentDrag.targetId === targetId && currentDrag.placement === placement
      ? { ...currentDrag, clientX: event.clientX, clientY: event.clientY }
      : { ...currentDrag, targetId, placement, clientX: event.clientX, clientY: event.clientY };
    roomDragRef.current = nextDrag;
    setRoomDrag(nextDrag);
  };

  const dropRoom = (event: ReactPointerEvent<HTMLDivElement>) => {
    const currentDrag = roomDragRef.current;
    if (currentDrag) event.preventDefault();
    clearPendingRoomPress();
    if (!currentDrag || currentDrag.sourceId === currentDrag.targetId) {
      finishRoomDrag();
      return;
    }
    const nextRoomIds = rooms.map(({ topic }) => topic.id);
    const sourceIndex = nextRoomIds.indexOf(currentDrag.sourceId);
    const targetIndex = nextRoomIds.indexOf(currentDrag.targetId);
    if (sourceIndex < 0 || targetIndex < 0) { finishRoomDrag(); return; }
    nextRoomIds.splice(sourceIndex, 1);
    const insertIndex = currentDrag.placement === "before" ? nextRoomIds.indexOf(currentDrag.targetId) : nextRoomIds.indexOf(currentDrag.targetId) + 1;
    nextRoomIds.splice(insertIndex, 0, currentDrag.sourceId);
    setRoomPreference({ mode: "custom", customOrder: nextRoomIds });
    finishRoomDrag();
  };

  const handleRoomToggle = (event: ReactMouseEvent<HTMLElement>, roomId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (suppressRoomClickRef.current) {
      suppressRoomClickRef.current = false;
      return;
    }
    setExpandedRoomIds((current) => {
      const next = new Set(current);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const draggedRoom = roomDrag ? rooms.find(({ topic }) => topic.id === roomDrag.sourceId) : undefined;

  return <aside className="agent-panel">
    <div className="agent-panel__header"><div><span>{t("agentPanel.header.eyebrow")}</span><strong>{t("agentPanel.header.participants", { count: participantCount })}</strong></div><div className="agent-panel__header-actions"><button className={refreshing ? "agent-panel__refresh agent-panel__refresh--loading" : "agent-panel__refresh"} type="button" disabled={refreshing} onClick={() => void runSpinCycle(onRefreshAgents)} aria-label={t("agentPanel.header.refresh")} title={t("agentPanel.header.refresh")}><Icon name="refresh" /></button>{onClose && <button className="agent-panel__drawer-close" type="button" onClick={onClose} aria-label={t("agentPanel.header.closeParticipants")} title={t("agentPanel.header.closeParticipants")}><Icon name="close" /></button>}<button className="agent-panel__mobile-close" type="button" onClick={onMobileClose} aria-label={t("agentPanel.header.closeParticipants")}><Icon name="close" /></button></div></div>
    <div className="agent-panel__human"><span className="agent-panel__avatar-wrap"><span className="agent-panel__avatar agent-panel__avatar--human">{initials(t("common.you"))}</span><i className="agent-panel__status agent-panel__status--online" title={t("agentPanel.human.online")} /></span><div><strong>{t("common.you")}</strong><small>{t("agentPanel.human.role")}</small></div></div>
    <div className="agent-panel__label"><span>{t("agentPanel.agents.label")}</span><strong>{agents.length}</strong></div>
    <details className="agent-panel__group" open={freeExpanded} onToggle={(event) => setFreeExpanded(event.currentTarget.open)}>
      <summary><span>{t("agentPanel.free.label")}</span><strong className="agent-panel__group-count">{freeAgents.length}</strong><Icon name="expand_more" /></summary>
      <div className="agent-panel__agents">
        {freeAgents.map((agent, index) => <AgentEntry key={agent.id} agent={agent} index={index} contextTopicId={undefined} onDisconnect={onDisconnect} onDelete={onDeleteAgent} />)}
        {!freeAgents.length && <p className="agent-panel__empty">{t("agentPanel.free.empty")}</p>}
      </div>
    </details>
    <div className="agent-panel__rooms-heading">
      <div className="agent-panel__label agent-panel__label--rooms"><span>{t("agentPanel.rooms.label")}</span><strong>{rooms.length}</strong></div>
      <div ref={roomSortMenuRef} className="agent-panel__room-sort">
        <button className="agent-panel__room-sort-trigger" type="button" aria-label={t("agentPanel.sort.label")} aria-haspopup="menu" aria-expanded={roomSortMenuOpen} onClick={() => setRoomSortMenuOpen((open) => !open)}><Icon name="more_horiz" /></button>
        {roomSortMenuOpen && <div className="agent-panel__room-sort-menu" role="menu" aria-label={t("agentPanel.sort.label")}>
          <strong>{t("agentPanel.sort.label")}</strong>
          <span className="agent-panel__room-sort-heading">{t("agentPanel.sort.heading")}</span>
          {(["alphabetical", "chronological", "custom"] as const).map((mode) => <button
            key={mode}
            className={`agent-panel__room-sort-option${roomPreference.mode === mode ? " agent-panel__room-sort-option--selected" : ""}`}
            type="button"
            role="menuitemradio"
            aria-checked={roomPreference.mode === mode}
            onClick={() => selectRoomSortMode(mode)}
          ><span>{roomPreference.mode === mode && <Icon name="check" />}</span>{t(`agentPanel.sort.${mode}`)}</button>)}
        </div>}
      </div>
    </div>
    <div className={`agent-panel__rooms${roomDrag ? " agent-panel__rooms--dragging" : ""}`} onPointerMove={updateRoomDrag} onPointerUp={dropRoom} onPointerCancel={finishRoomDrag}>
      {rooms.map(({ topic, agents: roomAgents }) => <details
        className={`agent-panel__room${topic.id === activeTopicId ? " agent-panel__room--active" : ""}${roomDrag?.targetId === topic.id && roomDrag.sourceId !== topic.id ? ` agent-panel__room--drop-target agent-panel__room--drop-${roomDrag.placement}` : ""}`}
        key={topic.id}
        data-room-id={topic.id}
        open={expandedRoomIds.has(topic.id)}
      >
        <summary onClick={(event) => handleRoomToggle(event, topic.id)} onPointerDown={(event) => startRoomPress(event, topic.id)}>
          <Icon name="expand_more" />
          <span className="agent-panel__room-copy"><span className="agent-panel__room-title"><span className="agent-panel__room-title-text">{topic.title}</span><span className="agent-panel__room-count" aria-label={t("agentPanel.rooms.agentCount", { count: roomAgents.length })}>{roomAgents.length}</span></span><small>#{topic.mentionKey}</small></span>
          <span onClick={(event) => event.stopPropagation()}><ParticipantPicker agents={agents} participantIds={topic.participantIds} onAdd={(agentId) => onAddParticipant(topic.id, agentId)} /></span>
        </summary>
        <div className="agent-panel__agents" onPointerDown={(event) => startRoomPress(event, topic.id)}>
          {roomAgents.map((agent, index) => <AgentEntry key={agent.id} agent={agent} index={index} contextTopicId={topic.id} onDisconnect={onDisconnect} onDelete={onDeleteAgent} />)}
          {!roomAgents.length && <p className="agent-panel__empty">{t("agentPanel.rooms.emptyRoom")}</p>}
        </div>
      </details>)}
      {!rooms.length && <p className="agent-panel__empty">{t("agentPanel.rooms.empty")}</p>}
    </div>
    {draggedRoom && roomDrag && <div className="agent-panel__room-drag-preview" style={{ left: roomDrag.clientX + 14, top: roomDrag.clientY + 14 }} aria-hidden="true">
      <Icon name="forum" />
      <span><strong>{draggedRoom.topic.title}</strong><small>#{draggedRoom.topic.mentionKey}</small></span>
      <b>{draggedRoom.agents.length}</b>
    </div>}
    <TaskQueue
      tasks={tasks}
      agents={connectedAgents}
      onCreate={onCreateTask}
      onInstruction={onTaskInstruction}
      onResolve={onResolveApproval}
      onCancel={onCancelTask}
      onArchive={onArchiveTask}
      onUnarchive={onUnarchiveTask}
      onDelete={onDeleteTask}
    />
  </aside>;
}
