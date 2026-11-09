import type { AgentBrandId, AgentQuotaStat } from '../shared/types';

export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export interface QuotaLimits { fiveHours: number; week: number }
export interface UsageRecord { id: string; units: number; timestamp: number }
type MeasuredQuotaStat = AgentQuotaStat & { usage_5h_percent: number; usage_week_percent: number };

/** Rolling windows (now-duration, now], using the same unit as the configured
 * provider limits (requests, tokens, credits...). Never infers limits from a brand.
 * In-memory ledger: import provider usage/history on startup; counts represent
 * only the supplied records, not unobserved activity in other applications.
 */
export class QuotaTracker {
  private readonly agents = new Map<AgentBrandId, { limits: QuotaLimits; records: Map<string, UsageRecord> }>();
  private readonly listeners = new Set<(stats: AgentQuotaStat[]) => void>();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) { this.now = now; }

  configure(agent: AgentBrandId, limits: QuotaLimits): void {
    if (!agent.trim() || ![limits.fiveHours, limits.week].every((n) => Number.isSafeInteger(n) && n > 0)) {
      throw new Error('Agent and positive integer quota limits are required');
    }
    this.agents.set(agent, { limits: { ...limits }, records: this.agents.get(agent)?.records ?? new Map() });
    this.refresh();
  }

  record(agent: AgentBrandId, usage: UsageRecord): void {
    const state = this.agents.get(agent);
    if (!state) throw new Error(`Configure quota limits for ${agent} first`);
    const now = this.now();
    if (!usage.id.trim() || !Number.isSafeInteger(usage.units) || usage.units < 0 ||
        !Number.isSafeInteger(usage.timestamp) || usage.timestamp < 0 || usage.timestamp > now) {
      throw new Error('Invalid usage record');
    }
    const existing = state.records.get(usage.id);
    if (existing) {
      if (existing.units !== usage.units || existing.timestamp !== usage.timestamp) throw new Error('Conflicting usage ID');
      return;
    }
    state.records.set(usage.id, { ...usage });
    this.refresh();
  }

  getStats(at = this.now()): MeasuredQuotaStat[] {
    if (!Number.isSafeInteger(at) || at < 0) throw new Error('Invalid quota timestamp');
    return [...this.agents].map(([agent, { limits, records }]) => {
      let five = 0n; let week = 0n;
      for (const record of records.values()) {
        if (record.timestamp > at || record.timestamp <= at - WEEK_MS) continue;
        week += BigInt(record.units);
        if (record.timestamp > at - FIVE_HOURS_MS) five += BigInt(record.units);
      }
      // BigInt accumulation avoids overflow; clamp only the display percentage.
      const percent = (used: bigint, limit: number) => used >= BigInt(limit) ? 100 : Number(used) / limit * 100;
      return { agent_id: agent, usage_5h_percent: percent(five, limits.fiveHours), usage_week_percent: percent(week, limits.week) };
    });
  }

  /** Invoke on a UI refresh/timer as windows expire, even without new usage. */
  refresh(): void {
    for (const listener of [...this.listeners]) {
      try { listener(this.getStats()); } catch { /* Observers cannot alter accounting. */ }
    }
  }
  onUpdated(listener: (stats: AgentQuotaStat[]) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
