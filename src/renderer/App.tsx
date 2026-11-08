import { useCallback, useState } from 'react';
import { useSynapseBridge } from './hooks/useSynapseBridge';
import { DEMO_CONVERSATIONS, DEMO_MESSAGES } from './mock/demoData';
import type { ChatMessage, Conversation, TargetAgent, ViewMode } from '../ui/chat/types';
import { getAgentMeta } from '../ui/agents';
import { TopBar } from '../ui/layout/TopBar';
import { Sidebar } from '../ui/sidebar/Sidebar';
import { ChatPanel } from '../ui/chat/ChatPanel';
import { OfficePanel } from '../ui/office/OfficePanel';
import { TaskTree } from '../ui/tasks/TaskTree';

const now = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export default function App() {
  const { quota, tasks, office, live } = useSynapseBridge();
  const [mode, setMode] = useState<ViewMode>('chat3d');
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeId, setActiveId] = useState(DEMO_CONVERSATIONS[0].id);
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({ [DEMO_CONVERSATIONS[0].id]: DEMO_MESSAGES });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [officeExpanded, setOfficeExpanded] = useState(false);

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
      // TODO(Pha 2): gửi qua IPC khi Backend công bố kênh chat trong src/shared/types.ts.
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

  const is3D = mode === 'chat3d';

  return (
    <div className="flex h-full flex-col">
      <TopBar projectTitle={active.title} mode={mode} onModeChange={setMode} userName="Justin" />
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
              highlightCode={highlight}
              onSelectCode={(c) => setHighlight((h) => (h === c ? null : c))}
              onClose={() => setMode('chat')}
              expanded={officeExpanded}
              onToggleExpand={() => setOfficeExpanded((v) => !v)}
            />
            <TaskTree projectTitle="Tool cắt video 360" tasks={tasks} highlightCode={highlight} onHover={setHighlight} />
          </aside>
        )}
      </div>
    </div>
  );
}
