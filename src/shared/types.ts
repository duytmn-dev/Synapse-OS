/**
 * SYNAPSE OS — HỢP ĐỒNG DỮ LIỆU TĨNH (Shared Data Contracts)
 * Nguồn: docs/04_SHARED_DATA_CONTRACTS.md — phải khớp 100%.
 * Chủ sở hữu: Nhánh Frontend (Antigravity). Backend (Codex) CHỈ ĐỌC.
 */

// Dùng chung cho toàn dự án
export type AgentBrandId = 'chatgpt' | 'codex' | 'gemini' | 'claude' | string;

export interface AgentQuotaStat {
  agent_id: AgentBrandId;
  usage_5h_percent: number;
  usage_week_percent: number;
}

export interface DAGTaskItem {
  step_code: string;            // "A", "B"
  title: string;
  assigned_agent: AgentBrandId;
  status: 'COMPLETED' | 'RUNNING' | 'WAITING' | 'FAILED';
  sub_tasks?: { sub_code: string; title: string; status: string }[]; // "B1", "B2"
}

export interface VisualOfficeEvent {
  room_id: 'MANAGER' | 'CODEX' | 'GEMINI_AGY' | 'CHATGPT' | 'CLAUDE_EXT';
  desk_index: 0 | 1 | 2;
  active_task_code: string | null; // Hiện huy hiệu "B1" lên nhân vật
  animation_state: 'IDLE' | 'TYPING' | 'THINKING' | 'DONE';
}
