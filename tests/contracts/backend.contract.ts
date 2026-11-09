/** Compile-time contract: npx tsc --noEmit. Domain types are never copied. */
import type {
  AgentId, AgentQuotaStat, DAGTaskItem, VisualOfficeEvent, GraphDataSnapshot,
  GraphActiveEvent, GraphNodeControlCommand, ShadowProjectInfo, ChatSessionItem,
  ChatSessionMutationRequest, TaskTreeSnapshot, AINetworkSettings,
  AgentSettingsProfile, AppearanceAndGraphSettings, ToolDependencyStatus,
  WorkspaceStorageInfo, UpdateStatus,
} from '../../src/shared/types';
import type { ActiveRoomsSnapshot, SynapseAPI } from '../../src/main/ipc';
import type { createSynapseAPI } from '../../src/main/PreloadBridge';
import type { Phase0Requests, phase0Handlers } from '../../src/main/Phase0Handlers';

type Subscription<T> = (callback: (payload: T) => void) => () => void;
type Expected = {
  getQuota: () => Promise<AgentQuotaStat[]>;
  getTasks: () => Promise<DAGTaskItem[]>;
  getOffice: () => Promise<VisualOfficeEvent[]>;
  getActiveRooms: () => Promise<ActiveRoomsSnapshot>;
  getWorkspaceStorage: () => Promise<WorkspaceStorageInfo>;
  saveAgentKey: (agentId: AgentId, key: string) => Promise<void>;
  getGraphData: (projectHash: string) => Promise<GraphDataSnapshot>;
  controlGraphNode: (command: GraphNodeControlCommand) => Promise<void>;
  openShadowProject: (projectPath: string) => Promise<ShadowProjectInfo>;
  pickShadowProject: () => Promise<ShadowProjectInfo | null>;
  getShadowProjects: () => Promise<ShadowProjectInfo[]>;
  getChatSessions: (projectHash: string | null) => Promise<ChatSessionItem[]>;
  mutateChatSession: (request: ChatSessionMutationRequest) => Promise<ChatSessionItem[]>;
  getTaskTree: () => Promise<TaskTreeSnapshot>;
  getAINetworkSettings: () => Promise<AINetworkSettings>;
  setDefaultChatAgent: (agentId: AINetworkSettings['default_chat_agent_id']) => Promise<AINetworkSettings>;
  agentConnectionAction: (agentId: AgentId, action: 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI' | 'CHECK_API') => Promise<AgentSettingsProfile>;
  setFallbackOnError: (agentId: AgentId, enabled: boolean) => Promise<AgentSettingsProfile>;
  setAgentAlertThreshold: (agentId: AgentId, percent: number) => Promise<AgentSettingsProfile>;
  getAppearanceSettings: () => Promise<AppearanceAndGraphSettings>;
  saveAppearanceSettings: (settings: AppearanceAndGraphSettings) => Promise<void>;
  getToolDependencies: () => Promise<ToolDependencyStatus[]>;
  ensureToolDependency: (toolId: ToolDependencyStatus['tool_id']) => Promise<ToolDependencyStatus>;
  getUpdateStatus: () => Promise<UpdateStatus>;
  onQuotaUpdated: Subscription<AgentQuotaStat[]>;
  onTasksUpdated: Subscription<DAGTaskItem[]>;
  onOfficeUpdated: Subscription<VisualOfficeEvent>;
  onActiveRoomsUpdated: Subscription<ActiveRoomsSnapshot>;
  onGraphDataUpdated: Subscription<GraphDataSnapshot>;
  onGraphActiveEvent: Subscription<GraphActiveEvent>;
  onShadowProjectsUpdated: Subscription<ShadowProjectInfo[]>;
  onChatSessionsUpdated: Subscription<ChatSessionItem[]>;
  onTaskTreeUpdated: Subscription<TaskTreeSnapshot>;
};
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type Actual = ReturnType<typeof createSynapseAPI>;
export type BackendContract = [
  Assert<Equals<keyof Actual, keyof Expected>>,
  Assert<Equals<keyof SynapseAPI, keyof Expected>>,
  Assert<Equals<Window['synapse'], SynapseAPI>>,
  Assert<Equals<{ [K in keyof Expected]: Equals<Actual[K], Expected[K]> }[keyof Expected], true>>,
  Assert<Equals<{ [K in keyof Expected]: Equals<SynapseAPI[K], Expected[K]> }[keyof Expected], true>>,
  Assert<Equals<keyof typeof phase0Handlers, keyof Phase0Requests>>,
  Assert<Equals<{ [K in keyof Phase0Requests]: Equals<Parameters<typeof phase0Handlers[K]>, Parameters<Phase0Requests[K]>> }[keyof Phase0Requests], true>>,
];
