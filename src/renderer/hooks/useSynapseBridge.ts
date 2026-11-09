import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  AgentId,
  AgentQuotaStat,
  AgentSettingsProfile,
  AINetworkSettings,
  AppearanceAndGraphSettings,
  AppearanceSettings,
  ChatSessionItem,
  ChatSessionMutationRequest,
  DAGTaskItem,
  GraphActiveEvent,
  GraphData,
  GraphNodeControlCommand,
  ShadowProjectMeta,
  ToolDependencyStatus,
  UpdateStatus,
  VisualOfficeEvent,
  WorkspaceStorageInfo,
} from '@shared/types';

export interface SynapseState {
  quota: AgentQuotaStat[];
  tasks: DAGTaskItem[];
  office: VisualOfficeEvent[];
  activeRooms: VisualOfficeEvent['room_id'][];
  graphData: GraphData | null;
  graphActiveEvent: GraphActiveEvent | null;
  shadowProjects: ShadowProjectMeta[];
  chatSessions: ChatSessionItem[];
  activeProjectHash: string | null;
  networkSettings: AINetworkSettings;
  appearanceSettings: AppearanceSettings;
  toolDependencies: ToolDependencyStatus[];
  workspaceStorage: WorkspaceStorageInfo;
  updateStatus: UpdateStatus;
  /** true = đang nhận dữ liệu thật từ IPC Bridge; false = offline/chưa kết nối IPC. */
  live: boolean;
}

const officeKey = (e: Pick<VisualOfficeEvent, 'room_id' | 'desk_index'>) => `${e.room_id}#${e.desk_index}`;

export function mergeOfficeEvent(list: VisualOfficeEvent[], ev: VisualOfficeEvent): VisualOfficeEvent[] {
  const key = officeKey(ev);
  const idx = list.findIndex((e) => officeKey(e) === key);
  if (idx === -1) return [...list, ev];
  const next = list.slice();
  next[idx] = ev;
  return next;
}

export function getBridge() {
  return typeof window !== 'undefined' && window.synapse ? window.synapse : undefined;
}

const toQuota = (agent: AgentSettingsProfile): AgentQuotaStat => ({
  agent_id: agent.agent_id,
  connection_status: agent.connection_status,
  quota_shared_with: agent.quota_shared_with,
  usage_5h_percent: agent.quota_5h_percent,
  usage_week_percent: agent.quota_week_percent,
});

const INITIAL_NETWORK_SETTINGS: AINetworkSettings = {
  default_chat_agent_id: 'auto',
  agents: [
    {
      agent_id: 'chatgpt',
      display_name: 'ChatGPT',
      role_description: 'Fast-Path triage và xử lý văn bản',
      connection_status: 'DISCONNECTED',
      auth_method: 'OAuth',
      quota_5h_percent: 0,
      quota_week_percent: 0,
      fallback_api: { is_configured: false, use_fallback_on_error: false, is_valid: false },
    },
    {
      agent_id: 'gemini',
      display_name: 'Gemini',
      role_description: 'Đa phương thức và xử lý video/âm thanh',
      connection_status: 'DISCONNECTED',
      auth_method: 'API Key',
      quota_5h_percent: 0,
      quota_week_percent: 0,
      fallback_api: { is_configured: false, use_fallback_on_error: false, is_valid: false },
    },
    {
      agent_id: 'codex',
      display_name: 'Codex',
      role_description: 'Thực thi mã nguồn và DAG pipelines',
      connection_status: 'DISCONNECTED',
      auth_method: 'Chưa đăng nhập ChatGPT',
      quota_5h_percent: null,
      quota_week_percent: null,
      fallback_api: { is_configured: false, use_fallback_on_error: false, is_valid: false },
    },
    {
      agent_id: 'claude',
      display_name: 'Claude',
      role_description: 'Kiểm toán và tái cấu trúc hệ thống',
      connection_status: 'DISCONNECTED',
      auth_method: 'API Key',
      quota_5h_percent: 0,
      quota_week_percent: 0,
      fallback_api: { is_configured: false, use_fallback_on_error: false, is_valid: false },
    },
  ],
};

const INITIAL_APPEARANCE_SETTINGS: AppearanceSettings = {
  startup_behavior: 'RESTORE_SESSION',
  graph_render_fps: 'HIGH_60FPS',
  enable_graph_glow: true,
  enable_path_lights_up: true,
  enable_task_sound: false,
};

const INITIAL_WORKSPACE_STORAGE: WorkspaceStorageInfo = {
  total_used_mb: 0,
  core_app_mb: 0,
  temp_files_mb: 0,
  shadow_workspaces_mb: 0,
};

const INITIAL_UPDATE_STATUS: UpdateStatus = {
  current_version: '0.0.1',
  has_dev_build_ready: false,
};

export function useSynapseBridge() {
  const bridge = getBridge();
  const updatedAgents = useRef(new Set<AgentId>());
  const [state, setState] = useState<SynapseState>({
    quota: [],
    tasks: [],
    office: [],
    activeRooms: [],
    graphData: null,
    graphActiveEvent: null,
    shadowProjects: [],
    chatSessions: [],
    activeProjectHash: null,
    networkSettings: INITIAL_NETWORK_SETTINGS,
    appearanceSettings: INITIAL_APPEARANCE_SETTINGS,
    toolDependencies: [],
    workspaceStorage: INITIAL_WORKSPACE_STORAGE,
    updateStatus: INITIAL_UPDATE_STATUS,
    live: false,
  });

  useEffect(() => {
    if (!bridge) return;
    let disposed = false;

    // Lấy danh sách Shadow Projects và dữ liệu ban đầu
    const initBridge = async () => {
      try {
        let projects: ShadowProjectMeta[] = [];
        if (bridge.getShadowProjects) {
          try {
            projects = await bridge.getShadowProjects();
          } catch (e) {
            console.warn('[synapse] getShadowProjects warning:', e);
          }
        }

        const currentHash = projects[0]?.project_hash ?? null;

        const [tasksSnap, officeSnap, activeRoomsSnap, networkSnap, appearanceSnap, toolsSnap, updatesSnap, storageSnap, sessionsSnap, graphSnap] =
          await Promise.all([
            bridge.getTasks ? bridge.getTasks().catch(() => []) : Promise.resolve([]),
            bridge.getOffice ? bridge.getOffice().catch(() => []) : Promise.resolve([]),
            bridge.getActiveRooms ? bridge.getActiveRooms().catch(() => null) : Promise.resolve(null),
            bridge.getAINetworkSettings ? bridge.getAINetworkSettings().catch(() => null) : Promise.resolve(null),
            bridge.getAppearanceSettings ? bridge.getAppearanceSettings().catch(() => null) : Promise.resolve(null),
            bridge.getToolDependencies ? bridge.getToolDependencies().catch(() => []) : Promise.resolve([]),
            bridge.getUpdateStatus ? bridge.getUpdateStatus().catch(() => null) : Promise.resolve(null),
            bridge.getWorkspaceStorage ? bridge.getWorkspaceStorage().catch(() => null) : Promise.resolve(null),
            currentHash && bridge.getChatSessions ? bridge.getChatSessions(currentHash).catch(() => []) : Promise.resolve([]),
            currentHash && bridge.getGraphData ? bridge.getGraphData(currentHash).catch(() => null) : Promise.resolve(null),
          ]);

        if (!disposed) {
          setState((prev) => ({
            ...prev,
            quota: networkSnap ? [
              ...prev.quota.filter((q) => !networkSnap.agents.some((profile) => profile.agent_id === q.agent_id && !updatedAgents.current.has(profile.agent_id))),
              ...networkSnap.agents.filter((profile) => !updatedAgents.current.has(profile.agent_id)).map(toQuota),
            ] : prev.quota,
            tasks: tasksSnap ?? prev.tasks,
            office: officeSnap ?? prev.office,
            activeRooms: activeRoomsSnap?.active_rooms ?? prev.activeRooms,
            shadowProjects: prev.activeProjectHash ? prev.shadowProjects : projects,
            activeProjectHash: prev.activeProjectHash ?? currentHash,
            chatSessions: prev.activeProjectHash ? prev.chatSessions : sessionsSnap,
            graphData: prev.activeProjectHash ? prev.graphData : graphSnap,
            networkSettings: networkSnap ? {
              ...networkSnap,
              agents: prev.networkSettings.agents.map((agent) =>
                updatedAgents.current.has(agent.agent_id) ? agent :
                  networkSnap.agents.find((profile) => profile.agent_id === agent.agent_id) ?? agent),
            } : prev.networkSettings,
            appearanceSettings: (appearanceSnap as AppearanceSettings) ?? prev.appearanceSettings,
            toolDependencies: toolsSnap && toolsSnap.length > 0 ? toolsSnap : prev.toolDependencies,
            updateStatus: updatesSnap ?? prev.updateStatus,
            workspaceStorage: storageSnap ?? prev.workspaceStorage,
            live: true,
          }));
        }
      } catch (err) {
        console.error('[synapse] Khởi tạo dữ liệu từ IPC thất bại:', err);
      }
    };

    void initBridge();

    const offs: (() => void)[] = [];

    if (bridge.onQuotaUpdated) {
      offs.push(bridge.onQuotaUpdated((quota) => setState((s) => ({ ...s, quota, live: true }))));
    }
    if (bridge.onTasksUpdated) {
      offs.push(bridge.onTasksUpdated((tasks) => setState((s) => ({ ...s, tasks, live: true }))));
    }
    if (bridge.onOfficeUpdated) {
      offs.push(
        bridge.onOfficeUpdated((ev) =>
          setState((s) => ({ ...s, office: mergeOfficeEvent(s.office, ev), live: true }))
        )
      );
    }
    if (bridge.onActiveRoomsUpdated) {
      offs.push(
        bridge.onActiveRoomsUpdated((snapshot) =>
          setState((s) => ({
            ...s,
            activeRooms: snapshot?.active_rooms ?? s.activeRooms,
            live: true,
          }))
        )
      );
    }
    if (bridge.onGraphActiveEvent) {
      offs.push(
        bridge.onGraphActiveEvent((ev) =>
          setState((s) => ({
            ...s,
            graphActiveEvent: ev,
            live: true,
          }))
        )
      );
    }
    if (bridge.onGraphDataUpdated) {
      offs.push(
        bridge.onGraphDataUpdated((graph) =>
          setState((s) => s.activeProjectHash === graph.project_hash ? ({
            ...s,
            graphData: graph,
            live: true,
          }) : s)
        )
      );
    }
    if (bridge.onShadowProjectsUpdated) {
      offs.push(
        bridge.onShadowProjectsUpdated((projects) =>
          setState((s) => ({
            ...s,
            shadowProjects: projects,
            live: true,
          }))
        )
      );
    }
    if (bridge.onChatSessionsUpdated) {
      offs.push(
        bridge.onChatSessionsUpdated((sessions) =>
          setState((s) => ({
            ...s,
            chatSessions: sessions,
            live: true,
          }))
        )
      );
    }

    return () => {
      disposed = true;
      offs.forEach((off) => off());
    };
  }, [bridge]);

  // Chọn dự án hoạt động và nạp sessions & graph tương ứng
  const selectProject = useCallback(
    async (hash: string) => {
      setState((s) => ({ ...s, activeProjectHash: hash }));
      if (bridge?.getChatSessions) {
        try {
          const sessions = await bridge.getChatSessions(hash);
          setState((s) => ({ ...s, chatSessions: sessions }));
        } catch (e) {
          console.warn('[useSynapseBridge] getChatSessions failed:', e);
        }
      }
      if (bridge?.getGraphData) {
        try {
          const graph = await bridge.getGraphData(hash);
          setState((s) => ({ ...s, graphData: graph }));
        } catch (e) {
          console.warn('[useSynapseBridge] getGraphData failed:', e);
        }
      }
    },
    [bridge]
  );

  const pickShadowProject = useCallback(
    async (): Promise<ShadowProjectMeta | null> => {
      if (!bridge?.pickShadowProject) throw new Error('Hãy mở Synapse OS bằng ứng dụng Electron để chọn thư mục.');
      const meta = await bridge.pickShadowProject();
      if (!meta) return null;
      setState((s) => ({
        ...s,
        shadowProjects: [...s.shadowProjects.filter((p) => p.project_hash !== meta.project_hash), meta],
        activeProjectHash: meta.project_hash,
        chatSessions: meta.sessions,
        graphData: s.graphData?.project_hash === meta.project_hash ? s.graphData : null,
        graphActiveEvent: null,
      }));
      void bridge.getGraphData(meta.project_hash).then((graph) => {
        setState((s) => s.activeProjectHash === graph.project_hash ? { ...s, graphData: graph } : s);
      }).catch((error: unknown) => console.warn('[synapse] Không tải được đồ thị dự án:', error));
      return meta;
    },
    [bridge]
  );

  const mutateChatSession = useCallback(
    async (request: ChatSessionMutationRequest): Promise<ChatSessionItem[]> => {
      if (bridge?.mutateChatSession) {
        const updatedSessions = await bridge.mutateChatSession(request);
        setState((s) => ({ ...s, chatSessions: updatedSessions }));
        return updatedSessions;
      }
      // Fallback local state nếu chạy ngoài Electron
      const current = [...state.chatSessions];
      if (request.action === 'CREATE') {
        const newItem: ChatSessionItem = {
          session_id: crypto.randomUUID(),
          project_hash: request.project_hash ?? 'local',
          title: request.new_title ?? 'Cuộc trò chuyện mới',
          is_pinned: false,
          updated_at: Date.now(),
        };
        const next = [newItem, ...current];
        setState((s) => ({ ...s, chatSessions: next }));
        return next;
      }
      if (request.action === 'RENAME' && request.session_id) {
        const next = current.map((c) =>
          c.session_id === request.session_id ? { ...c, title: request.new_title ?? c.title, updated_at: Date.now() } : c
        );
        setState((s) => ({ ...s, chatSessions: next }));
        return next;
      }
      if (request.action === 'TOGGLE_PIN' && request.session_id) {
        const next = current.map((c) =>
          c.session_id === request.session_id ? { ...c, is_pinned: !c.is_pinned, updated_at: Date.now() } : c
        );
        setState((s) => ({ ...s, chatSessions: next }));
        return next;
      }
      if (request.action === 'DELETE' && request.session_id) {
        const next = current.filter((c) => c.session_id !== request.session_id);
        setState((s) => ({ ...s, chatSessions: next }));
        return next;
      }
      return current;
    },
    [bridge, state.chatSessions]
  );

  // Các action IPC thực thi gọi thẳng vào bridge
  const agentConnectionAction = useCallback(
    async (agentId: AgentId, action: 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI' | 'CHECK_API'): Promise<AgentSettingsProfile> => {
      if (!bridge?.agentConnectionAction) throw new Error('Hãy mở Synapse OS bằng ứng dụng Electron để đăng nhập agent.');
      const updated = await bridge.agentConnectionAction(agentId, action);
      const applyProfile = (profile: AgentSettingsProfile) => {
        updatedAgents.current.add(profile.agent_id);
        setState((s) => ({
          ...s,
          quota: [...s.quota.filter((entry) => entry.agent_id !== profile.agent_id), toQuota(profile)],
          networkSettings: {
            ...s.networkSettings,
            agents: s.networkSettings.agents.map((a) => a.agent_id === profile.agent_id ? profile : a),
          },
        }));
      };
      applyProfile(updated);
      if (action !== 'CHECK_API' && (agentId === 'codex' || agentId === 'chatgpt')) {
        const linkedAgent = agentId === 'codex' ? 'chatgpt' : 'codex';
        void bridge.agentConnectionAction(linkedAgent, 'CHECK_CLI').then(applyProfile).catch(() => {});
      }
      return updated;
    },
    [bridge]
  );

  const setFallbackOnError = useCallback(
    async (agentId: AgentId, enabled: boolean): Promise<AgentSettingsProfile> => {
      if (bridge?.setFallbackOnError) {
        const updated = await bridge.setFallbackOnError(agentId, enabled);
        setState((s) => ({
          ...s,
          networkSettings: {
            ...s.networkSettings,
            agents: s.networkSettings.agents.map((a) => (a.agent_id === agentId ? updated : a)),
          },
        }));
        return updated;
      }
      const agent = state.networkSettings.agents.find((a) => a.agent_id === agentId);
      const fallbackProfile: AgentSettingsProfile = {
        ...agent!,
        fallback_api: { ...agent!.fallback_api, use_fallback_on_error: enabled },
      };
      setState((s) => ({
        ...s,
        networkSettings: {
          ...s.networkSettings,
          agents: s.networkSettings.agents.map((a) => (a.agent_id === agentId ? fallbackProfile : a)),
        },
      }));
      return fallbackProfile;
    },
    [bridge, state.networkSettings]
  );

  const setAgentAlertThreshold = useCallback(
    async (agentId: AgentId, percent: number): Promise<AgentSettingsProfile> => {
      if (bridge?.setAgentAlertThreshold) {
        const updated = await bridge.setAgentAlertThreshold(agentId, percent);
        setState((s) => ({
          ...s,
          networkSettings: {
            ...s.networkSettings,
            agents: s.networkSettings.agents.map((a) => (a.agent_id === agentId ? updated : a)),
          },
        }));
        return updated;
      }
      const agent = state.networkSettings.agents.find((a) => a.agent_id === agentId);
      const fallbackProfile: AgentSettingsProfile = {
        ...agent!,
        alert_threshold_percent: percent,
      };
      setState((s) => ({
        ...s,
        networkSettings: {
          ...s.networkSettings,
          agents: s.networkSettings.agents.map((a) => (a.agent_id === agentId ? fallbackProfile : a)),
        },
      }));
      return fallbackProfile;
    },
    [bridge, state.networkSettings]
  );

  const saveAgentKey = useCallback(
    async (agentId: AgentId, key: string): Promise<void> => {
      if (bridge?.saveAgentKey) {
        await bridge.saveAgentKey(agentId, key);
      }
      const masked = `${key.slice(0, 8)}••••••••••••••••${key.slice(-4)}`;
      setState((s) => ({
        ...s,
        networkSettings: {
          ...s.networkSettings,
          agents: s.networkSettings.agents.map((a) =>
            a.agent_id === agentId
              ? {
                  ...a,
                  fallback_api: {
                    ...a.fallback_api,
                    is_configured: true,
                    api_key_masked: masked,
                    is_valid: true,
                  },
                }
              : a
          ),
        },
      }));
    },
    [bridge]
  );

  const setDefaultChatAgent = useCallback(
    async (agentId: string): Promise<AINetworkSettings> => {
      if (bridge?.setDefaultChatAgent) {
        const updated = await bridge.setDefaultChatAgent(agentId);
        setState((s) => ({ ...s, networkSettings: updated }));
        return updated;
      }
      const updated: AINetworkSettings = {
        ...state.networkSettings,
        default_chat_agent_id: agentId,
      };
      setState((s) => ({ ...s, networkSettings: updated }));
      return updated;
    },
    [bridge, state.networkSettings]
  );

  const saveAppearanceSettings = useCallback(
    async (settings: AppearanceAndGraphSettings): Promise<void> => {
      if (bridge?.saveAppearanceSettings) {
        await bridge.saveAppearanceSettings(settings);
      }
      setState((s) => ({
        ...s,
        appearanceSettings: { ...s.appearanceSettings, ...settings },
      }));
    },
    [bridge]
  );

  const ensureToolDependency = useCallback(
    async (toolId: ToolDependencyStatus['tool_id']): Promise<ToolDependencyStatus> => {
      if (bridge?.ensureToolDependency) {
        const updated = await bridge.ensureToolDependency(toolId);
        setState((s) => ({
          ...s,
          toolDependencies: s.toolDependencies.map((t) => (t.tool_id === toolId ? updated : t)),
        }));
        return updated;
      }
      const existing = state.toolDependencies.find((t) => t.tool_id === toolId);
      const updated: ToolDependencyStatus = existing
        ? { ...existing, is_installed: true }
        : { tool_id: toolId, tool_name: toolId, is_installed: true, size_mb: 42 };
      setState((s) => ({
        ...s,
        toolDependencies: s.toolDependencies.map((t) => (t.tool_id === toolId ? updated : t)),
      }));
      return updated;
    },
    [bridge, state.toolDependencies]
  );

  const controlGraphNode = useCallback(
    async (command: GraphNodeControlCommand): Promise<void> => {
      if (bridge?.controlGraphNode) {
        try {
          await bridge.controlGraphNode(command);
        } catch (err) {
          console.warn('[useSynapseBridge] controlGraphNode IPC returned error:', err);
        }
      }
      setState((s) => {
        if (!s.graphData) return s;
        const nodes = s.graphData.nodes.map((n) => {
          if (n.id !== command.node_id) return n;
          if (command.command === 'FOCUS') {
            return { ...n, is_focused: true };
          }
          if (command.command === 'EXCLUDE') {
            return { ...n, visual_state: 'IGNORED' as const, is_focused: false };
          }
          if (command.command === 'RESET') {
            return { ...n, is_focused: false, visual_state: 'DEFAULT' as const };
          }
          return n;
        });
        return {
          ...s,
          graphData: {
            ...s.graphData,
            nodes,
          },
        };
      });
    },
    [bridge]
  );

  return {
    ...state,
    selectProject,
    pickShadowProject,
    mutateChatSession,
    agentConnectionAction,
    setFallbackOnError,
    setAgentAlertThreshold,
    saveAgentKey,
    setDefaultChatAgent,
    saveAppearanceSettings,
    ensureToolDependency,
    controlGraphNode,
  };
}
