import type { MouseEvent } from 'react';
import type { AgentQuotaStat, ShadowProjectMeta } from '@shared/types';
import type { Conversation } from '../chat/types';
import {
  IconChat,
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
  projects?: ShadowProjectMeta[];
  activeProjectHash?: string | null;
  onSelectProject?: (hash: string) => void;
  onOpenProject?: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  quota,
  live,
  onOpenChatMenu,
  projects = [],
  activeProjectHash,
  onSelectProject,
  onOpenProject,
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

  // Sắp xếp: các đoạn chat được ghim (isPinned) lên đầu
  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });

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
            {sortedConversations.length === 0 ? (
              <div className="px-2 py-3 text-center text-[11.5px] text-[#8297B2]">
                Chưa có cuộc trò chuyện
              </div>
            ) : (
              sortedConversations.map((c) => {
                const isActive = activeId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition ${
                      isActive
                        ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
                        : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {c.isPinned ? (
                        <IconPin size={13} className="shrink-0 text-[#58E9A8]" />
                      ) : (
                        <IconChat size={13} className="shrink-0 text-[#8297B2]" />
                      )}
                      <span className="truncate text-[12px]">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {c.isPinned && <IconPin size={12} className="text-[#58E9A8]" />}
                      <button
                        type="button"
                        onClick={(e) => handleOpenMenu(e, c.id, c.title, c.isPinned, c.projectHash ?? undefined)}
                        className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 hover:text-[#EAF2FF]"
                        title="Menu tùy chọn"
                      >
                        <IconDots size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] w-full bg-[#23344A]" />

        {/* Section 2: DỰ ÁN (SHADOW WORKSPACE) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-wider text-[#8297B2]">
              DỰ ÁN
            </span>
            {onOpenProject && (
              <button
                type="button"
                onClick={onOpenProject}
                className="text-[#8297B2] transition hover:text-[#EAF2FF]"
                title="Mở thư mục dự án"
              >
                <IconPlus size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-lg border border-[#23344A] bg-[#0A1220]/50 p-2.5 text-center">
                <span className="text-[11px] text-[#8297B2]">Chưa mở Shadow Workspace</span>
                {onOpenProject && (
                  <button
                    type="button"
                    onClick={onOpenProject}
                    className="mt-1 flex items-center gap-1 rounded border border-[#405672] bg-[#142235] px-2 py-1 text-[11px] font-medium text-[#78BAFF] hover:bg-[#1a2c44]"
                  >
                    <IconPlus size={12} /> Mở dự án
                  </button>
                )}
              </div>
            ) : (
              projects.map((proj) => {
                const isActiveProj = proj.project_hash === activeProjectHash;
                return (
                  <div
                    key={proj.project_hash}
                    onClick={() => onSelectProject?.(proj.project_hash)}
                    className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition ${
                      isActiveProj
                        ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
                        : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <IconFolder size={14} className="shrink-0 text-[#8297B2]" />
                      <span className="truncate text-[12px] font-medium">
                        {proj.project_name || 'Dự án'}
                      </span>
                      <IconShadowDb size={13} className="shrink-0 text-[#78BAFF]" />
                    </div>
                  </div>
                );
              })
            )}
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
