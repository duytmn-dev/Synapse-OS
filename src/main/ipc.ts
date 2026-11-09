import type {
  AgentId, AgentQuotaStat, DAGTaskItem, VisualOfficeEvent, GraphData,
  GraphActiveEvent, GraphNodeControlCommand, ShadowProjectMeta,
  ChatSessionItem, ChatSessionMutationRequest, TaskTreeSnapshot,
  AINetworkSettings, AgentSettingsProfile, AppearanceAndGraphSettings,
  ToolDependencyStatus, WorkspaceStorageInfo, UpdateStatus,
} from '../shared/types';

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
  getGraphData: 'synapse:graph:get',
  controlGraphNode: 'synapse:graph:control',
  graphDataUpdated: 'graph_data_update',
  graphActiveEvent: 'graph_active_event',
  openShadowProject: 'synapse:shadow:open',
  pickShadowProject: 'synapse:shadow:pick',
  getShadowProjects: 'synapse:shadow:list',
  shadowProjectsUpdated: 'shadow_projects_update',
  getChatSessions: 'synapse:chat:list',
  getChatMessages: 'synapse:chat:messages:get',
  saveChatMessages: 'synapse:chat:messages:save',
  mutateChatSession: 'synapse:chat:mutate',
  sendGeminiMessage: 'synapse:chat:gemini',
  chatSessionsUpdated: 'chat_sessions_update',
  getTaskTree: 'synapse:task_tree:get',
  taskTreeUpdated: 'task_tree_update',
  getAINetworkSettings: 'synapse:settings:ai:get',
  setDefaultChatAgent: 'synapse:settings:ai:default',
  agentConnectionAction: 'synapse:settings:agent:action',
  setFallbackOnError: 'synapse:settings:agent:fallback',
  setAgentAlertThreshold: 'synapse:settings:agent:threshold',
  getAppearanceSettings: 'synapse:settings:appearance:get',
  saveAppearanceSettings: 'synapse:settings:appearance:save',
  getToolDependencies: 'synapse:tools:get',
  ensureToolDependency: 'synapse:tools:ensure',
  getUpdateStatus: 'synapse:updates:get',
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

// IPC operation signatures only; all domain payloads come from shared/types.ts.
export interface SynapseRequests {
  getQuota(): Promise<AgentQuotaStat[]>;
  getTasks(): Promise<DAGTaskItem[]>;
  getOffice(): Promise<VisualOfficeEvent[]>;
  getActiveRooms(): Promise<ActiveRoomsSnapshot>;
  getWorkspaceStorage(): Promise<WorkspaceStorageInfo>;
  saveAgentKey(agentId: AgentId, key: string): Promise<void>;
  getGraphData(projectHash: string): Promise<GraphData>;
  controlGraphNode(command: GraphNodeControlCommand): Promise<void>;
  openShadowProject(projectPath: string): Promise<ShadowProjectMeta>;
  pickShadowProject(): Promise<ShadowProjectMeta | null>;
  getShadowProjects(): Promise<ShadowProjectMeta[]>;
  // null selects standalone conversations; no implicit current project.
  getChatSessions(projectHash: string | null): Promise<ChatSessionItem[]>;
  getChatMessages(projectHash: string | null, sessionId: string): Promise<unknown[]>;
  saveChatMessages(projectHash: string | null, sessionId: string, messages: unknown[]): Promise<ChatSessionItem[]>;
  // Returns the affected scope's remaining sessions, including after DELETE.
  mutateChatSession(request: ChatSessionMutationRequest): Promise<ChatSessionItem[]>;
  sendGeminiMessage(message: string): Promise<string>;
  getTaskTree(): Promise<TaskTreeSnapshot>;
  getAINetworkSettings(): Promise<AINetworkSettings>;
  setDefaultChatAgent(agentId: AINetworkSettings['default_chat_agent_id']): Promise<AINetworkSettings>;
  agentConnectionAction(agentId: AgentId, action: 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI' | 'CHECK_API'): Promise<AgentSettingsProfile>;
  setFallbackOnError(agentId: AgentId, enabled: boolean): Promise<AgentSettingsProfile>;
  setAgentAlertThreshold(agentId: AgentId, percent: number): Promise<AgentSettingsProfile>;
  getAppearanceSettings(): Promise<AppearanceAndGraphSettings>;
  saveAppearanceSettings(settings: AppearanceAndGraphSettings): Promise<void>;
  getToolDependencies(): Promise<ToolDependencyStatus[]>;
  ensureToolDependency(toolId: ToolDependencyStatus['tool_id']): Promise<ToolDependencyStatus>;
  getUpdateStatus(): Promise<UpdateStatus>;
}

export interface SynapseAPI extends SynapseRequests {
  onQuotaUpdated(callback: (quota: AgentQuotaStat[]) => void): () => void;
  onTasksUpdated(callback: (tasks: DAGTaskItem[]) => void): () => void;
  onOfficeUpdated(callback: (event: VisualOfficeEvent) => void): () => void;
  onActiveRoomsUpdated(callback: (snapshot: ActiveRoomsSnapshot) => void): () => void;
  onGraphDataUpdated(callback: (graph: GraphData) => void): () => void;
  onGraphActiveEvent(callback: (event: GraphActiveEvent) => void): () => void;
  onShadowProjectsUpdated(callback: (projects: ShadowProjectMeta[]) => void): () => void;
  onChatSessionsUpdated(callback: (sessions: ChatSessionItem[]) => void): () => void;
  onTaskTreeUpdated(callback: (tree: TaskTreeSnapshot) => void): () => void;
}

export const REQUEST_CHANNELS = {
  getQuota: IPC.getQuota,
  getTasks: IPC.getTasks,
  getOffice: IPC.getOffice,
  getActiveRooms: IPC.getActiveRooms,
  getWorkspaceStorage: IPC.getStorage,
  saveAgentKey: IPC.saveKey,
  getGraphData: IPC.getGraphData,
  controlGraphNode: IPC.controlGraphNode,
  openShadowProject: IPC.openShadowProject,
  pickShadowProject: IPC.pickShadowProject,
  getShadowProjects: IPC.getShadowProjects,
  getChatSessions: IPC.getChatSessions,
  getChatMessages: IPC.getChatMessages,
  saveChatMessages: IPC.saveChatMessages,
  mutateChatSession: IPC.mutateChatSession,
  sendGeminiMessage: IPC.sendGeminiMessage,
  getTaskTree: IPC.getTaskTree,
  getAINetworkSettings: IPC.getAINetworkSettings,
  setDefaultChatAgent: IPC.setDefaultChatAgent,
  agentConnectionAction: IPC.agentConnectionAction,
  setFallbackOnError: IPC.setFallbackOnError,
  setAgentAlertThreshold: IPC.setAgentAlertThreshold,
  getAppearanceSettings: IPC.getAppearanceSettings,
  saveAppearanceSettings: IPC.saveAppearanceSettings,
  getToolDependencies: IPC.getToolDependencies,
  ensureToolDependency: IPC.ensureToolDependency,
  getUpdateStatus: IPC.getUpdateStatus,
} as const satisfies Record<keyof SynapseRequests, string>;

export const EVENT_CHANNELS = {
  onQuotaUpdated: IPC.quotaUpdated,
  onTasksUpdated: IPC.tasksUpdated,
  onOfficeUpdated: IPC.officeUpdated,
  onActiveRoomsUpdated: IPC.activeRoomsUpdated,
  onGraphDataUpdated: IPC.graphDataUpdated,
  onGraphActiveEvent: IPC.graphActiveEvent,
  onShadowProjectsUpdated: IPC.shadowProjectsUpdated,
  onChatSessionsUpdated: IPC.chatSessionsUpdated,
  onTaskTreeUpdated: IPC.taskTreeUpdated,
} as const satisfies Record<Exclude<keyof SynapseAPI, keyof SynapseRequests>, string>;

declare global {
  interface Window {
    synapse: SynapseAPI;
  }
}
