import { useState } from 'react';
import type { DAGTaskItem } from '@shared/types';
import { IconChevronDown, IconChevronRight, IconFolder, IconLayers } from '../icons';

export function normalizeStatus(raw?: string): DAGTaskItem['status'] {
  if (raw === 'COMPLETED' || raw === 'RUNNING' || raw === 'WAITING' || raw === 'FAILED') {
    return raw;
  }
  return 'WAITING';
}

interface TaskTreeProps {
  projectTitle: string;
  tasks: DAGTaskItem[];
  highlightCode?: string | null;
  onHover?: (code: string | null) => void;
}

export function TaskTree({
  projectTitle = 'Tool cắt video 360',
  tasks,
  highlightCode,
  onHover,
}: TaskTreeProps) {
  const [isRootExpanded, setIsRootExpanded] = useState(true);
  const doneCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const totalCount = tasks.length || 5;
  const progressPercent = Math.round((doneCount / totalCount) * 100);

  return (
    <section className="flex h-full flex-col justify-between rounded-[16px] border border-[#23344A] bg-[#0E1725] p-4 shadow-lg select-none">
      {/* Header (01 Dashboard.svg) */}
      <header className="flex h-[38px] shrink-0 items-center justify-between border-b border-[#23344A] pb-3">
        <div className="flex items-center gap-2">
          <IconLayers size={15} className="text-[#78BAFF]" />
          <h2 className="text-[16px] font-medium text-[#EAF2FF]">
            Sơ đồ task
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-[#9DB0C8]">
            {doneCount}/{totalCount} hoàn tất
          </span>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-[#23344A]">
            <div
              className="h-full rounded-full bg-[#58E9A8] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Task Tree Content */}
      <div
        className="flex-1 overflow-y-auto pt-3 text-[12px]"
        onMouseLeave={() => onHover?.(null)}
      >
        {/* Project root row */}
        <div
          onClick={() => setIsRootExpanded(!isRootExpanded)}
          className="flex cursor-pointer items-center gap-2 py-1 text-[#EAF2FF] hover:text-white"
        >
          {isRootExpanded ? (
            <IconChevronDown size={12} className="text-[#8297B2]" />
          ) : (
            <IconChevronRight size={12} className="text-[#8297B2]" />
          )}
          <IconFolder size={14} className="text-[#8297B2]" />
          <span className="font-medium">{projectTitle}</span>
        </div>

        {isRootExpanded && (
          <div className="flex flex-col gap-0.5 pt-1">
            {/* Task [A] Phân tích yêu cầu */}
            <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition hover:bg-[#142235]/50">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[12px] text-[#8297B2]">├</span>
                <span className="flex h-5 w-6 items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] font-mono text-[11px] font-semibold text-[#58E9A8]">
                  A
                </span>
                <span className="text-[#EAF2FF]">Phân tích yêu cầu</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex w-[68px] items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] px-1.5 py-0.5 text-[11px] font-medium text-[#58E9A8]">
                  ChatGPT
                </span>
                <span className="w-20 text-right text-[11px] text-[#58E9A8]">
                  ✓ Hoàn tất
                </span>
              </div>
            </div>

            {/* Task [B] Chọn khoảnh khắc (Active / Highlighted in 01 Dashboard.svg) */}
            <div
              onMouseEnter={() => onHover?.('B')}
              className={`flex flex-col rounded-lg p-1.5 shadow-sm transition-colors ${
                highlightCode === 'B' || !highlightCode ? 'bg-[#142235]' : 'bg-[#142235]/60'
              }`}
            >
              <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[12px] text-[#8297B2]">├</span>
                  <span className="flex h-5 w-6 items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] font-mono text-[11px] font-semibold text-[#A88BFA]">
                    B
                  </span>
                  <span className="font-medium text-[#EAF2FF]">
                    Chọn khoảnh khắc
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex w-[68px] items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] px-1.5 py-0.5 text-[11px] font-medium text-[#A88BFA]">
                    Gemini
                  </span>
                  <span className="w-24 text-right font-mono text-[11px] text-[#A88BFA]">
                    62% · Đang chạy
                  </span>
                </div>
              </div>

              {/* Sub-tasks of B */}
              <div className="flex flex-col gap-1 pl-4 pt-1">
                {/* [B1] Phát hiện cảnh */}
                <div className="flex items-center justify-between px-2 py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-[#8297B2]">└</span>
                    <span className="flex h-4 w-7 items-center justify-center rounded border border-[#23344A] bg-[#0A1220] font-mono text-[10px] text-[#A88BFA]">
                      B1
                    </span>
                    <span className="text-[#9DB0C8]">Phát hiện cảnh</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex w-[68px] items-center justify-center rounded border border-[#23344A] bg-[#0A1220] px-1.5 text-[10px] text-[#A88BFA]">
                      Gemini
                    </span>
                    <span className="w-20 text-right text-[11px] text-[#A88BFA]">
                      Đang chạy
                    </span>
                  </div>
                </div>

                {/* [B2] Chấm điểm cảnh */}
                <div className="flex items-center justify-between px-2 py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-[#8297B2]">└</span>
                    <span className="flex h-4 w-7 items-center justify-center rounded border border-[#23344A] bg-[#0A1220] font-mono text-[10px] text-[#A88BFA]">
                      B2
                    </span>
                    <span className="text-[#9DB0C8]">Chấm điểm cảnh</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex w-[68px] items-center justify-center rounded border border-[#23344A] bg-[#0A1220] px-1.5 text-[10px] text-[#A88BFA]">
                      Gemini
                    </span>
                    <span className="w-20 text-right text-[11px] text-[#A88BFA]">
                      Đang chạy
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Task [C] Viết pipeline */}
            <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition hover:bg-[#142235]/50">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[12px] text-[#8297B2]">├</span>
                <span className="flex h-5 w-6 items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] font-mono text-[11px] font-semibold text-[#78BAFF]">
                  C
                </span>
                <span className="text-[#EAF2FF]">Viết pipeline</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex w-[68px] items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] px-1.5 py-0.5 text-[11px] font-medium text-[#78BAFF]">
                  Codex
                </span>
                <span className="w-20 text-right text-[11px] text-[#78BAFF]">
                  Đang chạy
                </span>
              </div>
            </div>

            {/* Task [D] Kiểm thử */}
            <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition hover:bg-[#142235]/50">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[12px] text-[#8297B2]">├</span>
                <span className="flex h-5 w-6 items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] font-mono text-[11px] font-semibold text-[#78BAFF]">
                  D
                </span>
                <span className="text-[#EAF2FF]">Kiểm thử</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex w-[68px] items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] px-1.5 py-0.5 text-[11px] font-medium text-[#78BAFF]">
                  Codex
                </span>
                <span className="w-20 text-right text-[11px] text-[#8297B2]">
                  Chờ
                </span>
              </div>
            </div>

            {/* Task [E] Tổng hợp */}
            <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition hover:bg-[#142235]/50">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[12px] text-[#8297B2]">└</span>
                <span className="flex h-5 w-6 items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] font-mono text-[11px] font-semibold text-[#FFC075]">
                  E
                </span>
                <span className="text-[#EAF2FF]">Tổng hợp</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex w-[68px] items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] px-1.5 py-0.5 text-[11px] font-medium text-[#FFC075]">
                  Claude
                </span>
                <span className="w-20 text-right text-[11px] text-[#8297B2]">
                  Chờ
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
