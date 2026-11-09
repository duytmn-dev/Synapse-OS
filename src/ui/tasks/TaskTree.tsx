import { useState } from 'react';
import type { AgentId, DAGTaskItem } from '@shared/types';
import { IconChevronDown, IconChevronRight, IconFolder, IconLayers } from '../icons';

export function normalizeStatus(raw?: string): DAGTaskItem['status'] {
  if (raw === 'COMPLETED' || raw === 'RUNNING' || raw === 'WAITING' || raw === 'FAILED') {
    return raw;
  }
  return 'WAITING';
}

function getAgentColor(agentId?: AgentId | string): string {
  switch (agentId?.toLowerCase()) {
    case 'chatgpt':
      return '#58E9A8';
    case 'gemini':
      return '#A88BFA';
    case 'codex':
      return '#78BAFF';
    case 'claude':
      return '#FFC075';
    default:
      return '#78BAFF';
  }
}

function getAgentLabel(agentId?: AgentId | string): string {
  switch (agentId?.toLowerCase()) {
    case 'chatgpt':
      return 'ChatGPT';
    case 'gemini':
      return 'Gemini';
    case 'codex':
      return 'Codex';
    case 'claude':
      return 'Claude';
    default:
      return 'Agent';
  }
}

interface TaskTreeProps {
  projectTitle: string;
  tasks: DAGTaskItem[];
  highlightCode?: string | null;
  onHover?: (code: string | null) => void;
}

export function TaskTree({
  projectTitle = 'Video 360 Highlights',
  tasks = [],
  highlightCode,
  onHover,
}: TaskTreeProps) {
  const [isRootExpanded, setIsRootExpanded] = useState(true);
  const doneCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

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
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-[#8297B2]">
                <IconLayers size={22} className="mb-2 text-[#405672]" />
                <span className="text-[12px] font-medium text-[#9DB0C8]">Chưa có quy trình DAG</span>
                <span className="mt-0.5 text-[11px] text-[#8297B2]">Gửi yêu cầu phân tích/xử lý trong khung Chat để kích hoạt tác vụ</span>
              </div>
            ) : (
              tasks.map((task, idx) => {
                const isCompleted = task.status === 'COMPLETED';
                const isRunning = task.status === 'RUNNING';
                const isFailed = task.status === 'FAILED';
                const agentColor = getAgentColor(task.assigned_agent);
                const isLast = idx === tasks.length - 1;
                const isHighlighted = highlightCode === task.step_code;

                return (
                  <div
                    key={task.step_code}
                    onMouseEnter={() => onHover?.(task.step_code)}
                    className={`flex flex-col rounded-lg p-1.5 transition-colors ${
                      isHighlighted ? 'bg-[#142235] ring-1 ring-[#58E9A8]/40' : 'hover:bg-[#142235]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between px-1 py-0.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[12px] text-[#8297B2]">
                          {isLast && (!task.sub_tasks || task.sub_tasks.length === 0) ? '└' : '├'}
                        </span>
                        <span
                          className="flex h-5 w-6 items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] font-mono text-[11px] font-semibold"
                          style={{ color: agentColor }}
                        >
                          {task.step_code}
                        </span>
                        <span className="text-[#EAF2FF]">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {task.assigned_agent && (
                          <span
                            className="flex min-w-[58px] items-center justify-center rounded-[4px] border border-[#23344A] bg-[#0A1220] px-1.5 py-0.5 text-[11px] font-medium"
                            style={{ color: agentColor }}
                          >
                            {getAgentLabel(task.assigned_agent)}
                          </span>
                        )}
                        <span
                          className="w-20 text-right text-[11px]"
                          style={{
                            color: isCompleted ? '#58E9A8' : isRunning ? agentColor : isFailed ? '#FF5449' : '#8297B2',
                          }}
                        >
                          {isCompleted ? '✓ Hoàn tất' : isRunning ? 'Đang chạy' : isFailed ? '✕ Lỗi' : 'Chờ'}
                        </span>
                      </div>
                    </div>

                    {/* Sub-tasks */}
                    {task.sub_tasks && task.sub_tasks.length > 0 && (
                      <div className="flex flex-col gap-1 pl-4 pt-1">
                        {task.sub_tasks.map((sub) => {
                          const subDone = sub.status === 'COMPLETED';
                          const subRunning = sub.status === 'RUNNING';
                          return (
                            <div key={sub.sub_code} className="flex items-center justify-between px-2 py-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[12px] text-[#8297B2]">└</span>
                                <span
                                  className="flex h-4 w-7 items-center justify-center rounded border border-[#23344A] bg-[#0A1220] font-mono text-[10px]"
                                  style={{ color: agentColor }}
                                >
                                  {sub.sub_code}
                                </span>
                                <span className="text-[#9DB0C8]">{sub.title}</span>
                              </div>
                              <span
                                className="w-20 text-right text-[10.5px]"
                                style={{ color: subDone ? '#58E9A8' : subRunning ? agentColor : '#8297B2' }}
                              >
                                {subDone ? '✓ Hoàn tất' : subRunning ? 'Đang chạy' : 'Chờ'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
}
