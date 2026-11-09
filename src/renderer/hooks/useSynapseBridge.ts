import { useEffect, useState, useCallback } from 'react';
import type {
  AgentId,
  AgentQuotaStat,
  AgentSettingsProfile,
  AINetworkSettings,
  AppearanceAndGraphSettings,
  AppearanceSettings,
  DAGTaskItem,
  GraphActiveEvent,
  GraphData,
  ToolDependencyStatus,
  UpdateStatus,
  VisualOfficeEvent,
  WorkspaceStorageInfo,
} from '@shared/types';
import {
  DEMO_ACTIVE_ROOMS,
  DEMO_AI_NETWORK_SETTINGS,
  DEMO_APPEARANCE_SETTINGS,
  DEMO_OFFICE,
  DEMO_QUOTA,
  DEMO_TASKS,
  DEMO_TOOL_DEPENDENCIES,
  DEMO_UPDATE_STATUS,
  DEMO_WORKSPACE_STORAGE,
} from '@renderer/mock/demoData';

export interface SynapseState {
  quota: AgentQuotaStat[];
  tasks: DAGTaskItem[];
  office: VisualOfficeEvent[];
  activeRooms: VisualOfficeEvent['room_id'][];
  graphData: GraphData | null;
  graphActiveEvent: GraphActiveEvent | null;
  networkSettings: AINetworkSettings;
  appearanceSettings: AppearanceSettings;
  toolDependencies: ToolDependencyStatus[];
  workspaceStorage: WorkspaceStorageInfo;
  updateStatus: UpdateStatus;
  /** true = đang nhận dữ liệu thật từ IPC Bridge; false = dữ liệu minh hoạ. */
  live: boolean;
}

const officeKey = (e: Pick<VisualOfficeEvent, 'room_id' | 'desk_index'>) => `${e.room_id}#${e.desk_index}`;

/** Gộp 1 sự kiện VisualOfficeEvent vào danh sách hiện tại (theo room_id + desk_index). */
export function mergeOfficeEvent(list: VisualOfficeEvent[], ev: VisualOfficeEvent): VisualOfficeEvent[] {
  const key = officeKey(ev);
  const idx = list.findIndex((e) => officeKey(e) === key);
  if (idx === -1) return [...list, ev];
  const next = list.slice();
  next[idx] = ev;
  return next;
}

export function getBridge() {
  // window.synapse chỉ tồn tại khi chạy trong Electron (preload contextBridge).
  return typeof window !== 'undefined' && window.synapse ? window.synapse : undefined;
}

export function useSynapseBridge() {
  const bridge = getBridge();
  const [state, setState] = useState<SynapseState>({
    quota: DEMO_QUOTA,
    tasks: DEMO_TASKS,
    office: DEMO_OFFICE,
    activeRooms: DEMO_ACTIVE_ROOMS,
    graphData: null,
    graphActiveEvent: null,
    networkSettings: DEMO_AI_NETWORK_SETTINGS,
    appearanceSettings: DEMO_APPEARANCE_SETTINGS,
    toolDependencies: DEMO_TOOL_DEPENDENCIES,
    workspaceStorage: DEMO_WORKSPACE_STORAGE,
    updateStatus: DEMO_UPDATE_STATUS,
    live: false,
  });

  useEffect(() => {
    if (!bridge) return;
    let disposed = false;

    // Lấy dữ liệu ban đầu từ IPC
    Promise.all([
      bridge.getQuota().catch(() => DEMO_QUOTA),
      bridge.getTasks().catch(() => DEMO_TASKS),
      bridge.getOffice().catch(() => DEMO_OFFICE),
      bridge.getActiveRooms ? bridge.getActiveRooms().catch(() => null) : Promise.resolve(null),
      bridge.getAINetworkSettings ? bridge.getAINetworkSettings().catch(() => DEMO_AI_NETWORK_SETTINGS) : Promise.resolve(DEMO_AI_NETWORK_SETTINGS),
      bridge.getAppearanceSettings ? bridge.getAppearanceSettings().catch(() => DEMO_APPEARANCE_SETTINGS) : Promise.resolve(DEMO_APPEARANCE_SETTINGS),
      bridge.getToolDependencies ? bridge.getToolDependencies().catch(() => DEMO_TOOL_DEPENDENCIES) : Promise.resolve(DEMO_TOOL_DEPENDENCIES),
      bridge.getUpdateStatus ? bridge.getUpdateStatus().catch(() => DEMO_UPDATE_STATUS) : Promise.resolve(DEMO_UPDATE_STATUS),
      bridge.getWorkspaceStorage ? bridge.getWorkspaceStorage().catch(() => DEMO_WORKSPACE_STORAGE) : Promise.resolve(DEMO_WORKSPACE_STORAGE),
      bridge.getGraphData ? bridge.getGraphData('default').catch(() => null) : Promise.resolve(null),
    ])
      .then(([quota, tasks, office, activeRoomsSnap, network, appearance, tools, updates, storage, graph]) => {
        if (!disposed) {
          setState((prev) => ({
            ...prev,
            quota: quota && quota.length > 0 ? quota : prev.quota,
            tasks: tasks && tasks.length > 0 ? tasks : prev.tasks,
            office: office && office.length > 0 ? office : prev.office,
            activeRooms:
              activeRoomsSnap && activeRoomsSnap.active_rooms && activeRoomsSnap.active_rooms.length > 0
                ? activeRoomsSnap.active_rooms
                : prev.activeRooms,
            networkSettings: network ?? prev.networkSettings,
            appearanceSettings: (appearance as AppearanceSettings) ?? prev.appearanceSettings,
            toolDependencies: tools ?? prev.toolDependencies,
            updateStatus: updates ?? prev.updateStatus,
            workspaceStorage: storage ?? prev.workspaceStorage,
            graphData: graph ?? prev.graphData,
            live: true,
          }));
        }
      })
      .catch((err) => console.error('[synapse] Không lấy được dữ liệu ban đầu từ IPC:', err));

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
    // Lắng nghe sự kiện GraphActiveEvent thời gian thực (Path lights up)
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
          setState((s) => ({
            ...s,
            graphData: graph,
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

  // Các action IPC thực thi gọi thẳng vào bridge
  const agentConnectionAction = useCallback(
    async (agentId: AgentId, action: 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI' | 'CHECK_API'): Promise<AgentSettingsProfile> => {
      if (bridge?.agentConnectionAction) {
        const updated = await bridge.agentConnectionAction(agentId, action);
        setState((s) => ({
          ...s,
          networkSettings: {
            ...s.networkSettings,
            agents: s.networkSettings.agents.map((a) => (a.agent_id === agentId ? updated : a)),
          },
        }));
        return updated;
      }
      // Fallback cho môi trường web
      const agent = state.networkSettings.agents.find((a) => a.agent_id === agentId);
      const nextStatus = action === 'DISCONNECT' ? 'DISCONNECTED' : 'CONNECTED';
      const fallbackProfile: AgentSettingsProfile = agent
        ? { ...agent, connection_status: nextStatus as any }
        : {
            agent_id: agentId,
            display_name: agentId,
            role_description: '',
            connection_status: nextStatus as any,
            auth_method: 'OAuth',
            quota_5h_percent: 50,
            quota_week_percent: 30,
            fallback_api: { is_configured: false, use_fallback_on_error: false, is_valid: false },
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

  return {
    ...state,
    agentConnectionAction,
    setFallbackOnError,
    setAgentAlertThreshold,
    saveAgentKey,
    setDefaultChatAgent,
    saveAppearanceSettings,
    ensureToolDependency,
  };
}
