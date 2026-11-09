import type { MouseEvent } from 'react';
import type { AgentQuotaStat } from '@shared/types';
import type { Conversation } from '../chat/types';
import {
  IconChat,
  IconChevronRight,
  IconClock,
  IconDots,
  IconFolder,
  IconPin,
  IconPlus,
  IconShadowDb,
} from '../icons';
import { QuotaPanel } from './QuotaPanel';
import type { ChatMenuTarget } from '../chat/ChatManagementModals';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  quota: AgentQuotaStat[];
  live: boolean;
  onOpenChatMenu: (target: ChatMenuTarget) => void;
}

export function Sidebar({
  activeId,
  onSelect,
  onNew,
  quota,
  live,
  onOpenChatMenu,
}: SidebarProps) {
  const handleOpenMenu = (
    e: MouseEvent,
    id: string,
    title: string,
    isPinned?: boolean,
    projectName?: string
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenChatMenu({
      id,
      title,
      isPinned,
      projectName,
      anchorRect: { top: rect.bottom, left: rect.left },
    });
  };

  return (
    <aside className="flex h-full w-[225px] shrink-0 flex-col justify-between rounded-[16px] border border-[#23344A] bg-[#0E1725] p-3 shadow-lg select-none">
      <div className="flex flex-col gap-4 overflow-y-auto pr-0.5">
        {/* Top Button: + Cuộc trò chuyện mới */}
        <button
          type="button"
          onClick={onNew}
          className="flex h-[37px] w-full items-center justify-center gap-2 rounded-[8px] border border-[#405672] bg-[#142235] text-[12px] font-medium text-[#58E9A8] transition hover:bg-[#1a2c44] hover:shadow-[0_0_10px_rgba(88,233,168,0.15)]"
        >
          <IconPlus size={14} className="text-[#58E9A8]" />
          <span>Cuộc trò chuyện mới</span>
        </button>

        {/* Section 1: LỊCH SỬ CHAT */}
        <div className="flex flex-col gap-1.5">
          <div className="px-1 text-[11px] font-semibold tracking-wider text-[#8297B2]">
            LỊCH SỬ CHAT
          </div>

          <div className="flex flex-col gap-0.5">
            {/* Item 1: Lịch trình 2N1Đ (pinned) */}
            <div
              onClick={() => onSelect('c3')}
              className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition ${
                activeId === 'c3'
                  ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
                  : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <IconClock size={14} className="shrink-0 text-[#8297B2]" />
                <span className="truncate text-[12px]">Lịch trình 2N1Đ</span>
              </div>
              <div className="flex items-center gap-1">
                <IconPin size={12} className="text-[#58E9A8]" />
                <button
                  type="button"
                  onClick={(e) => handleOpenMenu(e, 'c3', 'Lịch trình 2N1Đ', true)}
                  className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 hover:text-[#EAF2FF]"
                  title="Menu tùy chọn"
                >
                  <IconDots size={13} />
                </button>
              </div>
            </div>

            {/* Item 2: Website portfolio */}
            <div
              onClick={() => onSelect('c2')}
              className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition ${
                activeId === 'c2'
                  ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
                  : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <IconChat size={14} className="shrink-0 text-[#8297B2]" />
                <span className="truncate text-[12px]">Website portfolio</span>
              </div>
              <button
                type="button"
                onClick={(e) => handleOpenMenu(e, 'c2', 'Website portfolio', false)}
                className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 hover:text-[#EAF2FF]"
                title="Menu tùy chọn"
              >
                <IconDots size={13} />
              </button>
            </div>

            {/* Item 3: Tra cứu FFmpeg */}
            <div
              onClick={() => onSelect('c_ffmpeg')}
              className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition ${
                activeId === 'c_ffmpeg'
                  ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
                  : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <IconChat size={14} className="shrink-0 text-[#8297B2]" />
                <span className="truncate text-[12px]">Tra cứu FFmpeg</span>
              </div>
              <button
                type="button"
                onClick={(e) => handleOpenMenu(e, 'c_ffmpeg', 'Tra cứu FFmpeg', false)}
                className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 hover:text-[#EAF2FF]"
                title="Menu tùy chọn"
              >
                <IconDots size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] w-full bg-[#23344A]" />

        {/* Section 2: DỰ ÁN */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-wider text-[#8297B2]">
              DỰ ÁN
            </span>
            <button
              type="button"
              className="text-[#8297B2] transition hover:text-[#EAF2FF]"
              title="Thêm dự án mới"
            >
              <IconPlus size={13} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {/* Project 1 Folder Header: Video 360 Highlights */}
            <div className="flex items-center justify-between rounded-md px-2 py-1 text-[#9DB0C8]">
              <div className="flex min-w-0 items-center gap-2">
                <IconFolder size={14} className="shrink-0 text-[#8297B2]" />
                <span className="truncate text-[12px] font-medium text-[#9DB0C8]">
                  Video 360 Highlights
                </span>
                {/* Shadow Workspace Database Icon */}
                <IconShadowDb size={13} className="shrink-0 text-[#78BAFF]" />
              </div>
              <button
                type="button"
                className="text-[#9DB0C8] hover:text-[#EAF2FF]"
                title="Tùy chọn dự án"
              >
                <IconDots size={13} />
              </button>
            </div>

            {/* Sub-tree inside Project 1 */}
            <div className="flex flex-col gap-1 pl-3">
              {/* Active Item: Chọn khoảnh khắc */}
              <div
                onClick={() => onSelect('c1')}
                className="group flex cursor-pointer items-center justify-between rounded-lg border border-[#405672] bg-[#142235] px-2.5 py-1.5 transition"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-0.5 rounded-full bg-[#58E9A8]" />
                  <IconChat size={13} className="shrink-0 text-[#58E9A8]" />
                  <span className="truncate text-[12px] font-medium text-[#EAF2FF]">
                    Chọn khoảnh khắc
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <IconPin size={12} className="text-[#58E9A8]" />
                  <button
                    type="button"
                    onClick={(e) =>
                      handleOpenMenu(e, 'c1', 'Chọn khoảnh khắc', true, 'Video 360 Highlights')
                    }
                    className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 hover:text-[#EAF2FF]"
                    title="Menu tùy chọn"
                  >
                    <IconDots size={13} />
                  </button>
                </div>
              </div>

              {/* Sub Item 2: Viết pipeline */}
              <div
                onClick={() => onSelect('c_pipeline')}
                className={`group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 transition ${
                  activeId === 'c_pipeline'
                    ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
                    : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <IconChat size={13} className="shrink-0 text-[#8297B2]" />
                  <span className="truncate text-[12px]">Viết pipeline</span>
                </div>
                <button
                  type="button"
                  onClick={(e) =>
                    handleOpenMenu(e, 'c_pipeline', 'Viết pipeline', false, 'Video 360 Highlights')
                  }
                  className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 hover:text-[#EAF2FF]"
                  title="Menu tùy chọn"
                >
                  <IconDots size={13} />
                </button>
              </div>

              {/* Sub Item 3: Kiểm thử bản xuất */}
              <div
                onClick={() => onSelect('c_test')}
                className={`group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 transition ${
                  activeId === 'c_test'
                    ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
                    : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <IconChat size={13} className="shrink-0 text-[#8297B2]" />
                  <span className="truncate text-[12px]">Kiểm thử bản xuất</span>
                </div>
                <button
                  type="button"
                  onClick={(e) =>
                    handleOpenMenu(e, 'c_test', 'Kiểm thử bản xuất', false, 'Video 360 Highlights')
                  }
                  className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 hover:text-[#EAF2FF]"
                  title="Menu tùy chọn"
                >
                  <IconDots size={13} />
                </button>
              </div>
            </div>

            {/* Project 2: Website portfolio (Collapsed) */}
            <div className="flex items-center justify-between rounded-md px-2 py-1 text-[#9DB0C8]">
              <div className="flex min-w-0 items-center gap-2">
                <IconFolder size={14} className="shrink-0 text-[#8297B2]" />
                <span className="truncate text-[12px]">Website portfolio</span>
              </div>
              <div className="flex items-center gap-1 text-[#8297B2]">
                <IconChevronRight size={13} />
                <button
                  type="button"
                  className="text-[#9DB0C8] hover:text-[#EAF2FF]"
                  title="Tùy chọn dự án"
                >
                  <IconDots size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] w-full bg-[#23344A]" />

        {/* Section 3: GIỚI HẠN AGENT */}
        <QuotaPanel quota={quota} live={live} />
      </div>
    </aside>
  );
}
