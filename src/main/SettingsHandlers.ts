import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import { IPC, type SynapseRequests } from './ipc.ts';
import type { SettingsService } from './SettingsService.ts';
import type { SystemSettingsService } from './SystemSettingsService.ts';

export function createSettingsHandlers(settings: SettingsService, system: SystemSettingsService) {
  return {
    getAINetworkSettings: () => settings.network(),
    setDefaultChatAgent: (agent) => settings.setDefault(agent),
    agentConnectionAction: (agent, action) => settings.action(agent, action),
    setFallbackOnError: (agent, enabled) => settings.fallback(agent, enabled),
    setAgentAlertThreshold: (agent, percent) => settings.threshold(agent, percent),
    getAppearanceSettings: () => settings.appearance(),
    saveAppearanceSettings: (value) => settings.saveAppearance(value),
    getToolDependencies: () => system.tools(),
    ensureToolDependency: (id) => system.ensureTool(id),
    getUpdateStatus: () => system.updates(),
  } satisfies Pick<SynapseRequests, 'getAINetworkSettings' | 'setDefaultChatAgent' | 'agentConnectionAction' |
    'setFallbackOnError' | 'setAgentAlertThreshold' | 'getAppearanceSettings' | 'saveAppearanceSettings' |
    'getToolDependencies' | 'ensureToolDependency' | 'getUpdateStatus'>;
}

export function registerSettingsCredentials(ipc: Pick<IpcMain, 'handle' | 'removeHandler'>,
  contents: () => WebContents | null, settings: SettingsService): () => void {
  const authorize = (event: IpcMainInvokeEvent) => {
    const target = contents();
    if (!target || target.isDestroyed() || event.sender !== target || event.senderFrame !== target.mainFrame) throw new Error('UNTRUSTED_SENDER: Untrusted IPC sender');
  };
  ipc.handle(IPC.saveKey, async (event, agent: unknown, key: unknown) => {
    authorize(event);
    if (typeof key !== 'string') throw new Error('INVALID_API_KEY: Key must be text');
    await settings.saveKey(agent as Parameters<SettingsService['saveKey']>[0], key);
  });
  try {
    ipc.handle(IPC.getQuota, async (event) => {
      authorize(event);
      return (await settings.network()).agents.flatMap((agent) => agent.quota_5h_percent === null || agent.quota_week_percent === null
        ? [] : [{ agent_id: agent.agent_id, usage_5h_percent: agent.quota_5h_percent, usage_week_percent: agent.quota_week_percent }]);
    });
  } catch (error) { ipc.removeHandler(IPC.saveKey); throw error; }
  return () => { ipc.removeHandler(IPC.saveKey); ipc.removeHandler(IPC.getQuota); };
}
