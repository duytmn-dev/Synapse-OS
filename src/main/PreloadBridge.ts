import type { IpcRenderer, IpcRendererEvent } from 'electron';
import { EVENT_CHANNELS, REQUEST_CHANNELS, type SynapseAPI, type SynapseRequests } from './ipc.ts';

/** Only allowlisted operations are exposed; Electron event objects stay private. */
export function createSynapseAPI(ipc: Pick<IpcRenderer, 'invoke' | 'on' | 'removeListener'>) {
  function invoke<K extends keyof SynapseRequests>(method: K, ...args: Parameters<SynapseRequests[K]>): ReturnType<SynapseRequests[K]> {
    return ipc.invoke(REQUEST_CHANNELS[method], ...args) as ReturnType<SynapseRequests[K]>;
  }
  function subscribe<K extends keyof typeof EVENT_CHANNELS>(method: K, callback: Parameters<SynapseAPI[K]>[0]): () => void {
    type Payload = Parameters<Parameters<SynapseAPI[K]>[0]>[0];
    const listener = (_event: IpcRendererEvent, payload: Payload) => (callback as (value: Payload) => void)(payload);
    ipc.on(EVENT_CHANNELS[method], listener);
    return () => { ipc.removeListener(EVENT_CHANNELS[method], listener); };
  }
  return {
    getQuota: () => invoke('getQuota'),
    getTasks: () => invoke('getTasks'),
    getOffice: () => invoke('getOffice'),
    getActiveRooms: () => invoke('getActiveRooms'),
    getWorkspaceStorage: () => invoke('getWorkspaceStorage'),
    saveAgentKey: (agentId, key) => invoke('saveAgentKey', agentId, key),
    getGraphData: (projectHash) => invoke('getGraphData', projectHash),
    controlGraphNode: (command) => invoke('controlGraphNode', command),
    openShadowProject: (projectPath) => invoke('openShadowProject', projectPath),
    pickShadowProject: () => invoke('pickShadowProject'),
    getShadowProjects: () => invoke('getShadowProjects'),
    getChatSessions: (projectHash) => invoke('getChatSessions', projectHash),
    getChatMessages: (projectHash, sessionId) => invoke('getChatMessages', projectHash, sessionId),
    saveChatMessages: (projectHash, sessionId, messages) => invoke('saveChatMessages', projectHash, sessionId, messages),
    mutateChatSession: (request) => invoke('mutateChatSession', request),
    sendGeminiMessage: (message) => invoke('sendGeminiMessage', message),
    getTaskTree: () => invoke('getTaskTree'),
    getAINetworkSettings: () => invoke('getAINetworkSettings'),
    setDefaultChatAgent: (agentId) => invoke('setDefaultChatAgent', agentId),
    agentConnectionAction: (agentId, action) => invoke('agentConnectionAction', agentId, action),
    setFallbackOnError: (agentId, enabled) => invoke('setFallbackOnError', agentId, enabled),
    setAgentAlertThreshold: (agentId, percent) => invoke('setAgentAlertThreshold', agentId, percent),
    getAppearanceSettings: () => invoke('getAppearanceSettings'),
    saveAppearanceSettings: (settings) => invoke('saveAppearanceSettings', settings),
    getToolDependencies: () => invoke('getToolDependencies'),
    ensureToolDependency: (toolId) => invoke('ensureToolDependency', toolId),
    getUpdateStatus: () => invoke('getUpdateStatus'),
    onQuotaUpdated: (callback) => subscribe('onQuotaUpdated', callback),
    onTasksUpdated: (callback) => subscribe('onTasksUpdated', callback),
    onOfficeUpdated: (callback) => subscribe('onOfficeUpdated', callback),
    onActiveRoomsUpdated: (callback) => subscribe('onActiveRoomsUpdated', callback),
    onGraphDataUpdated: (callback) => subscribe('onGraphDataUpdated', callback),
    onGraphActiveEvent: (callback) => subscribe('onGraphActiveEvent', callback),
    onShadowProjectsUpdated: (callback) => subscribe('onShadowProjectsUpdated', callback),
    onChatSessionsUpdated: (callback) => subscribe('onChatSessionsUpdated', callback),
    onTaskTreeUpdated: (callback) => subscribe('onTaskTreeUpdated', callback),
  } satisfies SynapseAPI;
}
