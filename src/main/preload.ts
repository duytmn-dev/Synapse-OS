import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { IPC, type SynapseAPI } from './ipc';

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: SynapseAPI = {
  getQuota: () => ipcRenderer.invoke(IPC.getQuota),
  getTasks: () => ipcRenderer.invoke(IPC.getTasks),
  getOffice: () => ipcRenderer.invoke(IPC.getOffice),
  onQuotaUpdated: (callback) => subscribe(IPC.quotaUpdated, callback),
  onTasksUpdated: (callback) => subscribe(IPC.tasksUpdated, callback),
  onOfficeUpdated: (callback) => subscribe(IPC.officeUpdated, callback),
  getActiveRooms: () => ipcRenderer.invoke(IPC.getActiveRooms),
  onActiveRoomsUpdated: (callback) => subscribe(IPC.activeRoomsUpdated, callback),
  getWorkspaceStorage: () => ipcRenderer.invoke(IPC.getStorage),
  saveAgentKey: (agentId, key) => ipcRenderer.invoke(IPC.saveKey, agentId, key),
};

contextBridge.exposeInMainWorld('synapse', api);
