import type { AgentBrandId } from '@shared/types';

/**
 * Kiểu dữ liệu CHỈ dùng nội bộ UI (chưa có trong hợp đồng docs/04).
 * Nếu Backend cần đẩy tin nhắn qua IPC, phải đề xuất bổ sung vào src/shared/types.ts.
 */
export interface ChatAttachment {
  name: string;
  sizeLabel: string;
  kind: 'video' | 'file';
}

export interface ChatCode {
  filename: string;
  language: string;
  code: string;
}

export interface ChatMedia {
  title: string;
  durationSec: number;
  thumbnails: string[]; // CSS gradient hoặc URL
}

export interface ChatMessage {
  id: string;
  author: 'user' | 'system';
  authorName: string;
  time: string;
  text: string;
  attachments?: ChatAttachment[];
  orchestration?: { label: string };
  code?: ChatCode;
  media?: ChatMedia;
}

export interface Conversation {
  id: string;
  title: string;
}

export type ViewMode = 'chat' | 'chat3d';

export type TargetAgent = AgentBrandId | 'auto';
