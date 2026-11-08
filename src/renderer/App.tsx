import type { AgentQuotaStat } from '@shared/types';

// Placeholder Pha 0 — Layout 3 cột sẽ được dựng ở Pha 1.
const demoQuota: AgentQuotaStat[] = [
  { agent_id: 'chatgpt', usage_5h_percent: 40, usage_week_percent: 28 },
  { agent_id: 'codex', usage_5h_percent: 70, usage_week_percent: 45 },
  { agent_id: 'gemini', usage_5h_percent: 25, usage_week_percent: 18 },
  { agent_id: 'claude', usage_5h_percent: 90, usage_week_percent: 65 },
];

export default function App() {
  return (
    <main className="flex h-full items-center justify-center">
      <div className="rounded-xl border border-hq-border bg-hq-panel p-6">
        <h1 className="mb-4 text-xl font-semibold text-hq-accent">AGENT HQ · Synapse OS</h1>
        <p className="mb-3 text-sm text-hq-muted">Pha 0 hoàn tất — sẵn sàng dựng UI.</p>
        <ul className="space-y-1 text-sm">
          {demoQuota.map((q) => (
            <li key={q.agent_id} className="flex justify-between gap-8">
              <span className="capitalize">{q.agent_id}</span>
              <span>
                {q.usage_5h_percent}% · {q.usage_week_percent}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
