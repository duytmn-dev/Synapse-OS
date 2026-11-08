import { useState } from 'react';
import type { DAGTaskItem } from '@shared/types';
import { getAgentMeta } from '../agents';
import { IconCheck, IconCheckCircle, IconChevronDown, IconChevronRight, IconClock, IconFolder, IconAlert, IconLayers, IconSpinner } from '../icons';

type NormStatus = DAGTaskItem['status'];

/** sub_tasks[].status là string tự do trong hợp đồng → chuẩn hoá về 4 trạng thái. */
export function normalizeStatus(s: string): NormStatus {
  const v = s.trim().toUpperCase();
  if (v === 'COMPLETED' || v === 'DONE' || v === 'SUCCESS') return 'COMPLETED';
  if (v === 'RUNNING' || v === 'IN_PROGRESS' || v === 'ACTIVE') return 'RUNNING';
  if (v === 'FAILED' || v === 'ERROR') return 'FAILED';
  return 'WAITING';
}

function StatusIcon({ status }: { status: NormStatus }) {
  switch (status) {
    case 'COMPLETED':
      return <IconCheckCircle size={15} className="text-emerald-400" />;
    case 'RUNNING':
      return <IconSpinner size={15} className="text-sky-300" />;
    case 'FAILED':
      return <IconAlert size={15} className="text-red-400" />;
    default:
      return <IconClock size={15} className="text-hq-muted" />;
  }
}

function StatusText({ status, percent }: { status: NormStatus; percent?: number }) {
  if (status === 'COMPLETED') return <IconCheck size={15} className="text-emerald-400" />;
  if (status === 'FAILED') return <span className="text-red-400">Lỗi</span>;
  if (status === 'RUNNING') {
    if (percent !== undefined) return <span className="tabular-nums text-hq-text">{percent}%</span>;
    return (
      <span className="flex items-center gap-1 whitespace-nowrap text-hq-muted">
        <IconSpinner size={12} /> Đang chạy
      </span>
    );
  }
  return <span className="text-hq-muted">Chờ</span>;
}

function CodeChip({ code, active }: { code: string; active?: boolean }) {
  return (
    <span
      className={`grid h-5 min-w-6 place-items-center rounded border px-1 text-[11px] font-semibold ${
        active ? 'border-hq-accent bg-hq-accent/15 text-hq-accent' : 'border-hq-border bg-white/5 text-hq-text'
      }`}
    >
      {code}
    </span>
  );
}

function AgentChip({ agent }: { agent: string }) {
  const m = getAgentMeta(agent);
  return (
    <span
      className="flex w-[72px] items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px]"
      style={{ borderColor: `${m.color}66`, color: m.color, background: `${m.color}14` }}
    >
      <span className="text-[9px]">{m.glyph}</span> {m.label}
    </span>
  );
}

interface TaskTreeProps {
  projectTitle: string;
  tasks: DAGTaskItem[];
  highlightCode: string | null;
  onHover: (code: string | null) => void;
}

export function TaskTree({ projectTitle, tasks, highlightCode, onHover }: TaskTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [rootOpen, setRootOpen] = useState(true);
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;
  const pct = tasks.length ? (done / tasks.length) * 100 : 0;

  return (
    <section className="flex max-h-[45%] min-h-[180px] shrink-0 flex-col overflow-hidden rounded-xl border border-hq-border bg-hq-panel">
      <header className="flex items-center gap-2 border-b border-hq-border px-4 py-2.5">
        <IconLayers size={15} className="text-hq-muted" />
        <h2 className="text-sm font-semibold">Sơ đồ task</h2>
        <span className="ml-auto text-xs text-hq-muted">
          {done}/{tasks.length} hoàn tất
        </span>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-hq-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="overflow-y-auto px-3 py-2 text-[13px]" onMouseLeave={() => onHover(null)}>
        <button className="flex w-full items-center gap-2 py-1 font-medium" onClick={() => setRootOpen(!rootOpen)}>
          {rootOpen ? <IconChevronDown size={13} className="text-hq-muted" /> : <IconChevronRight size={13} className="text-hq-muted" />}
          <IconFolder size={15} className="text-hq-muted" />
          {projectTitle}
        </button>

        {rootOpen && (
          <ul className="ml-[22px] border-l border-hq-border/70">
            {tasks.map((t) => {
              const subs = t.sub_tasks ?? [];
              const open = !collapsed[t.step_code];
              const subDone = subs.filter((s) => normalizeStatus(s.status) === 'COMPLETED').length;
              const percent = subs.length && t.status === 'RUNNING' ? Math.round((subDone / subs.length) * 100) : undefined;
              const hl = highlightCode === t.step_code;
              return (
                <li key={t.step_code}>
                  <div
                    className={`grid grid-cols-[14px_16px_auto_1fr_auto_84px] items-center gap-2 rounded-md py-1 pl-2 pr-1 transition ${hl ? 'bg-hq-accent/10' : 'hover:bg-white/[0.03]'}`}
                    onMouseEnter={() => onHover(t.step_code)}
                  >
                    {subs.length ? (
                      <button onClick={() => setCollapsed({ ...collapsed, [t.step_code]: open })} aria-label="Mở/đóng">
                        {open ? <IconChevronDown size={12} className="text-hq-muted" /> : <IconChevronRight size={12} className="text-hq-muted" />}
                      </button>
                    ) : (
                      <span />
                    )}
                    <StatusIcon status={t.status} />
                    <CodeChip code={t.step_code} active={hl} />
                    <span className="truncate">{t.title}</span>
                    <AgentChip agent={t.assigned_agent} />
                    <span className="flex justify-end text-xs">
                      <StatusText status={t.status} percent={percent} />
                    </span>
                  </div>

                  {open && subs.length > 0 && (
                    <ul className="ml-[38px] border-l border-hq-border/70">
                      {subs.map((s) => {
                        const st = normalizeStatus(s.status);
                        const shl = highlightCode === s.sub_code;
                        return (
                          <li
                            key={s.sub_code}
                            className={`grid grid-cols-[auto_1fr_84px] items-center gap-2 rounded-md py-1 pl-3 pr-1 transition ${shl ? 'bg-hq-accent/10' : 'hover:bg-white/[0.03]'}`}
                            onMouseEnter={() => onHover(s.sub_code)}
                          >
                            <CodeChip code={s.sub_code} active={shl} />
                            <span className="truncate text-hq-text/90">{s.title}</span>
                            <span className="flex justify-end text-xs">
                              <StatusText status={st} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
            {tasks.length === 0 && <li className="py-2 pl-3 text-hq-muted">Chưa có task — gửi yêu cầu để Triage Router lập DAG.</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
