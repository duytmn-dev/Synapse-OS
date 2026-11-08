import type { AgentQuotaStat, DAGTaskItem, VisualOfficeEvent } from '../shared/types';

export const IPC = {
  getQuota: 'synapse:quota:get',
  getTasks: 'synapse:tasks:get',
  getOffice: 'synapse:office:get',
  quotaUpdated: 'synapse:quota:updated',
  tasksUpdated: 'synapse:tasks:updated',
  officeUpdated: 'synapse:office:updated',
  getActiveRooms: 'synapse:active_rooms:get',
  activeRoomsUpdated: 'active_rooms_update',
  getStorage: 'synapse:storage:get',
  saveKey: 'synapse:key:save',
} as const;

export interface AgentRuntimeStatus {
  agent_id: string;
  connection_status: 'CONNECTED' | 'DISCONNECTED' | 'OUT_OF_QUOTA';
  worker_model_name?: string;
  keychain_configured: boolean | null;
}
export interface ActiveRoomsSnapshot {
  active_rooms: VisualOfficeEvent['room_id'][];
  agents: AgentRuntimeStatus[];
  memory: { total_bytes: number; free_bytes: number; process_rss_bytes: number };
  storage?: import('../shared/types').WorkspaceStorageInfo;
}

export interface SynapseAPI {
  getQuota(): Promise<AgentQuotaStat[]>;
  getTasks(): Promise<DAGTaskItem[]>;
  getOffice(): Promise<VisualOfficeEvent[]>;
  onQuotaUpdated(callback: (quota: AgentQuotaStat[]) => void): () => void;
  onTasksUpdated(callback: (tasks: DAGTaskItem[]) => void): () => void;
  onOfficeUpdated(callback: (event: VisualOfficeEvent) => void): () => void;
  getActiveRooms(): Promise<ActiveRoomsSnapshot>;
  onActiveRoomsUpdated(callback: (snapshot: ActiveRoomsSnapshot) => void): () => void;
  getWorkspaceStorage(): Promise<{ total_used_mb: number; core_app_mb: number; temp_files_mb: number }>;
  saveAgentKey(agentId: string, key: string): Promise<void>;
}

declare global {
  interface Window {
    synapse: SynapseAPI;
  }
}
