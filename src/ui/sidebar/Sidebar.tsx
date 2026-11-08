import type { AgentQuotaStat } from '@shared/types';
import type { Conversation } from '../chat/types';
import { IconChat, IconPlus } from '../icons';
import { QuotaPanel } from './QuotaPanel';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  quota: AgentQuotaStat[];
  live: boolean;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, quota, live }: SidebarProps) {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-hq-border bg-hq-panel p-3">
      <button
        onClick={onNew}
        className="flex items-center gap-2 rounded-lg border border-hq-border px-3 py-2 text-sm transition hover:border-hq-accent/50 hover:bg-white/5"
      >
        <IconPlus size={15} /> Cuộc trò chuyện
      </button>

      <nav className="flex flex-col gap-0.5">
        {conversations.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                active
                  ? 'border border-hq-accent/40 bg-hq-accent/10 text-hq-text'
                  : 'border border-transparent text-hq-muted hover:bg-white/5 hover:text-hq-text'
              }`}
            >
              <IconChat size={14} className="shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          );
        })}
      </nav>

      <QuotaPanel quota={quota} live={live} />
    </aside>
  );
}
