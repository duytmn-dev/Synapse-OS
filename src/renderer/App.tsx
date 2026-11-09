import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSynapseBridge } from './hooks/useSynapseBridge';
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
    shadowProjects,
    chatSessions,
    activeProjectHash,
    networkSettings,
    appearanceSettings,
    toolDependencies,
    workspaceStorage,
    updateStatus,
    selectProject,
    openShadowProject,
    mutateChatSession,
    agentConnectionAction,
    setFallbackOnError,
    setAgentAlertThreshold,
    saveAgentKey,
    setDefaultChatAgent,
    saveAppearanceSettings,
    ensureToolDependency,
    controlGraphNode,
  } = useSynapseBridge();

  const [mode, setMode] = useState<ViewMode>('graph');
  const [localConversations, setLocalConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const [highlight, setHighlight] = useState<string | null>(null);

  // Chat Popover & Modal state (07 Quản lý chat.svg)
  const [menuTarget, setMenuTarget] = useState<ChatMenuTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<ChatMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMenuTarget | null>(null);

  // Settings State (02 & 03 Cài đặt.svg)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Đồng bộ danh sách hội thoại từ SQLite chatSessions thật
  const conversations: Conversation[] = useMemo(() => {
    if (chatSessions && chatSessions.length > 0) {
      return chatSessions.map((s) => ({
        id: s.session_id,
        title: s.title,
        isPinned: s.is_pinned,
        projectHash: s.project_hash,
        updatedAt: s.updated_at,
      }));
    }
    return localConversations;
  }, [chatSessions, localConversations]);

  // Cập nhật activeId khi danh sách conversations thay đổi
  useEffect(() => {
    if (conversations.length > 0) {
      const exists = conversations.some((c) => c.id === activeId);
      if (!exists || !activeId) {
        setActiveId(conversations[0].id);
      }
    } else {
      setActiveId('');
    }
  }, [conversations, activeId]);

  const active = conversations.find((c) => c.id === activeId) ?? {
    id: 'empty',
    title: 'Cuộc trò chuyện mới',
  };

  const currentProject = shadowProjects.find((p) => p.project_hash === activeProjectHash);
  const projectTitle = currentProject?.project_name ?? (graphData?.project_hash ? 'Synapse OS' : 'Chưa mở dự án');

  const messages = threads[activeId] ?? [
    {
      id: 'welcome',
      author: 'system',
      authorName: 'AGENT HQ',
      time: now(),
      text: 'Chào mừng bạn đến với Synapse OS. Hãy nhập yêu cầu để Triage Router điều phối các Agent xử lý.',
    },
  ];

  const handleSend = useCallback(
    (text: string, target: TargetAgent, files: File[]) => {
      const currentActiveId = activeId || 'default';
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        author: 'user',
        authorName: 'Bạn',
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
      setThreads((t) => ({ ...t, [currentActiveId]: [...(t[currentActiveId] ?? []), userMsg, ack] }));
    },
    [activeId],
  );

  const newConversation = async () => {
    if (activeProjectHash) {
      const updated = await mutateChatSession({
        action: 'CREATE',
        project_hash: activeProjectHash,
        new_title: `Cuộc trò chuyện ${conversations.length + 1}`,
      });
      if (updated.length > 0) {
        setActiveId(updated[0].session_id);
      }
    } else {
      const c: Conversation = {
        id: crypto.randomUUID(),
        title: `Cuộc trò chuyện ${conversations.length + 1}`,
        updatedAt: Date.now(),
      };
      setLocalConversations((prev) => [c, ...prev]);
      setActiveId(c.id);
    }
  };

  const handleTogglePin = async (id: string) => {
    if (activeProjectHash) {
      await mutateChatSession({
        action: 'TOGGLE_PIN',
        project_hash: activeProjectHash,
        session_id: id,
      });
    } else {
      setLocalConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c)),
      );
    }
    setMenuTarget(null);
  };

  const handleConfirmRename = async (id: string, newTitle: string) => {
    if (activeProjectHash) {
      await mutateChatSession({
        action: 'RENAME',
        project_hash: activeProjectHash,
        session_id: id,
        new_title: newTitle,
      });
    } else {
      setLocalConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
      );
    }
    setRenameTarget(null);
  };

  const handleConfirmDelete = async (id: string) => {
    if (activeProjectHash) {
      await mutateChatSession({
        action: 'DELETE',
        project_hash: activeProjectHash,
        session_id: id,
      });
    } else {
      setLocalConversations((prev) => prev.filter((c) => c.id !== id));
    }
    setDeleteTarget(null);
  };

  const handleOpenProjectFolder = async () => {
    const inputPath = window.prompt('Nhập đường dẫn thư mục dự án cần mở:');
    if (inputPath && inputPath.trim()) {
      await openShadowProject(inputPath.trim());
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#080E18] text-[#EAF2FF] p-3 gap-3 bg-grid-dashboard font-sans">
      {/* TopBar Header */}
      <TopBar
        projectTitle={projectTitle}
        mode={mode}
        onModeChange={setMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectProject={handleOpenProjectFolder}
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
          projects={shadowProjects}
          activeProjectHash={activeProjectHash}
          onSelectProject={selectProject}
          onOpenProject={handleOpenProjectFolder}
        />

        {/* Center Column: Chat & Preview */}
        <ChatPanel
          title={active.title}
          projectPathSubtitle={`${projectTitle} / Chat dự án`}
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
                projectHash={activeProjectHash || 'default'}
                onControlNode={controlGraphNode}
              />
            </div>
            <div className="h-[45%] min-h-0">
              <TaskTree
                projectTitle={projectTitle}
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
