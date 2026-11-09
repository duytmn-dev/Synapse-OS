import type { WebContents } from 'electron';
import type { ShadowWorkspaceManager } from '../core/workspace/ShadowWorkspaceManager.ts';
import { IPC, type SynapseRequests } from './ipc.ts';

export function createWorkspaceHandlers(manager: ShadowWorkspaceManager, getContents: () => WebContents | null) {
  function publish(channel: string, payload: () => unknown): void {
    // A closed renderer or failed refresh cannot turn a committed mutation into a failed request.
    try {
      const contents = getContents();
      if (contents && !contents.isDestroyed()) contents.send(channel, payload());
    } catch (error) { console.error('Workspace notification failed', error); }
  }
  return {
    openShadowProject: async (projectPath) => {
      const result = await manager.openProject(projectPath);
      publish(IPC.shadowProjectsUpdated, () => manager.listProjects());
      return result;
    },
    getShadowProjects: async () => manager.listProjects(),
    getChatSessions: async (hash) => manager.listSessions(hash),
    mutateChatSession: async (request) => {
      const result = manager.mutateSession(request);
      publish(IPC.chatSessionsUpdated, () => result);
      publish(IPC.shadowProjectsUpdated, () => manager.listProjects());
      return result;
    },
  } satisfies Pick<SynapseRequests, 'openShadowProject' | 'getShadowProjects' | 'getChatSessions' | 'mutateChatSession'>;
}
