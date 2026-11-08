import type { AgentQuotaStat, DAGTaskItem, VisualOfficeEvent } from '../shared/types';

export const IPC = {
  getQuota: 'synapse:quota:get',
  getTasks: 'synapse:tasks:get',
  getOffice: 'synapse:office:get',
  quotaUpdated: 'synapse:quota:updated',
  tasksUpdated: 'synapse:tasks:updated',
  officeUpdated: 'synapse:office:updated',
} as const;

export interface SynapseAPI {
  getQuota(): Promise<AgentQuotaStat[]>;
  getTasks(): Promise<DAGTaskItem[]>;
  getOffice(): Promise<VisualOfficeEvent[]>;
  onQuotaUpdated(callback: (quota: AgentQuotaStat[]) => void): () => void;
  onTasksUpdated(callback: (tasks: DAGTaskItem[]) => void): () => void;
  onOfficeUpdated(callback: (event: VisualOfficeEvent) => void): () => void;
}

declare global {
  interface Window {
    synapse: SynapseAPI;
  }
}
