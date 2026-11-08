import os from 'node:os';
import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import { IPC, type ActiveRoomsSnapshot, type AgentRuntimeStatus } from './ipc.ts';
import type { VisualOfficeEvent } from '../shared/types';
import type { WorkspaceStorageInfo } from '../shared/types';

const rooms: Record<string, VisualOfficeEvent['room_id']> = {
  codex: 'CODEX', gemini: 'GEMINI_AGY', gemini_agy: 'GEMINI_AGY',
  chatgpt: 'CHATGPT', claude: 'CLAUDE_EXT', claude_ext: 'CLAUDE_EXT',
};

/** Data is supplied by authenticated backend services; secrets never cross IPC. */
export class AgentStatusBridge {
  private agents = new Map<string, AgentRuntimeStatus>();
  private storage?: WorkspaceStorageInfo;
  constructor(private readonly ipc: Pick<IpcMain, 'handle' | 'removeHandler'>,
    private readonly contents: () => WebContents | null) {
    ipc.handle(IPC.getActiveRooms, (event: IpcMainInvokeEvent) => {
      const target = contents();
      if (!target || target.isDestroyed() || event.sender !== target || event.senderFrame !== target.mainFrame) {
        throw new Error('Untrusted IPC sender');
      }
      return this.snapshot();
    });
  }
  snapshot(): ActiveRoomsSnapshot {
    const agents = [...this.agents.values()].map((agent) => ({ ...agent }));
    const active = new Set<VisualOfficeEvent['room_id']>(['MANAGER']);
    for (const agent of agents) {
      const room = rooms[agent.agent_id.toLowerCase()];
      if (room && agent.connection_status === 'CONNECTED') active.add(room);
    }
    return { active_rooms: [...active], agents,
      memory: { total_bytes: os.totalmem(), free_bytes: os.freemem(), process_rss_bytes: process.memoryUsage().rss },
      storage: this.storage ? { ...this.storage } : undefined };
  }
  updateStorage(storage: WorkspaceStorageInfo): void {
    this.storage = { ...storage };
    this.publish();
  }
  update(agent: AgentRuntimeStatus): void {
    if (!agent.agent_id.trim()) throw new Error('Agent ID required');
    // Explicit projection avoids accidentally sending credentials in extra fields.
    this.agents.set(agent.agent_id, { agent_id: agent.agent_id, connection_status: agent.connection_status,
      keychain_configured: agent.keychain_configured, worker_model_name: agent.worker_model_name });
    this.publish();
  }
  modelFor(room: VisualOfficeEvent['room_id']): string | null {
    return [...this.agents.values()].find((agent) => rooms[agent.agent_id.toLowerCase()] === room &&
      agent.connection_status === 'CONNECTED')?.worker_model_name ?? null;
  }
  publish(): void {
    const target = this.contents();
    if (target && !target.isDestroyed()) target.send(IPC.activeRoomsUpdated, this.snapshot());
  }
  dispose(): void { this.ipc.removeHandler(IPC.getActiveRooms); }
}
