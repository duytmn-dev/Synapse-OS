import { useCallback, useState } from 'react';
import { useSynapseBridge } from './hooks/useSynapseBridge';
import {
  DEMO_CONVERSATIONS,
  DEMO_MESSAGES,
} from './mock/demoData';
import type { ChatMessage, Conversation, TargetAgent, ViewMode } from '../ui/chat/types';
import { getAgentMeta } from '../ui/agents';
import { TopBar } from '../ui/layout/TopBar';
import { Sidebar } from '../ui/sidebar/Sidebar';
import { ChatPanel } from '../ui/chat/ChatPanel';
import { KnowledgeGraphPanel } from '../ui/graph/KnowledgeGraphPanel';
import { TaskTree } from '../ui/tasks/TaskTree';
import { ChatManagementModals, type ChatMenuTarget } from '../ui/chat/ChatManagementModals';
import { SettingsModal } from '../ui/settings/SettingsModal';

const now = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export default function App() {
  const {
    quota,
    tasks,
    live,
    graphActiveEvent,
    graphData,
    networkSettings,
    appearanceSettings,
    toolDependencies,
    workspaceStorage,
    updateStatus,
    agentConnectionAction,
    setFallbackOnError,
    setAgentAlertThreshold,
    saveAgentKey,
    setDefaultChatAgent,
    saveAppearanceSettings,
    ensureToolDependency,
  } = useSynapseBridge();

  const [mode, setMode] = useState<ViewMode>('graph');
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeId, setActiveId] = useState(DEMO_CONVERSATIONS[0].id);
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({
    [DEMO_CONVERSATIONS[0].id]: DEMO_MESSAGES,
  });
  const [highlight, setHighlight] = useState<string | null>(null);

  // Chat Popover & Modal state (07 Quản lý chat.svg)
  const [menuTarget, setMenuTarget] = useState<ChatMenuTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<ChatMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMenuTarget | null>(null);

  // Settings State (02 & 03 Cài đặt.svg)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const messages = threads[activeId] ?? [];

  const handleSend = useCallback(
    (text: string, target: TargetAgent, files: File[]) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        author: 'user',
        authorName: 'Justin',
        time: now(),
        text,
        attachments: files.map((f) => ({
          name: f.name,
          sizeLabel: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
          kind: f.type.startsWith('video') ? 'video' : 'file',
        })),
      };
      const ack: ChatMessage = {
        id: crypto.randomUUID(),
        author: 'system',
        authorName: 'AGENT HQ',
        time: now(),
        text:
          target === 'auto'
            ? 'Đã nhận yêu cầu. Triage Router sẽ phân loại Fast-Path / DAG-Path.'
            : `Đã chuyển yêu cầu tới @${getAgentMeta(target).label}.`,
      };
      setThreads((t) => ({ ...t, [activeId]: [...(t[activeId] ?? []), userMsg, ack] }));
    },
    [activeId],
  );

  const newConversation = () => {
    const c: Conversation = {
      id: crypto.randomUUID(),
      title: `Cuộc trò chuyện ${conversations.length + 1}`,
      updatedAt: Date.now(),
    };
    setConversations([c, ...conversations]);
    setActiveId(c.id);
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c)),
    );
    setMenuTarget(null);
  };

  const handleConfirmRename = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
    );
    setRenameTarget(null);
  };

  const handleConfirmDelete = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (activeId === id && filtered.length > 0) {
        setActiveId(filtered[0].id);
      }
      return filtered;
    });
    setDeleteTarget(null);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#080E18] text-[#EAF2FF] p-3 gap-3 bg-grid-dashboard font-sans">
      {/* TopBar Header */}
      <TopBar
        projectTitle="Video 360 Highlights"
        mode={mode}
        onModeChange={setMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main 3-Column Layout */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Left Column: Sidebar (225px) */}
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={newConversation}
          quota={quota}
          live={live}
          onOpenChatMenu={(target) => setMenuTarget(target)}
        />

        {/* Center Column: Chat & Preview */}
        <ChatPanel
          title={active.title}
          projectPathSubtitle="Video 360 Highlights / Chat dự án"
          messages={messages}
          connectedAgents={quota}
          onSend={handleSend}
          onFocusGraph={() => setMode('graph')}
        />

        {/* Right Column: Knowledge Graph + DAG Task Tree (When Chat + Graph mode is active) */}
        {mode === 'graph' && (
          <aside className="flex min-h-0 w-[480px] shrink-0 flex-col gap-3 xl:w-[540px]">
            <div className="h-[55%] min-h-0">
              <KnowledgeGraphPanel
                isRunning={true}
                activeEvent={graphActiveEvent}
                graphData={graphData}
              />
            </div>
            <div className="h-[45%] min-h-0">
              <TaskTree
                projectTitle="Tool cắt video 360"
                tasks={tasks}
                highlightCode={highlight}
                onHover={setHighlight}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Popover Context Menu & Modals for Chat Management (07 Quản lý chat.svg) */}
      <ChatManagementModals
        menuTarget={menuTarget}
        onCloseMenu={() => setMenuTarget(null)}
        onOpenRename={(target) => {
          setMenuTarget(null);
          setRenameTarget(target);
        }}
        onTogglePin={handleTogglePin}
        onOpenDelete={(target) => {
          setMenuTarget(null);
          setDeleteTarget(target);
        }}
        renameTarget={renameTarget}
        onCloseRename={() => setRenameTarget(null)}
        onConfirmRename={handleConfirmRename}
        deleteTarget={deleteTarget}
        onCloseDelete={() => setDeleteTarget(null)}
        onConfirmDelete={handleConfirmDelete}
      />

      {/* Settings Modal (02 & 03 Cài đặt.svg) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        networkSettings={networkSettings}
        toolDependencies={toolDependencies}
        workspaceStorage={workspaceStorage}
        appearanceSettings={appearanceSettings}
        updateStatus={updateStatus}
        onAgentConnectionAction={agentConnectionAction}
        onSetFallbackOnError={setFallbackOnError}
        onSetAgentAlertThreshold={setAgentAlertThreshold}
        onSaveAgentKey={saveAgentKey}
        onSetDefaultChatAgent={setDefaultChatAgent}
        onSaveAppearanceSettings={saveAppearanceSettings}
        onEnsureToolDependency={ensureToolDependency}
      />
    </div>
  );
}
