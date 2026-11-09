import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSynapseBridge } from './hooks/useSynapseBridge';
import type { ChatMessage, TargetAgent, ViewMode } from '../ui/chat/types';
import type { ChatAgent, ChatTurn } from '../main/ipc';
import { TopBar } from '../ui/layout/TopBar';
import { Sidebar } from '../ui/sidebar/Sidebar';
import { ChatPanel } from '../ui/chat/ChatPanel';
import { KnowledgeGraphPanel } from '../ui/graph/KnowledgeGraphPanel';
import { TaskTree } from '../ui/tasks/TaskTree';
import { ChatManagementModals, type ChatMenuTarget } from '../ui/chat/ChatManagementModals';
import { ProjectManagementModals, type ProjectMenuTarget } from '../ui/sidebar/ProjectManagementModals';
import { SettingsModal } from '../ui/settings/SettingsModal';
import type { ChatSessionMutationRequest, ShadowProjectMeta } from '@shared/types';

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

function chatErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ChatMessage>;
  return typeof message.id === 'string' && (message.author === 'user' || message.author === 'system') &&
    typeof message.authorName === 'string' && typeof message.time === 'string' && typeof message.text === 'string';
}

function agentHistoryFrom(items: unknown[]): ChatTurn[] {
  const messages = items.filter(isChatMessage);
  return messages.flatMap((reply, index) => {
    const request = messages[index - 1];
    const agentId = typeof reply.agentId === 'string' ? reply.agentId :
      ['Gemini', 'Codex'].includes(reply.authorName) ? reply.authorName.toLowerCase() : undefined;
    return reply.author === 'system' && agentId && request?.author === 'user'
      ? [{ agentId, request: request.text.slice(0, 1600), reply: reply.text.slice(0, 1600) }]
      : [];
  }).slice(-24);
}

export default function App() {
  const {
    quota,
    tasks,
    live,
    graphActiveEvent,
    graphData,
    shadowProjects,
    standaloneSessions,
    activeProjectHash,
    networkSettings,
    appearanceSettings,
    toolDependencies,
    workspaceStorage,
    updateStatus,
    selectProject,
    pickShadowProject,
    mutateChatSession,
    saveChatMessages,
    agentConnectionAction,
    setFallbackOnError,
    setAgentAlertThreshold,
    saveAgentKey,
    saveAppearanceSettings,
    ensureToolDependency,
    controlGraphNode,
  } = useSynapseBridge();

  const [mode, setMode] = useState<ViewMode>('graph');
  const [activeId, setActiveId] = useState<string>('');
  const [threads, setThreads] = useState<Record<string, unknown[]>>({});
  const threadsRef = useRef(threads);
  const navigation = useRef(0);
  const creating = useRef(false);
  const [createPending, setCreatePending] = useState(false);
  const sending = useRef(false);
  const [pendingReply, setPendingReply] = useState<{ id: string; message: ChatMessage } | null>(null);
  const [sendPending, setSendPending] = useState(false);
  const [chatAgents, setChatAgents] = useState<ChatAgent[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const openingProject = useRef(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const refreshChatAgents = useCallback(async () => {
    if (!window.synapse) return;
    try {
      setChatAgents(await window.synapse.getChatAgents());
    } catch (error) {
      setChatError(chatErrorMessage(error));
    }
  }, []);

  useEffect(() => { void refreshChatAgents(); }, [refreshChatAgents]);

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

  const currentProject = effectiveProjects.find((p) => p.project_hash === activeProjectHash);
  const projectTitle = currentProject?.project_name ?? 'Chat độc lập';
  const sessionsFor = (hash: string | null) => hash === null
    ? standaloneSessions
    : effectiveProjects.find((p) => p.project_hash === hash)?.sessions ?? [];
  const sessions = sessionsFor(activeProjectHash);
  const active = sessions.find((session) => session.session_id === activeId) ?? sessions[0];
  const threadId = active?.session_id;
  const messages = (threadId ? threads[threadId] ?? [] : []).filter(isChatMessage);
  if (pendingReply && pendingReply.id === threadId) messages.push(pendingReply.message);

  const rememberMessages = (id: string, items: unknown[]) => {
    threadsRef.current = { ...threadsRef.current, [id]: items };
    setThreads(threadsRef.current);
  };

  const loadMessages = useCallback(async (hash: string | null, id: string) => {
    if (threadsRef.current[id]) return threadsRef.current[id];
    const items = await window.synapse.getChatMessages(hash, id);
    if (!threadsRef.current[id]) rememberMessages(id, items);
    return threadsRef.current[id];
  }, []);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    void loadMessages(activeProjectHash, threadId).catch((error: unknown) => {
      if (!cancelled) setChatError(chatErrorMessage(error));
    });
    return () => { cancelled = true; };
  }, [activeProjectHash, threadId, loadMessages]);

  const selectChat = (hash: string | null, id = '') => {
    navigation.current += 1;
    setChatError(null);
    setActiveId(id);
    if (activeProjectHash !== hash) void selectProject(hash);
  };

  const createChat = async (hash: string | null) => {
    const revision = navigation.current;
    if (!window.synapse) throw new Error('Hãy mở Synapse OS bằng Electron để quản lý cuộc trò chuyện.');
    const current = await window.synapse.getChatSessions(hash);
    const existing = new Set(current.map((item) => item.session_id));
    const updated = await mutateChatSession({
      action: 'CREATE',
      project_hash: hash,
      new_title: `Cuộc trò chuyện ${current.length + 1}`,
    });
    const session = updated.find((item) => !existing.has(item.session_id));
    if (!session) throw new Error('Không tìm thấy cuộc trò chuyện vừa tạo.');
    if (revision === navigation.current) selectChat(hash, session.session_id);
    return session.session_id;
  };

  const newConversation = async (hash: string | null) => {
    if (creating.current) return;
    creating.current = true;
    setCreatePending(true);
    setChatError(null);
    try {
      await createChat(hash);
    } catch (error) {
      setChatError(chatErrorMessage(error));
    } finally {
      creating.current = false;
      setCreatePending(false);
    }
  };

  const handleSend = async (text: string, target: TargetAgent, files: File[]) => {
    if (sending.current || creating.current) return;
    sending.current = true;
    setSendPending(true);
    setChatError(null);
    try {
      const hash = activeProjectHash;
      let id = threadId;
      if (!id) {
        creating.current = true;
        try { id = await createChat(hash); }
        finally { creating.current = false; }
      }
      const sessionId = id;
      const previous = await loadMessages(hash, sessionId);
      const persist = async (items: unknown[]) => {
        await saveChatMessages(hash, sessionId, items);
        rememberMessages(sessionId, items);
      };
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        author: 'user',
        authorName: 'Bạn',
        time: now(),
        text,
        attachments: files.map((file) => ({
          name: file.name,
          sizeLabel: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          kind: file.type.startsWith('video') ? 'video' : 'file',
        })),
      };
      const response: ChatMessage = {
        id: crypto.randomUUID(),
        author: 'system',
        authorName: 'AGENT HQ',
        time: now(),
        text: '',
      };
      const sent = [...previous, userMessage];
      if (files.length) {
        response.text = 'Luồng chat hiện hỗ trợ văn bản. Hãy gửi lại tin nhắn không kèm tệp.';
      } else {
        await persist(sent);
        const label = chatAgents.find((entry) => entry.id === target)?.label;
        setPendingReply({ id: sessionId, message: { ...response, text: label ? `Đang chờ ${label} trả lời…` : 'Đang chờ AI trả lời…' } });
        try {
          const reply = await window.synapse.sendAgentMessage(target, text, agentHistoryFrom(previous));
          response.text = reply.text;
          response.authorName = reply.label;
          response.agentId = reply.agentId;
        } catch (error) {
          response.text = `Không gửi được tin nhắn. ${chatErrorMessage(error)}`;
        }
        response.time = now();
      }
      await persist([...sent, response]);
    } catch (error) {
      setChatError(chatErrorMessage(error));
    } finally {
      setPendingReply(null);
      setSendPending(false);
      sending.current = false;
    }
  };

  const changeChat = async (id: string, action: ChatSessionMutationRequest['action'], newTitle?: string) => {
    const session = [standaloneSessions, ...effectiveProjects.map((project) => project.sessions)]
      .flat().find((item) => item.session_id === id);
    if (!session) return false;
    setChatError(null);
    try {
      await mutateChatSession({ action, project_hash: session.project_hash, session_id: id, new_title: newTitle });
      if (action === 'DELETE' && threadsRef.current[id]) {
        const next = { ...threadsRef.current };
        delete next[id];
        threadsRef.current = next;
        setThreads(next);
      }
      return true;
    } catch (error) {
      setChatError(chatErrorMessage(error));
      return false;
    }
  };

  const handleTogglePin = async (id: string) => {
    if (await changeChat(id, 'TOGGLE_PIN')) setMenuTarget(null);
  };

  const handleConfirmRename = async (id: string, newTitle: string) => {
    if (await changeChat(id, 'RENAME', newTitle)) setRenameTarget(null);
  };

  const handleConfirmDelete = async (id: string) => {
    if (await changeChat(id, 'DELETE')) setDeleteTarget(null);
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
      selectChat(null);
    }
    setProjectDeleteTarget(null);
  };

  const handleOpenProjectFolder = async () => {
    if (openingProject.current) return;
    openingProject.current = true;
    setProjectError(null);
    try {
      const project = await pickShadowProject();
      if (project) {
        navigation.current += 1;
        setActiveId('');
        setChatError(null);
        if (projectOverrides[project.project_hash]?.isDeleted) {
          setProjectOverrides((prev) => {
            const next = { ...prev, [project.project_hash]: { ...prev[project.project_hash], isDeleted: false } };
            saveProjectOverrides(next);
            return next;
          });
        }
      }
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
        mode={currentProject ? mode : 'chat'}
        graphAvailable={!!currentProject}
        onModeChange={setMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectProject={handleOpenProjectFolder}
      />

      {projectError && <p role="alert" className="text-sm text-red-300">Không thể mở dự án. {projectError}</p>}
      {chatError && <p role="alert" className="text-sm text-red-300">{chatError}</p>}

      {/* Main 3-Column Layout */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Left Column: Sidebar (225px) */}
        <Sidebar
          standaloneSessions={standaloneSessions}
          activeId={threadId}
          onSelect={(id) => selectChat(null, id)}
          onNew={() => void newConversation(null)}
          quota={quota}
          live={live}
          onOpenChatMenu={(target) => setMenuTarget(target)}
          projects={effectiveProjects}
          activeProjectHash={activeProjectHash}
          onSelectProject={(hash) => selectChat(hash)}
          onSelectProjectChat={selectChat}
          onNewProjectChat={(hash) => void newConversation(hash)}
          onOpenProject={handleOpenProjectFolder}
          onOpenProjectMenu={(target) => setProjectMenuTarget(target)}
        />

        {/* Center Column: Chat & Preview */}
        <ChatPanel
          key={threadId ?? activeProjectHash ?? 'standalone'}
          title={active?.title ?? 'Cuộc trò chuyện mới'}
          projectPathSubtitle={currentProject ? `${projectTitle} / Chat dự án` : 'Chat độc lập'}
          messages={messages}
          chatAgents={chatAgents}
          onOpenAgentMenu={refreshChatAgents}
          onSend={handleSend}
          sendDisabled={sendPending || createPending}
          onFocusGraph={currentProject ? () => setMode('graph') : undefined}
        />

        {/* Right Column: Knowledge Graph + DAG Task Tree (When Chat + Graph mode is active) */}
        {mode === 'graph' && currentProject && (
          <aside className="flex min-h-0 w-[480px] shrink-0 flex-col gap-3 xl:w-[540px]">
            <div className="h-[55%] min-h-0">
              <KnowledgeGraphPanel
                isRunning={true}
                activeEvent={graphActiveEvent}
                graphData={graphData}
                projectHash={currentProject.project_hash}
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
        onSaveAppearanceSettings={saveAppearanceSettings}
        onEnsureToolDependency={ensureToolDependency}
      />
    </div>
  );
}
