import { useCallback, useState } from 'react';
import { useSynapseBridge } from './hooks/useSynapseBridge';
import {
  DEMO_AI_NETWORK_SETTINGS,
  DEMO_APPEARANCE_SETTINGS,
  DEMO_CONVERSATIONS,
  DEMO_MESSAGES,
  DEMO_TOOL_DEPENDENCIES,
  DEMO_UPDATE_STATUS,
  DEMO_WORKSPACE_STORAGE,
} from './mock/demoData';
import type {
  AINetworkSettings,
  AppearanceSettings,
  ToolDependencyStatus,
  VisualOfficeEvent,
} from '@shared/types';
import type { ChatMessage, Conversation, TargetAgent, ViewMode } from '../ui/chat/types';
import { getAgentMeta } from '../ui/agents';
import { TopBar } from '../ui/layout/TopBar';
import { Sidebar } from '../ui/sidebar/Sidebar';
import { ChatPanel } from '../ui/chat/ChatPanel';
import { OfficePanel } from '../ui/office/OfficePanel';
import { TaskTree } from '../ui/tasks/TaskTree';
import { SettingsModal } from '../ui/settings/SettingsModal';

const now = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const agentToRoomMap: Record<string, VisualOfficeEvent['room_id']> = {
  chatgpt: 'CHATGPT',
  codex: 'CODEX',
  gemini: 'GEMINI_AGY',
  gemini_agy: 'GEMINI_AGY',
  claude: 'CLAUDE_EXT',
};

export default function App() {
  const { quota, tasks, office, activeRooms: bridgeActiveRooms, live } = useSynapseBridge();
  const [mode, setMode] = useState<ViewMode>('chat3d');
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeId, setActiveId] = useState(DEMO_CONVERSATIONS[0].id);
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({
    [DEMO_CONVERSATIONS[0].id]: DEMO_MESSAGES,
  });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [officeExpanded, setOfficeExpanded] = useState(false);

  // Cấu hình Cài đặt (Settings)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [networkSettings, setNetworkSettings] = useState<AINetworkSettings>(DEMO_AI_NETWORK_SETTINGS);
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(DEMO_APPEARANCE_SETTINGS);
  const [toolDependencies] = useState<ToolDependencyStatus[]>(DEMO_TOOL_DEPENDENCIES);
  const [activeRoomsOverride, setActiveRoomsOverride] = useState<VisualOfficeEvent['room_id'][] | null>(null);

  const activeRooms = activeRoomsOverride ?? bridgeActiveRooms;

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
    const c: Conversation = { id: crypto.randomUUID(), title: `Cuộc trò chuyện ${conversations.length + 1}` };
    setConversations([c, ...conversations]);
    setActiveId(c.id);
  };

  const handleToggleAgentConnection = (agentId: string) => {
    setNetworkSettings((prev) => {
      const updated = prev.agents.map((ag) => {
        if (ag.agent_id !== agentId) return ag;
        const nextStatus = ag.connection_status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
        return {
          ...ag,
          connection_status: nextStatus as 'CONNECTED' | 'DISCONNECTED' | 'OUT_OF_QUOTA',
        };
      });

      // Cập nhật danh sách phòng 3D hiển thị theo trạng thái kết nối
      const newActiveRooms: VisualOfficeEvent['room_id'][] = ['MANAGER'];
      for (const ag of updated) {
        if (ag.connection_status === 'CONNECTED') {
          const room = agentToRoomMap[ag.agent_id.toLowerCase()];
          if (room) newActiveRooms.push(room);
        }
      }
      setActiveRoomsOverride(newActiveRooms);

      return { ...prev, agents: updated };
    });
  };

  const is3D = mode === 'chat3d';

  return (
    <div className="flex h-full flex-col">
      <TopBar
        projectTitle={active.title}
        mode={mode}
        onModeChange={setMode}
        userName="Justin"
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={newConversation}
          quota={quota}
          live={live}
        />
        {!(is3D && officeExpanded) && (
          <ChatPanel
            title={active.title}
            messages={messages}
            mode={mode}
            autoOrchestrated={is3D}
            connectedAgents={quota}
            onSend={handleSend}
            onToggle3D={() => setMode(is3D ? 'chat' : 'chat3d')}
            onOpenOffice={() => setMode('chat3d')}
          />
        )}
        {is3D && (
          <aside className={`flex min-h-0 flex-col gap-3 p-3 ${officeExpanded ? 'flex-1' : 'w-[440px] shrink-0 xl:w-[500px]'}`}>
            <OfficePanel
              events={office}
              activeRooms={activeRooms}
              highlightCode={highlight}
              onSelectCode={(c) => setHighlight((h) => (h === c ? null : c))}
              onClose={() => setMode('chat')}
              expanded={officeExpanded}
              onToggleExpand={() => setOfficeExpanded((v) => !v)}
              enableLightTrails={appearanceSettings.enable_light_trails}
            />
            <TaskTree projectTitle="Tool cắt video 360" tasks={tasks} highlightCode={highlight} onHover={setHighlight} />
          </aside>
        )}
      </div>

      {/* Màn hình Cài đặt (Settings Modal 4 Tab) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        networkSettings={networkSettings}
        onSaveNetworkSettings={setNetworkSettings}
        toolDependencies={toolDependencies}
        workspaceStorage={DEMO_WORKSPACE_STORAGE}
        appearanceSettings={appearanceSettings}
        onSaveAppearanceSettings={setAppearanceSettings}
        updateStatus={DEMO_UPDATE_STATUS}
        onToggleAgentConnection={handleToggleAgentConnection}
      />
    </div>
  );
}
