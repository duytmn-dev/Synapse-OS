import type { AgentQuotaStat } from '@shared/types';
import { getAgentMeta } from '../agents';
import { IconInfo, IconLayers } from '../icons';

function levelColor(pct: number): string {
  return pct >= 85 ? '#fbbf24' : '#e5e9f0';
}

function barColor(pct: number): string {
  if (pct >= 85) return '#f59e0b';
  if (pct >= 60) return '#38bdf8';
  return '#2dd4a7';
}

function statusDot(stat: AgentQuotaStat): string {
  const worst = Math.max(stat.usage_5h_percent, stat.usage_week_percent);
  if (worst >= 100) return '#ef4444';
  if (worst >= 85) return '#f59e0b';
  return '#22c55e';
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function UsageCell({ pct, compact }: { pct: number; compact: boolean }) {
  const v = clamp(pct);
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="tabular-nums" style={{ color: levelColor(v) }}>
        {v}%
      </span>
      {!compact && (
        <div className="h-1 w-full max-w-10 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v}%`, background: barColor(v) }} />
        </div>
      )}
    </div>
  );
}

export function QuotaPanel({ quota, live, compact = false }: { quota: AgentQuotaStat[]; live: boolean; compact?: boolean }) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <IconLayers size={15} className="text-hq-muted" /> Giới hạn
        </h2>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            live ? 'border-hq-accent/40 text-hq-accent' : 'border-hq-border text-hq-muted'
          }`}
        >
          {live ? 'Trực tiếp' : 'Minh hoạ'}
        </span>
      </header>

      <div className="rounded-lg border border-hq-border bg-black/10">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col />
            <col className="w-[52px]" />
            <col className="w-[52px]" />
          </colgroup>
          <thead>
            <tr className="text-hq-muted">
              <th className="px-2 py-2 text-left font-medium">Agent</th>
              <th className="px-1.5 py-2 text-right font-medium">5h</th>
              <th className="px-2 py-2 text-right font-medium">Tuần</th>
            </tr>
          </thead>
          <tbody>
            {quota.map((q) => {
              const meta = getAgentMeta(q.agent_id);
              return (
                <tr key={q.agent_id} className="border-t border-hq-border/60">
                  <td className="px-2 py-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold"
                        style={{ background: `${meta.color}26`, color: meta.color }}
                      >
                        {meta.glyph}
                      </span>
                      <span className="truncate">{meta.label}</span>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusDot(q) }} />
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-right">
                    <UsageCell pct={q.usage_5h_percent} compact={compact} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <UsageCell pct={q.usage_week_percent} compact={compact} />
                  </td>
                </tr>
              );
            })}
            {quota.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2.5 py-3 text-center text-hq-muted">
                  Chưa có agent nào kết nối
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-hq-muted">
        <IconInfo size={12} /> % đã dùng · {live ? 'QuotaTracker' : 'Minh hoạ'}
      </p>
    </section>
  );
}
