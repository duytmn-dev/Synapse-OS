import type { AgentQuotaStat } from '@shared/types';
import { IconLayers } from '../icons';

interface QuotaPanelProps {
  quota: AgentQuotaStat[];
  live?: boolean;
}

interface AgentDisplayConfig {
  id: string;
  name: string;
  color: string;
}

const AGENTS: AgentDisplayConfig[] = [
  { id: 'chatgpt', name: 'ChatGPT', color: '#58E9A8' },
  { id: 'gemini', name: 'Gemini', color: '#A88BFA' },
  { id: 'codex', name: 'Codex', color: '#78BAFF' },
  { id: 'claude', name: 'Claude', color: '#FFC075' },
];

export function QuotaPanel({ quota, live = false }: QuotaPanelProps) {
  return (
    <div className="flex flex-col gap-2.5 pt-1">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-[#8297B2]">
          GIỚI HẠN AGENT
        </span>
        <IconLayers size={14} className="text-[#8297B2]" />
      </div>

      {/* Sub Header */}
      <div className="flex items-center justify-between text-[10.5px] text-[#8297B2]">
        <span>% đã dùng</span>
        <span className="font-mono text-[11px]">5 giờ / Tuần</span>
      </div>

      {/* Agents List */}
      <div className="flex flex-col gap-3">
        {AGENTS.map((cfg) => {
          const stat = quota.find(
            (q) => q.agent_id.toLowerCase() === cfg.id || (cfg.id === 'gemini' && q.agent_id.toLowerCase().includes('gemini'))
          );
          const p5h = stat?.usage_5h_percent ?? null;
          const pWeek = stat?.usage_week_percent ?? null;
          const isWarning = stat?.connection_status === 'OUT_OF_QUOTA' || (p5h ?? 0) >= 80;
          const status = stat?.connection_status === 'CONNECTED' ? 'Đã kết nối'
            : stat?.connection_status === 'OUT_OF_QUOTA' ? 'Hết quota' : 'Chưa kết nối';

          return (
            <div key={cfg.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: cfg.color, opacity: stat?.connection_status === 'DISCONNECTED' ? 0.4 : 1 }}
                    title={status}
                  />
                  <span className="text-[12px] font-medium text-[#9DB0C8]">
                    {cfg.name}
                  </span>
                  {stat?.connection_status && <span className="text-[10px] text-[#8297B2]">{status}</span>}
                </div>
                <span
                  className={`font-mono text-[11px] font-normal ${
                    isWarning ? 'text-[#FFC075]' : 'text-[#9DB0C8]'
                  }`}
                >
                  {p5h === null ? '—' : `${p5h}%`} / {pWeek === null ? '—' : `${pWeek}%`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#23344A]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(Math.max(p5h ?? 0, 0), 100)}%`,
                    backgroundColor: cfg.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer live status */}
      <span className="mt-1 text-[10.5px] text-[#8297B2]">
        {live ? 'Đã kết nối IPC thời gian thực' : 'Chưa có kết nối IPC'}
      </span>
    </div>
  );
}
