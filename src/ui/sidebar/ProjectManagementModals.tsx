import { useEffect, useRef, useState } from 'react';
import { IconFolder, IconPencil, IconTrash, IconUnpin, IconPin, IconX } from '../icons';

export interface ProjectMenuTarget {
  projectHash: string;
  projectName: string;
  originalPath?: string;
  isPinned?: boolean;
  anchorRect?: { top: number; left: number };
}

interface ProjectManagementModalsProps {
  // Popover Menu state
  menuTarget: ProjectMenuTarget | null;
  onCloseMenu: () => void;
  onOpenRename: (target: ProjectMenuTarget) => void;
  onTogglePin: (projectHash: string) => void;
  onOpenDelete: (target: ProjectMenuTarget) => void;

  // Rename Modal state
  renameTarget: ProjectMenuTarget | null;
  onCloseRename: () => void;
  onConfirmRename: (projectHash: string, newName: string) => void;

  // Delete Modal state
  deleteTarget: ProjectMenuTarget | null;
  onCloseDelete: () => void;
  onConfirmDelete: (projectHash: string) => void;
}

export function ProjectManagementModals({
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
}: ProjectManagementModalsProps) {
  const [renameInput, setRenameInput] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renameTarget) {
      setRenameInput(renameTarget.projectName);
    }
  }, [renameTarget]);

  // Đóng popover menu khi click ra ngoài
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
      {/* 1. Popover Menu Dự Án */}
      {menuTarget && menuTarget.anchorRect && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${Math.min(menuTarget.anchorRect.top + 20, window.innerHeight - 160)}px`,
            left: `${Math.min(menuTarget.anchorRect.left + 10, window.innerWidth - 210)}px`,
            zIndex: 9999,
          }}
          className="flex w-[168px] flex-col gap-1 rounded-[8px] border border-[#405672] bg-[#142338] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
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
            <span>Đổi tên dự án</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onTogglePin(menuTarget.projectHash);
              onCloseMenu();
            }}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#9DB0C8] transition hover:bg-[#142235] hover:text-[#EAF2FF]"
          >
            {menuTarget.isPinned ? (
              <>
                <IconUnpin size={13} className="text-[#58E9A8]" />
                <span className="text-[#58E9A8]">Bỏ ghim dự án</span>
              </>
            ) : (
              <>
                <IconPin size={13} className="text-[#9DB0C8]" />
                <span>Ghim lên đầu</span>
              </>
            )}
          </button>

          <div className="my-0.5 h-[1px] w-full bg-[#23344A]" />

          <button
            type="button"
            onClick={() => {
              onOpenDelete(menuTarget);
              onCloseMenu();
            }}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#FF9A83] transition hover:bg-[#FF8563]/10 hover:text-[#FF7A59]"
          >
            <IconTrash size={13} className="text-[#FF9A83]" />
            <span>Xóa dự án</span>
          </button>
        </div>
      )}

      {/* 2. Modal Đổi Tên Dự Án */}
      {renameTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#070B12]/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="relative flex w-[380px] flex-col gap-4 rounded-[14px] border border-[#23344A] bg-[#0E1725] p-5 shadow-2xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-rename-project-title"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconFolder size={17} className="text-[#78BAFF]" />
                <h3 id="modal-rename-project-title" className="text-[14px] font-semibold text-[#EAF2FF]">
                  Đổi tên dự án
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseRename}
                className="rounded p-1 text-[#8297B2] hover:bg-[#142235] hover:text-[#EAF2FF]"
              >
                <IconX size={15} />
              </button>
            </div>

            <p className="text-[12px] text-[#8297B2]">
              Đặt tên gợi nhớ mới cho dự án trong Synapse OS. Tên thư mục gốc trên ổ đĩa sẽ không bị ảnh hưởng.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (renameInput.trim()) {
                  onConfirmRename(renameTarget.projectHash, renameInput.trim());
                }
              }}
              className="flex flex-col gap-4"
            >
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                autoFocus
                placeholder="Nhập tên mới cho dự án..."
                className="h-[36px] w-full rounded-[8px] border border-[#405672] bg-[#0A1220] px-3 text-[13px] text-[#EAF2FF] placeholder-[#8297B2] focus:border-[#58E9A8] focus:outline-none focus:ring-1 focus:ring-[#58E9A8]"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseRename}
                  className="rounded-[7px] border border-[#23344A] bg-[#142235] px-3.5 py-1.5 text-[12px] font-medium text-[#9DB0C8] hover:bg-[#1a2c44] hover:text-[#EAF2FF]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!renameInput.trim()}
                  className="rounded-[7px] bg-[#58E9A8] px-4 py-1.5 text-[12px] font-medium text-[#070B12] transition hover:bg-[#4be09d] disabled:opacity-50"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Xác Nhận Xóa Dự Án */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#070B12]/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="relative flex w-[400px] flex-col gap-4 rounded-[14px] border border-[#3A1F26] bg-[#0E1725] p-5 shadow-2xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-delete-project-title"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF8563]/15 text-[#FF8563]">
                  <IconTrash size={15} />
                </div>
                <h3 id="modal-delete-project-title" className="text-[14px] font-semibold text-[#EAF2FF]">
                  Xóa dự án khỏi danh sách?
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseDelete}
                className="rounded p-1 text-[#8297B2] hover:bg-[#142235] hover:text-[#EAF2FF]"
              >
                <IconX size={15} />
              </button>
            </div>

            <p className="text-[12.5px] leading-relaxed text-[#9DB0C8]">
              Bạn có chắc chắn muốn xóa dự án{' '}
              <span className="font-semibold text-[#EAF2FF]">"{deleteTarget.projectName}"</span> khỏi không gian làm việc Synapse OS?
            </p>

            <div className="rounded-[8px] border border-[#23344A] bg-[#0A1220] p-2.5 text-[11.5px] text-[#8297B2]">
              <span className="font-medium text-[#78BAFF]">🛡️ Zero Project Pollution:</span> Toàn bộ mã nguồn gốc của bạn trên máy tính hoàn toàn an toàn và không bị thay đổi.
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCloseDelete}
                className="rounded-[7px] border border-[#23344A] bg-[#142235] px-3.5 py-1.5 text-[12px] font-medium text-[#9DB0C8] hover:bg-[#1a2c44] hover:text-[#EAF2FF]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => onConfirmDelete(deleteTarget.projectHash)}
                className="rounded-[7px] bg-[#FF8563] px-4 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#ff724d] shadow-[0_0_12px_rgba(255,133,99,0.25)]"
              >
                Xóa dự án
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
