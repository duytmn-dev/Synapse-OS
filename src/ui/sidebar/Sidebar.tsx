import type { MouseEvent } from 'react';
import type { AgentQuotaStat, ChatSessionItem, ShadowProjectMeta } from '@shared/types';
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
import type { ProjectMenuTarget } from './ProjectManagementModals';

interface SidebarProps {
  standaloneSessions: ChatSessionItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  quota: AgentQuotaStat[];
  live: boolean;
  onOpenChatMenu: (target: ChatMenuTarget) => void;
  projects?: ShadowProjectMeta[];
  activeProjectHash?: string | null;
  onSelectProject?: (hash: string) => void;
  onSelectProjectChat: (hash: string, id: string) => void;
  onNewProjectChat: (hash: string) => void;
  onOpenProject?: () => void;
  onOpenProjectMenu?: (target: ProjectMenuTarget) => void;
}

export function Sidebar({
  standaloneSessions,
  activeId,
  onSelect,
  onNew,
  quota,
  live,
  onOpenChatMenu,
  projects = [],
  activeProjectHash,
  onSelectProject,
  onSelectProjectChat,
  onNewProjectChat,
  onOpenProject,
  onOpenProjectMenu,
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

  const handleOpenProjMenu = (
    e: MouseEvent,
    proj: ShadowProjectMeta
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenProjectMenu?.({
      projectHash: proj.project_hash,
      projectName: proj.project_name,
      originalPath: proj.original_path,
      isPinned: proj.is_pinned,
      anchorRect: { top: rect.bottom, left: rect.left },
    });
  };

  const renderChat = (chat: ChatSessionItem, select: () => void, projectName?: string) => {
    const isActive = activeId === chat.session_id && (activeProjectHash ?? null) === chat.project_hash;
    return (
      <div
        key={chat.session_id}
        className={`group flex items-center justify-between rounded-md px-2 py-1.5 transition ${
          isActive
            ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
            : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
        }`}
      >
        <button
          type="button"
          onClick={select}
          aria-current={isActive ? 'true' : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {chat.is_pinned ? (
            <IconPin size={13} className="shrink-0 text-[#58E9A8]" />
          ) : (
            <IconChat size={13} className="shrink-0 text-[#8297B2]" />
          )}
          <span className="truncate text-[12px]">{chat.title}</span>
        </button>
        <button
          type="button"
          onClick={(event) => handleOpenMenu(event, chat.session_id, chat.title, chat.is_pinned, projectName)}
          className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-[#EAF2FF]"
          title="Menu tùy chọn"
          aria-label={`Tùy chọn cho ${chat.title}`}
        >
          <IconDots size={13} />
        </button>
      </div>
    );
  };

  // Sắp xếp: các dự án được ghim (is_pinned) lên đầu
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return (a.project_name || '').localeCompare(b.project_name || '');
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
            {standaloneSessions.length === 0 ? (
              <div className="px-2 py-3 text-center text-[11.5px] text-[#8297B2]">
                Chưa có cuộc trò chuyện
              </div>
            ) : standaloneSessions.map((chat) => renderChat(chat, () => onSelect(chat.session_id)))}
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
              sortedProjects.map((proj) => {
                const isActiveProj = proj.project_hash === activeProjectHash;
                return (
                  <div key={proj.project_hash}>
                    <div
                      onClick={() => onSelectProject?.(proj.project_hash)}
                      className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition ${
                        isActiveProj
                          ? 'border border-[#405672] bg-[#142235] text-[#EAF2FF]'
                          : 'text-[#9DB0C8] hover:bg-[#142235]/60 hover:text-[#EAF2FF]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {proj.is_pinned ? (
                          <IconPin size={13} className="shrink-0 text-[#58E9A8]" />
                        ) : (
                          <IconFolder size={14} className="shrink-0 text-[#8297B2]" />
                        )}
                        <span className="truncate text-[12px] font-medium">
                          {proj.project_name || 'Dự án'}
                        </span>
                        <IconShadowDb size={13} className="shrink-0 text-[#78BAFF]" />
                      </div>
                      <div className="flex items-center gap-1">
                        {proj.is_pinned && <IconPin size={12} className="text-[#58E9A8]" />}
                        {onOpenProjectMenu && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenProjMenu(e, proj)}
                            className="rounded p-0.5 text-[#9DB0C8] opacity-0 transition group-hover:opacity-100 hover:text-[#EAF2FF]"
                            title="Menu tùy chọn dự án"
                          >
                            <IconDots size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    {isActiveProj && (
                      <div className="ml-2 flex flex-col gap-0.5 border-l border-[#23344A] pl-2">
                        <button
                          type="button"
                          onClick={() => onNewProjectChat(proj.project_hash)}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[#58E9A8] hover:bg-[#142235]/60"
                          aria-label={`Tạo chat trong dự án ${proj.project_name}`}
                        >
                          <IconPlus size={13} className="shrink-0" />
                          <span>Chat mới trong dự án</span>
                        </button>
                        {proj.sessions.map((chat) => renderChat(
                          chat,
                          () => onSelectProjectChat(proj.project_hash, chat.session_id),
                          proj.project_name,
                        ))}
                      </div>
                    )}
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
