import { useCallback, useEffect, useState } from "react";
import type { Agent, ConsiliumTask, Message, Topic } from "@consilium/core";
import { api } from "../../core/api";
import { Icon } from "../../shared/components/Icon/Icon";
import { AgentPanel } from "./components/AgentPanel/AgentPanel";
import { ConversationActions } from "./components/ConversationActions/ConversationActions";
import { MessageComposer } from "./components/MessageComposer/MessageComposer";
import { MessageList } from "./components/MessageList/MessageList";
import { RemoteAccessIndicator } from "./components/RemoteAccessIndicator/RemoteAccessIndicator";
import { TopicList } from "./components/TopicList/TopicList";
import "./RoundTable.scss";

export function RoundTable() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<ConsiliumTask[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [error, setError] = useState("");
  const activeTopic = topics.find((topic) => topic.id === activeId);
  const loadMessages = useCallback(async (topicId: string) => {
    try { setMessages(await api.messages(topicId)); setError(""); } catch { setError("Impossible de joindre la table. Vérifiez que le serveur Consilium est démarré."); }
  }, []);
  const refreshAgents = useCallback(async () => setAgents(await api.agents()), []);
  const refreshTasks = useCallback(async (topicId: string) => setTasks(await api.tasks(topicId)), []);
  const syncAll = useCallback(async () => {
    const [nextTopics, nextAgents] = await Promise.all([api.topics(), api.agents()]);
    setTopics(nextTopics);
    setAgents(nextAgents);
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

  const createTopic = async () => {
    const title = window.prompt("Nom du nouveau sujet");
    if (!title?.trim()) return;
    const topic = await api.createTopic(title.trim());
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

  return <section className="round-table">
    <TopicList topics={topics} activeId={activeId} onSelect={setActiveId} onCreate={() => void createTopic()} onSync={syncAll} />
    <section className="round-table__conversation">
      <header className="round-table__header">
        <div><span className="round-table__topic-icon"><Icon name="forum" filled /></span><div><h1>{activeTopic?.title || "La table se prépare…"}</h1><p>{activeTopic?.description || "Contexte partagé entre humains et agents"}</p></div></div>
        <div className="round-table__actions"><RemoteAccessIndicator /><button aria-label="Rechercher"><Icon name="search" /></button><ConversationActions disabled={!activeId} onReset={() => void resetTopic()} onDelete={() => void deleteTopic()} /></div>
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
    />
  </section>;
}
