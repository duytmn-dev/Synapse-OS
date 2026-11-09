import type { ViewMode } from '../chat/types';
import {
  IconChat,
  IconChevronDown,
  IconFolder,
  IconGraph,
  IconLogoHex,
  IconSettings,
} from '../icons';

interface TopBarProps {
  projectTitle: string;
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  onOpenSettings?: () => void;
  onSelectProject?: () => void;
}

export function TopBar({
  projectTitle,
  mode,
  onModeChange,
  onOpenSettings,
}: TopBarProps) {
  return (
    <header className="relative flex h-[52px] w-full shrink-0 items-center justify-between rounded-[16px] border border-[#23344A] bg-[#0E1725] px-4 shadow-lg">
      {/* Left: Logo & Project selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <IconLogoHex size={22} />
          <span className="text-[17px] font-medium tracking-tight text-[#EAF2FF]">
            Synapse OS
          </span>
        </div>

        <div className="mx-2 h-5 w-[1px] bg-[#23344A]" />

        <button
          className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] font-medium text-[#9DB0C8] transition hover:bg-[#142235] hover:text-[#EAF2FF]"
          title="Chọn dự án hiện tại"
        >
          <IconFolder size={15} className="text-[#9DB0C8]" />
          <span>{projectTitle}</span>
          <IconChevronDown size={14} className="text-[#9DB0C8]" />
        </button>
      </div>

      {/* Center: Mode switcher [💬 Chat] / [🕸️ Chat + Graph] */}
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center rounded-lg border border-[#23344A] bg-[#0A1220] p-[3px]">
        <button
          type="button"
          onClick={() => onModeChange('chat')}
          className={`flex items-center gap-2 rounded-md px-3.5 py-1 text-[12px] font-medium transition ${
            mode === 'chat'
              ? 'border border-[#405672] bg-[#142235] text-[#58E9A8] shadow-sm'
              : 'border border-transparent text-[#9DB0C8] hover:text-[#EAF2FF]'
          }`}
        >
          <IconChat size={14} />
          <span>Chat</span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('graph')}
          className={`flex items-center gap-2 rounded-md px-3.5 py-1 text-[12px] font-medium transition ${
            mode === 'graph'
              ? 'border border-[#405672] bg-[#142235] text-[#58E9A8] shadow-sm'
              : 'border border-transparent text-[#9DB0C8] hover:text-[#EAF2FF]'
          }`}
        >
          <IconGraph size={14} />
          <span>Chat + Graph</span>
        </button>
      </div>

      {/* Right: SHADOW WORKSPACE badge & Settings button */}
      <div className="flex items-center gap-3">
        {/* Shadow Workspace Badge */}
        <div className="flex items-center gap-2 rounded-md border border-[#23344A] bg-[#0A1220] px-3 py-1 font-mono text-[11px] font-medium tracking-wide text-[#78BAFF]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#78BAFF] shadow-[0_0_6px_#78BAFF]" />
          <span>SHADOW WORKSPACE</span>
        </div>

        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 rounded-lg border border-[#23344A] bg-[#142235] px-3.5 py-1 text-[12px] font-medium text-[#9DB0C8] transition hover:border-[#405672] hover:text-[#EAF2FF]"
        >
          <IconSettings size={14} />
          <span>Cài đặt</span>
        </button>
      </div>
    </header>
  );
}
