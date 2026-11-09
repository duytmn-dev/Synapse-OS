import type { WebContents } from 'electron';
import type { KnowledgeGraphService } from '../adapters/graphify/KnowledgeGraphService.ts';
import { IPC, type SynapseRequests } from './ipc.ts';

export function createGraphHandlers(service: KnowledgeGraphService, getContents: () => WebContents | null) {
  function publish(channel: string, payload: unknown): void {
    try {
      const contents = getContents();
      if (contents && !contents.isDestroyed()) {
        contents.send(channel, payload);
      }
    } catch (error) {
      console.error('Graph notification failed', error);
    }
  }

  // Subscribe to service updates and broadcast to renderer
  service.subscribe((snapshot) => {
    publish(IPC.graphDataUpdated, snapshot);
  });

  return {
    getGraphData: async (projectHash) => {
      return service.getGraphData(projectHash);
    },
    controlGraphNode: async (command) => {
      await service.controlGraphNode(command);
    },
  } satisfies Pick<SynapseRequests, 'getGraphData' | 'controlGraphNode'>;
}
