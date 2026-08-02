import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Agent, AuthorizationRequest, ConsiliumTask, Message, Topic } from "@consilium/core";
import { api } from "../../core/api";
import { Icon } from "../../shared/components/Icon/Icon";
import { useSystemNotifications, type AttentionEvent } from "../notifications/useSystemNotifications";
import { AgentPanel } from "./components/AgentPanel/AgentPanel";
import { AuthorizationBubble } from "./components/AuthorizationBubble/AuthorizationBubble";
import { ConversationActions } from "./components/ConversationActions/ConversationActions";
import { MessageComposer } from "./components/MessageComposer/MessageComposer";
import { MessageList } from "./components/MessageList/MessageList";
import { NewTopicDialog } from "./components/NewTopicDialog/NewTopicDialog";
import { SettingsDialog } from "./components/SettingsDialog/SettingsDialog";
import { TopicList } from "./components/TopicList/TopicList";
import "./RoundTable.scss";

const MESSAGE_PAGE_SIZE = 60;
const POLL_INTERVAL = 3000;
const TOPIC_READ_COUNTS_STORAGE_KEY = "consilium-topic-read-message-counts";

const readTopicReadCounts = (): Record<string, number> => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(TOPIC_READ_COUNTS_STORAGE_KEY) || "{}");
    if (!value || typeof value !== "object") return {};
    return Object.entries(value).reduce<Record<string, number>>((counts, [topicId, count]) => {
      if (typeof count === "number" && Number.isFinite(count) && count >= 0) counts[topicId] = count;
      return counts;
    }, {});
  } catch {
    return {};
  }
};

const persistTopicReadCounts = (counts: Record<string, number>) => {
  try { window.localStorage.setItem(TOPIC_READ_COUNTS_STORAGE_KEY, JSON.stringify(counts)); } catch { /* Storage may be disabled. */ }
};

const isWindowForeground = () => document.visibilityState === "visible" && document.hasFocus();

const mergeMessages = (current: Message[], next: Message[]) => {
  if (!next.length) return current;
  const byId = new Map(current.map((message) => [message.id, message]));
  next.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const sameAgents = (current: Agent[], next: Agent[]) =>
  current.length === next.length && current.every((agent, index) => {
    const candidate = next[index];
    return candidate?.id === agent.id
      && candidate.name === agent.name
      && candidate.model === agent.model
      && candidate.status === agent.status
      && candidate.activeTopicId === agent.activeTopicId
      && candidate.activeTopicTitle === agent.activeTopicTitle;
  });

const sameTasks = (current: ConsiliumTask[], next: ConsiliumTask[]) =>
  current.length === next.length && current.every((task, index) =>
    next[index]?.id === task.id && next[index]?.updatedAt === task.updatedAt);

const sameAuthorizations = (current: AuthorizationRequest[], next: AuthorizationRequest[]) =>
  current.length === next.length && current.every((authorization, index) =>
    next[index]?.id === authorization.id
      && next[index]?.status === authorization.status
      && next[index]?.consumedAt === authorization.consumedAt);

const sameTopics = (current: Topic[], next: Topic[]) =>
  current.length === next.length && current.every((topic, index) => {
    const candidate = next[index];
    return candidate?.id === topic.id
      && candidate.updatedAt === topic.updatedAt
      && candidate.messageCount === topic.messageCount;
  });

export function RoundTable() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyTo, setReplyTo] = useState<Message>();
  const [replyFocusRequest, setReplyFocusRequest] = useState<{ topicId: string; id: number }>();
  const [hasMoreMessagesBefore, setHasMoreMessagesBefore] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [tasks, setTasks] = useState<ConsiliumTask[]>([]);
  const [authorizations, setAuthorizations] = useState<AuthorizationRequest[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [error, setError] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"topics" | "agents">();
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [initialTopicLoaded, setInitialTopicLoaded] = useState(false);
  const [readMessageCounts, setReadMessageCounts] = useState<Record<string, number>>(readTopicReadCounts);
  const activeIdRef = useRef<string | undefined>(undefined);
  const messagesRef = useRef<Message[]>([]);
  const replyFocusRequestIdRef = useRef(0);
  const activeTopic = topics.find((topic) => topic.id === activeId);
  const typingAgents = useMemo(() => agents.filter((agent) =>
    agent.status === "working" && agent.activeTopicId === activeId,
  ), [activeId, agents]);
  const applyTopics = useCallback((nextTopics: Topic[]) => {
    setTopics((current) => sameTopics(current, nextTopics) ? current : nextTopics);
    setReadMessageCounts((current) => {
      let changed = false;
      const next = { ...current };
      Object.entries(next).forEach(([topicId, count]) => {
        const topic = nextTopics.find((candidate) => candidate.id === topicId);
        if (!topic) {
          delete next[topicId];
          changed = true;
        } else if (count > topic.messageCount) {
          next[topicId] = topic.messageCount;
          changed = true;
        }
      });
      if (!changed) return current;
      persistTopicReadCounts(next);
      return next;
    });
  }, []);
  const markTopicRead = useCallback((topicId: string, messageCount: number) => {
    setReadMessageCounts((current) => {
      if (current[topicId] === messageCount) return current;
      const next = { ...current, [topicId]: Math.max(0, messageCount) };
      persistTopicReadCounts(next);
      return next;
    });
  }, []);
  const unreadTopicIds = useMemo(() => new Set(
    topics.filter((topic) => topic.messageCount > (readMessageCounts[topic.id] ?? 0)).map((topic) => topic.id),
  ), [readMessageCounts, topics]);
  const attentionEvents: AttentionEvent[] = [
    ...messages.filter((message) => message.authorKind === "agent" && message.mentions.includes("vous")).map((message) => ({
      id: `mention:${message.id}`,
      kind: "mention" as const,
      title: `${message.authorName} vous mentionne`,
      body: message.body.replace(/\s+/g, " ").trim().slice(0, 180) || "Un agent attend votre retour.",
    })),
    ...authorizations.filter((authorization) => authorization.status === "pending").map((authorization) => ({
      id: `authorization:${authorization.id}`,
      kind: "authorization" as const,
      title: "Autorisation demandée",
      body: `${authorization.requestedByName} souhaite ${authorization.action}.`,
    })),
    ...tasks.flatMap((task) => task.approvals.filter((approval) => approval.status === "pending").map((approval) => ({
      id: `approval:${approval.id}`,
      kind: "approval" as const,
      title: "Validation demandée",
      body: `${task.title} : ${approval.action}.`,
    }))),
  ];
  const notifications = useSystemNotifications(attentionEvents, Boolean(activeId && initialTopicLoaded));
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const loadInitialMessages = useCallback(async (topicId: string) => {
    try {
      const page = await api.messages(topicId, { limit: MESSAGE_PAGE_SIZE });
      if (activeIdRef.current !== topicId) return;
      setMessages(page.messages);
      setHasMoreMessagesBefore(page.hasMoreBefore);
      setError("");
    } catch {
      setError("Impossible de joindre la table. Vérifiez que le serveur Consilium est démarré.");
    }
  }, []);
  const refreshMessages = useCallback(async (topicId: string) => {
    const latestMessage = messagesRef.current.at(-1);
    if (!latestMessage) return loadInitialMessages(topicId);
    try {
      const next = await api.messagesSince(topicId, latestMessage.createdAt);
      if (activeIdRef.current !== topicId) return;
      setMessages((current) => mergeMessages(current, next));
      setError("");
    } catch {
      setError("Impossible de joindre la table. VÃ©rifiez que le serveur Consilium est dÃ©marrÃ©.");
    }
  }, [loadInitialMessages]);
  const refreshAgents = useCallback(async () => {
    const next = await api.agents();
    setAgents((current) => sameAgents(current, next) ? current : next);
  }, []);
  const refreshTopics = useCallback(async () => {
    applyTopics(await api.topics());
  }, [applyTopics]);
  const refreshTasks = useCallback(async (topicId: string) => {
    const next = await api.tasks(topicId);
    setTasks((current) => sameTasks(current, next) ? current : next);
  }, []);
  const refreshAuthorizations = useCallback(async (topicId: string) => {
    const next = await api.authorizations(topicId);
    setAuthorizations((current) => sameAuthorizations(current, next) ? current : next);
  }, []);
  const syncAll = useCallback(async () => {
    const [nextTopics, nextAgents] = await Promise.all([api.topics(), api.agents()]);
    applyTopics(nextTopics);
    setAgents((current) => sameAgents(current, nextAgents) ? current : nextAgents);
    if (activeId) await Promise.all([loadInitialMessages(activeId), refreshTasks(activeId), refreshAuthorizations(activeId)]);
  }, [activeId, applyTopics, loadInitialMessages, refreshAuthorizations, refreshTasks]);

  useEffect(() => {
    void Promise.all([api.topics(), api.agents()]).then(([nextTopics, nextAgents]) => {
      applyTopics(nextTopics); setAgents(nextAgents); setActiveId((current) => current || nextTopics[0]?.id);
    }).catch(() => setError("Impossible de joindre la table. Vérifiez que le serveur Consilium est démarré."));
  }, [applyTopics]);
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let timer: number | undefined;
    setInitialTopicLoaded(false);
    setMessages([]);
    setReplyTo(undefined);
    setHasMoreMessagesBefore(false);
    setAuthorizations([]);
    void Promise.allSettled([loadInitialMessages(activeId), refreshTasks(activeId), refreshAuthorizations(activeId)])
      .then(() => {
        if (cancelled) return;
        setInitialTopicLoaded(true);
        timer = window.setInterval(() => {
          void refreshTopics().catch(() => undefined);
          void refreshMessages(activeId);
          void refreshAgents();
          void refreshTasks(activeId);
          void refreshAuthorizations(activeId);
        }, POLL_INTERVAL);
      });
    return () => { cancelled = true; if (timer) window.clearInterval(timer); };
  }, [activeId, loadInitialMessages, refreshAgents, refreshAuthorizations, refreshMessages, refreshTasks, refreshTopics]);

  useEffect(() => {
    if (!activeId || !initialTopicLoaded) return;
    const markIfForeground = () => {
      if (!isWindowForeground()) return;
      const topic = topics.find((candidate) => candidate.id === activeId);
      if (topic) markTopicRead(topic.id, topic.messageCount);
    };
    markIfForeground();
    window.addEventListener("focus", markIfForeground);
    document.addEventListener("visibilitychange", markIfForeground);
    return () => {
      window.removeEventListener("focus", markIfForeground);
      document.removeEventListener("visibilitychange", markIfForeground);
    };
  }, [activeId, initialTopicLoaded, markTopicRead, topics]);

  const loadOlderMessages = useCallback(async () => {
    const topicId = activeIdRef.current;
    const oldestMessage = messagesRef.current[0];
    if (!topicId || !oldestMessage || loadingOlderMessages || !hasMoreMessagesBefore) return;
    setLoadingOlderMessages(true);
    try {
      const page = await api.messages(topicId, { before: oldestMessage.createdAt, limit: MESSAGE_PAGE_SIZE });
      if (activeIdRef.current !== topicId) return;
      setMessages((current) => mergeMessages(current, page.messages));
      setHasMoreMessagesBefore(page.hasMoreBefore);
    } finally {
      if (activeIdRef.current === topicId) setLoadingOlderMessages(false);
    }
  }, [hasMoreMessagesBefore, loadingOlderMessages]);

  const createTopic = async ({ title, description }: { title: string; description: string }) => {
    const topic = await api.createTopic(title, description);
    setTopics((current) => [topic, ...current]); setActiveId(topic.id);
  };
  const sendMessage = useCallback(async (body: string, files: File[], replyToId?: string) => {
    if (!activeId) return;
    const attachments = await Promise.all(files.map((file) => api.uploadAttachment(activeId, file)));
    const message = await api.sendMessage(activeId, body, attachments.map((attachment) => attachment.id), replyToId);
    setMessages((current) => mergeMessages(current, [message]));
    void refreshTopics().catch(() => undefined);
  }, [activeId, refreshTopics]);
  const replyToMessage = useCallback((message: Message) => {
    if (!activeId) return;
    setReplyTo(message);
    setReplyFocusRequest({ topicId: activeId, id: ++replyFocusRequestIdRef.current });
  }, [activeId]);
  const resetTopic = async () => {
    if (!activeId || !window.confirm(`Vider tous les messages de « ${activeTopic?.title} » ?`)) return;
    await api.resetTopic(activeId);
    setMessages([]); setReplyTo(undefined); setHasMoreMessagesBefore(false); setTasks([]); applyTopics(await api.topics());
  };
  const deleteTopic = async () => {
    if (!activeId || !window.confirm(`Supprimer définitivement « ${activeTopic?.title} » et ses médias ?`)) return;
    await api.deleteTopic(activeId);
    const nextTopics = await api.topics();
    applyTopics(nextTopics); setActiveId(nextTopics[0]?.id); setMessages([]); setReplyTo(undefined); setHasMoreMessagesBefore(false); setTasks([]);
  };
  const disconnectAgent = async (agentId: string) => {
    const agent = agents.find((candidate) => candidate.id === agentId);
    if (!window.confirm(`Déconnecter ${agent?.name || agentId} de la table ?`)) return;
    await api.disconnectAgent(agentId);
    await refreshAgents();
  };
  const createTask = async (input: { title: string; description: string; assignedAgentId?: string }) => {
    if (!activeId) return;
    await api.createTask({ topicId: activeId, ...input });
    await refreshTasks(activeId);
  };
  const addTaskInstruction = async (taskId: string, body: string) => {
    if (!activeId) return;
    await api.addTaskInstruction(taskId, body);
    await refreshTasks(activeId);
  };
  const resolveApproval = async (taskId: string, approvalId: string, decision: "approved" | "rejected", note?: string) => {
    if (!activeId) return;
    await api.resolveApproval(taskId, approvalId, decision, note);
    await refreshTasks(activeId);
  };
  const cancelTask = async (taskId: string) => {
    if (!activeId || !window.confirm("Arrêter cette tâche et demander au worker de se terminer ?")) return;
    await api.cancelTask(taskId);
    await refreshTasks(activeId);
  };
  const resolveAuthorization = async (authorizationId: string, decision: "approved" | "rejected") => {
    if (!activeId) return;
    await api.resolveAuthorization(authorizationId, decision);
    await refreshAuthorizations(activeId);
  };

  const closeMobilePanel = () => setMobilePanel(undefined);
  const roundTableClassName = [
    "round-table",
    mobilePanel ? `round-table--${mobilePanel}-open` : "",
    leftPanelCollapsed ? "round-table--left-collapsed" : "",
    rightPanelCollapsed ? "round-table--right-collapsed" : "",
  ].filter(Boolean).join(" ");

  return <section className={roundTableClassName}>
    <TopicList topics={topics} activeId={activeId} unreadTopicIds={unreadTopicIds} onSelect={(id) => { setActiveId(id); closeMobilePanel(); }} onCreate={() => { closeMobilePanel(); setNewTopicOpen(true); }} onMobileClose={closeMobilePanel} />
    <section className="round-table__conversation">
      <header className="round-table__header">
        <div className="round-table__topic"><button className="round-table__panel-toggle round-table__panel-toggle--left" onClick={() => setLeftPanelCollapsed((collapsed) => !collapsed)} aria-label={leftPanelCollapsed ? "Afficher les sujets" : "Rétracter les sujets"} aria-expanded={!leftPanelCollapsed} title={leftPanelCollapsed ? "Afficher les sujets" : "Rétracter les sujets"}><Icon name={leftPanelCollapsed ? "chevron_right" : "chevron_left"} /></button><button className="round-table__mobile-nav" onClick={() => setMobilePanel("topics")} aria-label="Afficher les sujets"><Icon name="menu" /></button><span className="round-table__topic-icon"><Icon name="forum" filled /></span><div className="round-table__topic-copy"><h1>{activeTopic?.title || "La table se prépare…"}</h1><p>{activeTopic?.description || "Contexte partagé entre humains et agents"}</p></div></div>
        <div className="round-table__actions"><button className="round-table__panel-toggle round-table__panel-toggle--right" onClick={() => setRightPanelCollapsed((collapsed) => !collapsed)} aria-label={rightPanelCollapsed ? "Afficher les participants" : "Rétracter les participants"} aria-expanded={!rightPanelCollapsed} title={rightPanelCollapsed ? "Afficher les participants" : "Rétracter les participants"}><Icon name={rightPanelCollapsed ? "chevron_left" : "chevron_right"} /></button><button className="round-table__settings" onClick={() => setSettingsOpen(true)} aria-label="Ouvrir les paramètres" title="Paramètres"><Icon name="settings" /></button><ConversationActions disabled={!activeId} onReset={() => void resetTopic()} onDelete={() => void deleteTopic()} /></div>
        <button className="round-table__mobile-participants" onClick={() => setMobilePanel("agents")} aria-label="Afficher les participants"><Icon name="group" /></button>
      </header>
      {error ? <div className="round-table__error"><Icon name="cloud_off" />{error}</div> : <MessageList messages={messages} typingAgents={typingAgents} hasMoreBefore={hasMoreMessagesBefore} loadingOlder={loadingOlderMessages} onLoadOlder={loadOlderMessages} onReply={replyToMessage} />}
      <div className="round-table__composer-area">
        <AuthorizationBubble requests={authorizations} onResolve={resolveAuthorization} />
        <MessageComposer key={activeId} topicId={activeId} agents={agents} disabled={!activeId || Boolean(error)} replyTo={replyTo} replyFocusRequest={replyFocusRequest?.topicId === activeId ? replyFocusRequest?.id : undefined} onCancelReply={() => setReplyTo(undefined)} onSend={sendMessage} />
      </div>
    </section>
    {!rightPanelCollapsed && <button className="round-table__tablet-backdrop" onClick={() => setRightPanelCollapsed(true)} aria-label="Fermer le volet des participants" />}
    <AgentPanel
      agents={agents}
      activeTopicId={activeId}
      tasks={tasks}
      onDisconnect={(id) => void disconnectAgent(id)}
      onRefreshAgents={refreshAgents}
      onCreateTask={createTask}
      onTaskInstruction={addTaskInstruction}
      onResolveApproval={resolveApproval}
      onCancelTask={cancelTask}
      onClose={() => setRightPanelCollapsed(true)}
      onMobileClose={closeMobilePanel}
    />
    {mobilePanel && <button className="round-table__mobile-backdrop" onClick={closeMobilePanel} aria-label="Fermer le panneau" />}
    <NewTopicDialog open={newTopicOpen} onClose={() => setNewTopicOpen(false)} onCreate={createTopic} />
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} notificationPermission={notifications.permission} notificationsEnabled={notifications.enabled} onToggleNotifications={() => void notifications.toggle()} onSync={syncAll} />
  </section>;
}
