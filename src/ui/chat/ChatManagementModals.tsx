import { useEffect, useRef, useState } from 'react';
import { IconChat, IconPencil, IconTrash, IconUnpin, IconPin } from '../icons';

export interface ChatMenuTarget {
  id: string;
  title: string;
  isPinned?: boolean;
  projectName?: string;
  anchorRect?: { top: number; left: number };
}

interface ChatManagementModalsProps {
  // Popover Menu state
  menuTarget: ChatMenuTarget | null;
  onCloseMenu: () => void;
  onOpenRename: (target: ChatMenuTarget) => void;
  onTogglePin: (id: string) => void;
  onOpenDelete: (target: ChatMenuTarget) => void;

  // Rename Modal state
  renameTarget: ChatMenuTarget | null;
  onCloseRename: () => void;
  onConfirmRename: (id: string, newTitle: string) => void;

  // Delete Modal state
  deleteTarget: ChatMenuTarget | null;
  onCloseDelete: () => void;
  onConfirmDelete: (id: string) => void;
}

export function ChatManagementModals({
  menuTarget,
  onCloseMenu,
  onOpenRename,
  onTogglePin,
  onOpenDelete,
  renameTarget,
  onCloseRename,
  onConfirmRename,
  deleteTarget,
  onCloseDelete,
  onConfirmDelete,
}: ChatManagementModalsProps) {
  const [renameInput, setRenameInput] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renameTarget) {
      setRenameInput(renameTarget.title);
    }
  }, [renameTarget]);

  // Handle click outside menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCloseMenu();
      }
    }
    if (menuTarget) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuTarget, onCloseMenu]);

  return (
    <>
      {/* 1. Popover Menu (07 Quản lý chat.svg) */}
      {menuTarget && menuTarget.anchorRect && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${Math.min(menuTarget.anchorRect.top + 20, window.innerHeight - 150)}px`,
            left: `${Math.min(menuTarget.anchorRect.left + 10, window.innerWidth - 200)}px`,
            zIndex: 9999,
          }}
          className="flex w-[160px] flex-col gap-1 rounded-[8px] border border-[#405672] bg-[#142338] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            onClick={() => {
              onOpenRename(menuTarget);
              onCloseMenu();
            }}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#9DB0C8] transition hover:bg-[#142235] hover:text-[#EAF2FF]"
          >
            <IconPencil size={13} className="text-[#9DB0C8]" />
            <span>Đổi tên</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onTogglePin(menuTarget.id);
              onCloseMenu();
            }}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#9DB0C8] transition hover:bg-[#142235] hover:text-[#EAF2FF]"
          >
            {menuTarget.isPinned ? (
              <>
                <IconUnpin size={13} className="text-[#9DB0C8]" />
                <span>Bỏ ghim</span>
              </>
            ) : (
              <>
                <IconPin size={13} className="text-[#58E9A8]" />
                <span>Ghim chat</span>
              </>
            )}
          </button>

          <div className="my-0.5 h-[1px] bg-[#23344A]" />

          <button
            type="button"
            onClick={() => {
              onOpenDelete(menuTarget);
              onCloseMenu();
            }}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#FF9A83] transition hover:bg-[#FF9A83]/10"
          >
            <IconTrash size={13} className="text-[#FF9A83]" />
            <span>Xóa</span>
          </button>
        </div>
      )}

      {/* 2. Modal Đổi tên chat (07 Quản lý chat.svg) */}
      {renameTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-[360px] rounded-[16px] border border-[#23344A] bg-[#0E1725] p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-[16px] font-medium text-[#EAF2FF]">
              Đổi tên chat
            </h3>

            <div className="mt-4 flex flex-col gap-1.5">
              <label className="text-[12px] text-[#9DB0C8]">
                Tên cuộc trò chuyện
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-[#EAF2FF]">
                  <IconChat size={14} />
                </span>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameInput.trim()) {
                      onConfirmRename(renameTarget.id, renameInput.trim());
                      onCloseRename();
                    } else if (e.key === 'Escape') {
                      onCloseRename();
                    }
                  }}
                  autoFocus
                  className="w-full rounded-lg border border-[#58E9A8] bg-[#0A1220] py-2 pl-9 pr-3 text-[13px] text-[#EAF2FF] outline-none shadow-[0_0_8px_rgba(88,233,168,0.2)] focus:ring-1 focus:ring-[#58E9A8]"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onCloseRename}
                className="rounded-lg border border-[#23344A] bg-[#142235] px-4 py-1.5 text-[12px] font-medium text-[#9DB0C8] transition hover:border-[#405672] hover:text-[#EAF2FF]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (renameInput.trim()) {
                    onConfirmRename(renameTarget.id, renameInput.trim());
                    onCloseRename();
                  }
                }}
                className="rounded-lg border border-[#58E9A8] bg-[#58E9A8] px-4 py-1.5 text-[12px] font-semibold text-[#071912] shadow-sm transition hover:bg-[#6af2b4]"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Xóa cuộc trò chuyện? (07 Quản lý chat.svg) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-[360px] rounded-[16px] border border-[#23344A] bg-[#0E1725] p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-[16px] font-medium text-[#EAF2FF]">
              Xóa cuộc trò chuyện?
            </h3>

            <p className="mt-3 text-[13px] leading-relaxed text-[#9DB0C8]">
              Cuộc trò chuyện «{deleteTarget.title}» sẽ bị xóa khỏi{' '}
              {deleteTarget.projectName ? `dự án ${deleteTarget.projectName}` : 'lịch sử chat'}.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onCloseDelete}
                className="rounded-lg border border-[#23344A] bg-[#142235] px-4 py-1.5 text-[12px] font-medium text-[#9DB0C8] transition hover:border-[#405672] hover:text-[#EAF2FF]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirmDelete(deleteTarget.id);
                  onCloseDelete();
                }}
                className="rounded-lg border border-[#FF9A83] bg-[#FF806E] px-4 py-1.5 text-[12px] font-semibold text-[#071912] shadow-sm transition hover:bg-[#ff9383]"
              >
                Xóa chat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
