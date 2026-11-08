import type { ReactNode } from 'react';
import type { ViewMode } from '../chat/types';
import { IconBell, IconChat, IconChevronDown, IconCube, IconSettings } from '../icons';

interface TopBarProps {
  projectTitle: string;
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  userName: string;
  onOpenSettings?: () => void;
}

export function TopBar({ projectTitle, mode, onModeChange, userName, onOpenSettings }: TopBarProps) {
  const tab = (m: ViewMode, label: string, icon: ReactNode) => (
    <button
      onClick={() => onModeChange(m)}
      aria-pressed={mode === m}
      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition ${
        mode === m ? 'border border-hq-accent/50 bg-hq-accent/15 text-hq-accent' : 'border border-transparent text-hq-muted hover:text-hq-text'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <header className="relative flex h-14 shrink-0 items-center border-b border-hq-border bg-hq-panel px-4">
      <div className="flex items-center gap-2.5">
        <IconCube size={22} className="text-sky-300" />
        <span className="text-[15px] font-bold tracking-wide">AGENT HQ</span>
      </div>
      <button className="ml-10 flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-white/5">
        {projectTitle} <IconChevronDown size={14} className="text-hq-muted" />
      </button>

      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-hq-border bg-black/20 p-1">
        {tab('chat', 'Chat', <IconChat size={14} />)}
        {tab('chat3d', 'Chat + 3D', <IconCube size={14} />)}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <button
          onClick={onOpenSettings}
          className="text-hq-muted transition hover:text-hq-accent"
          aria-label="Cài đặt hệ thống"
          title="Cài đặt hệ thống (Mạng lưới AI & API)"
        >
          <IconSettings size={18} />
        </button>
        <button className="text-hq-muted hover:text-hq-text" aria-label="Thông báo">
          <IconBell size={18} />
        </button>
        <button className="flex items-center gap-2 text-sm">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-orange-400 text-xs font-bold text-slate-900">
            {userName.charAt(0)}
          </span>
          {userName}
          <IconChevronDown size={14} className="text-hq-muted" />
        </button>
      </div>
    </header>
  );
}
