import { useCallback, useEffect, useState } from "react";
import type { Agent, ConsiliumTask, Message, Topic } from "@consilium/core";
import { api } from "../../core/api";
import { Icon } from "../../shared/components/Icon/Icon";
import { AgentPanel } from "./components/AgentPanel/AgentPanel";
import { ConversationActions } from "./components/ConversationActions/ConversationActions";
import { MessageComposer } from "./components/MessageComposer/MessageComposer";
import { MessageList } from "./components/MessageList/MessageList";
import { NewTopicDialog } from "./components/NewTopicDialog/NewTopicDialog";
import { TopicList } from "./components/TopicList/TopicList";
import "./RoundTable.scss";

const sameMessages = (current: Message[], next: Message[]) =>
  current.length === next.length && current.every((message, index) => {
    const candidate = next[index];
    return candidate?.id === message.id
      && candidate.body === message.body
      && candidate.attachments.length === message.attachments.length;
  });

const sameAgents = (current: Agent[], next: Agent[]) =>
  current.length === next.length && current.every((agent, index) => {
    const candidate = next[index];
    return candidate?.id === agent.id
      && candidate.name === agent.name
      && candidate.model === agent.model
      && candidate.status === agent.status;
  });

const sameTasks = (current: ConsiliumTask[], next: ConsiliumTask[]) =>
  current.length === next.length && current.every((task, index) =>
    next[index]?.id === task.id && next[index]?.updatedAt === task.updatedAt);

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
  const [tasks, setTasks] = useState<ConsiliumTask[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [error, setError] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"topics" | "agents">();
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const activeTopic = topics.find((topic) => topic.id === activeId);
  const loadMessages = useCallback(async (topicId: string) => {
    try {
      const next = await api.messages(topicId);
      setMessages((current) => sameMessages(current, next) ? current : next);
      setError("");
    } catch {
      setError("Impossible de joindre la table. Vérifiez que le serveur Consilium est démarré.");
    }
  }, []);
  const refreshAgents = useCallback(async () => {
    const next = await api.agents();
    setAgents((current) => sameAgents(current, next) ? current : next);
  }, []);
  const refreshTasks = useCallback(async (topicId: string) => {
    const next = await api.tasks(topicId);
    setTasks((current) => sameTasks(current, next) ? current : next);
  }, []);
  const syncAll = useCallback(async () => {
    const [nextTopics, nextAgents] = await Promise.all([api.topics(), api.agents()]);
    setTopics((current) => sameTopics(current, nextTopics) ? current : nextTopics);
    setAgents((current) => sameAgents(current, nextAgents) ? current : nextAgents);
    if (activeId) await Promise.all([loadMessages(activeId), refreshTasks(activeId)]);
  }, [activeId, loadMessages, refreshTasks]);

  useEffect(() => {
    void Promise.all([api.topics(), api.agents()]).then(([nextTopics, nextAgents]) => {
      setTopics(nextTopics); setAgents(nextAgents); setActiveId((current) => current || nextTopics[0]?.id);
    }).catch(() => setError("Impossible de joindre la table. Vérifiez que le serveur Consilium est démarré."));
  }, []);
  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    void refreshTasks(activeId);
    const timer = window.setInterval(() => { void loadMessages(activeId); void refreshAgents(); void refreshTasks(activeId); }, 3000);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages, refreshAgents, refreshTasks]);

  const createTopic = async ({ title, description }: { title: string; description: string }) => {
    const topic = await api.createTopic(title, description);
    setTopics((current) => [topic, ...current]); setActiveId(topic.id);
  };
  const sendMessage = async (body: string, files: File[]) => {
    if (!activeId) return;
    const attachments = await Promise.all(files.map((file) => api.uploadAttachment(activeId, file)));
    const message = await api.sendMessage(activeId, body, attachments.map((attachment) => attachment.id));
    setMessages((current) => [...current, message]); setTopics(await api.topics());
  };
  const resetTopic = async () => {
    if (!activeId || !window.confirm(`Vider tous les messages de « ${activeTopic?.title} » ?`)) return;
    await api.resetTopic(activeId);
    setMessages([]); setTasks([]); setTopics(await api.topics());
  };
  const deleteTopic = async () => {
    if (!activeId || !window.confirm(`Supprimer définitivement « ${activeTopic?.title} » et ses médias ?`)) return;
    await api.deleteTopic(activeId);
    const nextTopics = await api.topics();
    setTopics(nextTopics); setActiveId(nextTopics[0]?.id); setMessages([]); setTasks([]);
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

  const closeMobilePanel = () => setMobilePanel(undefined);

  return <section className={`round-table${mobilePanel ? ` round-table--${mobilePanel}-open` : ""}`}>
    <TopicList topics={topics} activeId={activeId} onSelect={(id) => { setActiveId(id); closeMobilePanel(); }} onCreate={() => { closeMobilePanel(); setNewTopicOpen(true); }} onSync={syncAll} onMobileClose={closeMobilePanel} />
    <section className="round-table__conversation">
      <header className="round-table__header">
        <div className="round-table__topic"><button className="round-table__mobile-nav" onClick={() => setMobilePanel("topics")} aria-label="Afficher les sujets"><Icon name="menu" /></button><span className="round-table__topic-icon"><Icon name="forum" filled /></span><div className="round-table__topic-copy"><h1>{activeTopic?.title || "La table se prépare…"}</h1><p>{activeTopic?.description || "Contexte partagé entre humains et agents"}</p></div></div>
        <div className="round-table__actions"><button aria-label="Rechercher"><Icon name="search" /></button><ConversationActions disabled={!activeId} onReset={() => void resetTopic()} onDelete={() => void deleteTopic()} /></div>
        <button className="round-table__mobile-participants" onClick={() => setMobilePanel("agents")} aria-label="Afficher les participants"><Icon name="group" /></button>
      </header>
      {error ? <div className="round-table__error"><Icon name="cloud_off" />{error}</div> : <MessageList messages={messages} />}
      <MessageComposer agents={agents} disabled={!activeId || Boolean(error)} onSend={sendMessage} />
    </section>
    <AgentPanel
      agents={agents}
      tasks={tasks}
      onDisconnect={(id) => void disconnectAgent(id)}
      onRefreshAgents={refreshAgents}
      onCreateTask={createTask}
      onTaskInstruction={addTaskInstruction}
      onResolveApproval={resolveApproval}
      onCancelTask={cancelTask}
      onMobileClose={closeMobilePanel}
    />
    {mobilePanel && <button className="round-table__mobile-backdrop" onClick={closeMobilePanel} aria-label="Fermer le panneau" />}
    <NewTopicDialog open={newTopicOpen} onClose={() => setNewTopicOpen(false)} onCreate={createTopic} />
  </section>;
}
