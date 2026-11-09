import type { IpcMain, WebContents } from 'electron';
import { REQUEST_CHANNELS, type SynapseRequests } from './ipc.ts';

export type Phase0Requests = Omit<SynapseRequests,
  'getQuota' | 'getTasks' | 'getOffice' | 'getActiveRooms' | 'getWorkspaceStorage' | 'saveAgentKey'>;

function unavailable(operation: keyof Phase0Requests): never {
  // Electron serializes the message, not custom Error fields. Keep the code in it.
  throw new Error(`NOT_IMPLEMENTED: ${operation} requires a backend service from a later phase`);
}

/** Phase 0 defines the wire contract. No fabricated snapshots or successful writes. */
export const phase0Handlers = {
  getGraphData: async (_projectHash) => unavailable('getGraphData'),
  controlGraphNode: async (_command) => unavailable('controlGraphNode'),
  openShadowProject: async (_projectPath) => unavailable('openShadowProject'),
  getShadowProjects: async () => unavailable('getShadowProjects'),
  getChatSessions: async (_projectHash) => unavailable('getChatSessions'),
  mutateChatSession: async (_request) => unavailable('mutateChatSession'),
  getTaskTree: async () => unavailable('getTaskTree'),
  getAINetworkSettings: async () => unavailable('getAINetworkSettings'),
  setDefaultChatAgent: async (_agentId) => unavailable('setDefaultChatAgent'),
  agentConnectionAction: async (_agentId, _action) => unavailable('agentConnectionAction'),
  setFallbackOnError: async (_agentId, _enabled) => unavailable('setFallbackOnError'),
  setAgentAlertThreshold: async (_agentId, _percent) => unavailable('setAgentAlertThreshold'),
  getAppearanceSettings: async () => unavailable('getAppearanceSettings'),
  saveAppearanceSettings: async (_settings) => unavailable('saveAppearanceSettings'),
  getToolDependencies: async () => unavailable('getToolDependencies'),
  ensureToolDependency: async (_toolId) => unavailable('ensureToolDependency'),
  getUpdateStatus: async () => unavailable('getUpdateStatus'),
} satisfies Phase0Requests;

export function registerPhase0Handlers(ipc: Pick<IpcMain, 'handle' | 'removeHandler'>,
  getContents: () => WebContents | null): () => void {
  const registered: string[] = [];
  const dispose = () => { registered.splice(0).forEach((channel) => ipc.removeHandler(channel)); };
  try {
    for (const operation of Object.keys(phase0Handlers) as (keyof Phase0Requests)[]) {
      const channel = REQUEST_CHANNELS[operation];
      ipc.handle(channel, (event, ...args: unknown[]) => {
        const contents = getContents();
        if (!contents || contents.isDestroyed() || event.sender !== contents || event.senderFrame !== contents.mainFrame) {
          throw new Error('UNTRUSTED_SENDER: Untrusted IPC sender');
        }
        // These skeletons always reject, before interpreting input or performing I/O.
        // Replace with validated service adapters when each later phase is implemented.
        return (phase0Handlers[operation] as (...values: unknown[]) => Promise<never>)(...args);
      });
      registered.push(channel);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
