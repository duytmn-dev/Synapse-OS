import type { AgentBrandId, VisualOfficeEvent } from '@shared/types';

export type RoomId = VisualOfficeEvent['room_id'];

export interface AgentMeta {
  id: AgentBrandId;
  label: string;
  /** Màu thương hiệu (hex) dùng cho chip, nhân vật 3D, thanh quota. */
  color: string;
  glyph: string;
}

const KNOWN_AGENTS: Record<string, AgentMeta> = {
  chatgpt: { id: 'chatgpt', label: 'ChatGPT', color: '#10b981', glyph: '◎' },
  codex: { id: 'codex', label: 'Codex', color: '#3b82f6', glyph: '</>' },
  gemini: { id: 'gemini', label: 'Gemini', color: '#a78bfa', glyph: '✦' },
  claude: { id: 'claude', label: 'Claude', color: '#f59e0b', glyph: '✺' },
  manager: { id: 'manager', label: 'Quản lý', color: '#facc15', glyph: '▣' },
};

/** Trả về meta cho agent; agent lạ (plug & play) được sinh màu ổn định từ id. */
export function getAgentMeta(id: AgentBrandId): AgentMeta {
  const known = KNOWN_AGENTS[id.toLowerCase()];
  if (known) return known;
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    color: `hsl(${hash % 360} 70% 60%)`,
    glyph: '●',
  };
}

export interface RoomMeta {
  id: RoomId;
  label: string;
  subLabel?: string;
  agent: AgentBrandId;
}

/** Ánh xạ đầy đủ room_id → phòng. Nếu Backend thêm room_id mới, TS sẽ báo lỗi ở đây. */
export const ROOMS: Record<RoomId, RoomMeta> = {
  MANAGER: { id: 'MANAGER', label: 'QUẢN LÝ', agent: 'manager' },
  CODEX: { id: 'CODEX', label: 'CODEX', agent: 'codex' },
  GEMINI_AGY: { id: 'GEMINI_AGY', label: 'GEMINI', subLabel: 'Antigravity', agent: 'gemini' },
  CHATGPT: { id: 'CHATGPT', label: 'CHATGPT', agent: 'chatgpt' },
  CLAUDE_EXT: { id: 'CLAUDE_EXT', label: 'CLAUDE · CÔNG TY', agent: 'claude' },
};

export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
