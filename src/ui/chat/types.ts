import type { AgentBrandId } from '@shared/types';

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
  thumbnails?: string[];
}

export interface ChatMessage {
  id: string;
  author: 'user' | 'system';
  authorName: string;
  agentId?: string;
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
  isPinned?: boolean;
  projectHash?: string | null;
  updatedAt?: number;
}

export type ViewMode = 'chat' | 'graph';

export type TargetAgent = AgentBrandId | 'auto';
