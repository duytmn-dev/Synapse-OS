import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSynapseBridge } from './hooks/useSynapseBridge';
import type { ChatMessage, Conversation, TargetAgent, ViewMode } from '../ui/chat/types';
import { getAgentMeta } from '../ui/agents';
import { TopBar } from '../ui/layout/TopBar';
import { Sidebar } from '../ui/sidebar/Sidebar';
import { ChatPanel } from '../ui/chat/ChatPanel';
import { KnowledgeGraphPanel } from '../ui/graph/KnowledgeGraphPanel';
import { TaskTree } from '../ui/tasks/TaskTree';
import { ChatManagementModals, type ChatMenuTarget } from '../ui/chat/ChatManagementModals';
import { ProjectManagementModals, type ProjectMenuTarget } from '../ui/sidebar/ProjectManagementModals';
import { SettingsModal } from '../ui/settings/SettingsModal';
import type { ShadowProjectMeta } from '@shared/types';

interface ProjectCustomOverride {
  customName?: string;
  isPinned?: boolean;
  isDeleted?: boolean;
}

const PROJECT_OVERRIDES_STORAGE_KEY = 'synapse_project_overrides_v1';

const loadProjectOverrides = (): Record<string, ProjectCustomOverride> => {
  try {
    const raw = localStorage.getItem(PROJECT_OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveProjectOverrides = (overrides: Record<string, ProjectCustomOverride>) => {
  try {
    localStorage.setItem(PROJECT_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn('Failed to save project overrides', e);
  }
};

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
    pickShadowProject,
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
  const geminiPending = useRef(false);
  const geminiHistory = useRef(new Map<string, { role: 'user' | 'assistant'; text: string }[]>());
  const [highlight, setHighlight] = useState<string | null>(null);
  const openingProject = useRef(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Chat Popover & Modal state (07 Quản lý chat.svg)
  const [menuTarget, setMenuTarget] = useState<ChatMenuTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<ChatMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMenuTarget | null>(null);

  // Project Overrides & Modals state
  const [projectOverrides, setProjectOverrides] = useState<Record<string, ProjectCustomOverride>>(loadProjectOverrides);
  const [projectMenuTarget, setProjectMenuTarget] = useState<ProjectMenuTarget | null>(null);
  const [projectRenameTarget, setProjectRenameTarget] = useState<ProjectMenuTarget | null>(null);
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<ProjectMenuTarget | null>(null);

  // Danh sách dự án kết hợp với các tùy chỉnh (đổi tên, ghim, ẩn dự án đã xóa)
  const effectiveProjects: ShadowProjectMeta[] = useMemo(() => {
    return shadowProjects
      .filter((p) => !projectOverrides[p.project_hash]?.isDeleted)
      .map((p) => {
        const override = projectOverrides[p.project_hash];
        return {
          ...p,
          project_name: override?.customName || p.project_name,
          is_pinned: override?.isPinned ?? p.is_pinned ?? false,
        };
      });
  }, [shadowProjects, projectOverrides]);

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

  const currentProject = effectiveProjects.find((p) => p.project_hash === activeProjectHash);
  const projectTitle = currentProject?.project_name ?? (graphData?.project_hash ? 'Synapse OS' : 'Chưa mở dự án');

  const threadId = activeId || activeProjectHash || 'default';
  const messages = threads[threadId] ?? [
    {
      id: 'welcome',
      author: 'system',
      authorName: 'AGENT HQ',
      time: now(),
      text: 'Chào mừng bạn đến với Synapse OS. Hãy nhập yêu cầu để Triage Router điều phối các Agent xử lý.',
    },
  ];

  const handleSend = useCallback(
    async (text: string, target: TargetAgent, files: File[]) => {
      const agent = target === 'auto' ? networkSettings.default_chat_agent_id : target;
      const isGemini = agent === 'gemini' || agent === 'gemini_antigravity';
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
      const unavailable = !isGemini ? (agent === 'auto'
        ? 'Chọn @Gemini để gửi tin nhắn hoặc đặt Gemini làm agent chat mặc định.'
        : `Luồng gửi tin nhắn cho ${getAgentMeta(agent).label} chưa được nối.`)
        : files.length ? 'Luồng chat Gemini hiện hỗ trợ văn bản. Hãy gửi lại tin nhắn không kèm tệp.'
        : geminiPending.current ? 'Gemini đang xử lý một tin nhắn khác. Hãy đợi phản hồi rồi gửi lại.'
        : !window.synapse?.sendGeminiMessage ? 'Hãy mở bản Synapse OS Electron mới để gửi tin nhắn.' : null;
      const response: ChatMessage = {
        id: crypto.randomUUID(),
        author: 'system',
        authorName: isGemini ? 'Gemini' : 'AGENT HQ',
        time: now(),
        text: unavailable ?? 'Đang chờ Gemini trả lời…',
      };
      setThreads((t) => ({ ...t, [threadId]: [...(t[threadId] ?? []), userMsg, response] }));
      if (unavailable) return;
      geminiPending.current = true;
      const finish = (reply: string, failed = false) => {
        setThreads((state) => ({
          ...state,
          [threadId]: (state[threadId] ?? []).map((item) => item.id === response.id
            ? { ...item, authorName: failed ? 'AGENT HQ' : item.authorName, text: reply, time: now() }
            : item),
        }));
      };
      try {
        const history = geminiHistory.current.get(threadId) ?? [];
        const withHistory = `Ngữ cảnh gần đây: ${JSON.stringify(history)}\n\nTin nhắn mới: ${text}`;
        const message = history.length && withHistory.length <= 32000 ? withHistory : text;
        const reply = await window.synapse.sendGeminiMessage(message);
        geminiHistory.current.set(threadId, [
          ...history.slice(-4),
          { role: 'user', text: text.slice(0, 1600) },
          { role: 'assistant', text: reply.slice(0, 1600) },
        ]);
        finish(reply);
      } catch (error) {
        const reason = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') : 'Không nhận được phản hồi.';
        finish(`Không gửi được tới Gemini. ${reason}`, true);
      } finally {
        geminiPending.current = false;
      }
    },
    [threadId, networkSettings.default_chat_agent_id],
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

  // Xử lý Ghim / Bỏ ghim dự án
  const handleTogglePinProject = (projectHash: string) => {
    setProjectOverrides((prev) => {
      const current = prev[projectHash] || {};
      const updated = {
        ...prev,
        [projectHash]: {
          ...current,
          isPinned: !current.isPinned,
        },
      };
      saveProjectOverrides(updated);
      return updated;
    });
    setProjectMenuTarget(null);
  };

  // Xử lý Đổi tên dự án
  const handleConfirmRenameProject = (projectHash: string, newName: string) => {
    setProjectOverrides((prev) => {
      const current = prev[projectHash] || {};
      const updated = {
        ...prev,
        [projectHash]: {
          ...current,
          customName: newName,
        },
      };
      saveProjectOverrides(updated);
      return updated;
    });
    setProjectRenameTarget(null);
  };

  // Xử lý Xóa dự án khỏi không gian làm việc
  const handleConfirmDeleteProject = (projectHash: string) => {
    setProjectOverrides((prev) => {
      const current = prev[projectHash] || {};
      const updated = {
        ...prev,
        [projectHash]: {
          ...current,
          isDeleted: true,
        },
      };
      saveProjectOverrides(updated);
      return updated;
    });

    if (activeProjectHash === projectHash) {
      const remaining = effectiveProjects.filter((p) => p.project_hash !== projectHash);
      if (remaining.length > 0) {
        selectProject(remaining[0].project_hash);
      }
    }
    setProjectDeleteTarget(null);
  };

  const handleOpenProjectFolder = async () => {
    if (openingProject.current) return;
    openingProject.current = true;
    setProjectError(null);
    try {
      await pickShadowProject();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectError(message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''));
    } finally {
      openingProject.current = false;
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

      {projectError && <p role="alert" className="text-sm text-red-300">Không thể mở dự án. {projectError}</p>}

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
          projects={effectiveProjects}
          activeProjectHash={activeProjectHash}
          onSelectProject={selectProject}
          onOpenProject={handleOpenProjectFolder}
          onOpenProjectMenu={(target) => setProjectMenuTarget(target)}
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

      {/* Popover Context Menu & Modals for Project Management */}
      <ProjectManagementModals
        menuTarget={projectMenuTarget}
        onCloseMenu={() => setProjectMenuTarget(null)}
        onOpenRename={(target) => {
          setProjectMenuTarget(null);
          setProjectRenameTarget(target);
        }}
        onTogglePin={handleTogglePinProject}
        onOpenDelete={(target) => {
          setProjectMenuTarget(null);
          setProjectDeleteTarget(target);
        }}
        renameTarget={projectRenameTarget}
        onCloseRename={() => setProjectRenameTarget(null)}
        onConfirmRename={handleConfirmRenameProject}
        deleteTarget={projectDeleteTarget}
        onCloseDelete={() => setProjectDeleteTarget(null)}
        onConfirmDelete={handleConfirmDeleteProject}
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
