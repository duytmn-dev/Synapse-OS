import type { AgentId, GraphActiveEvent } from '../shared/types';
import { FileLockManager, type LockMode, validateAgent } from './concurrency/FileLockManager.ts';
import type { ShadowWorkspaceManager } from './workspace/ShadowWorkspaceManager.ts';
import { requiredText, WorkspaceError } from './workspace/WorkspacePaths.ts';

export interface GraphOperation {
  project_hash: string;
  agent_id: AgentId;
  worker_model_name: string;
  target_node_id: string;
  /** Canonical file path to lock; a FUNCTION node can still name a distinct target. */
  file_path: string;
  source_node_id?: string;
  task_code?: string;
  mode: LockMode;
}
export class GraphActivity {
  private readonly listeners = new Set<(event: GraphActiveEvent) => void>();
  constructor(private readonly workspace: ShadowWorkspaceManager) {}
  subscribe(listener: (event: GraphActiveEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private emit(operation: GraphOperation, action: GraphActiveEvent['action']): void {
    const event: GraphActiveEvent = { project_hash: operation.project_hash, agent_id: operation.agent_id,
      worker_model_name: operation.worker_model_name, target_node_id: operation.target_node_id,
      source_node_id: operation.source_node_id, task_code: operation.task_code, action, timestamp: Date.now() };
    for (const listener of this.listeners) { try { listener({ ...event }); } catch { /* UI cannot break file protection. */ } }
  }
  async run<T>(operation: GraphOperation, work: () => Promise<T> | T, signal?: AbortSignal): Promise<T> {
    operation = { ...operation };
    validateAgent(operation.agent_id);
    requiredText(operation.worker_model_name, 'worker_model_name');
    requiredText(operation.target_node_id, 'target_node_id');
    if (operation.source_node_id !== undefined) requiredText(operation.source_node_id, 'source_node_id');
    if (operation.mode !== 'READING' && operation.mode !== 'WRITING') throw new WorkspaceError('INVALID_LOCK_MODE', 'Invalid operation');
    const locks = new FileLockManager(this.workspace, operation.project_hash);
    const lease = await locks.acquireLock(operation.file_path, operation.agent_id, operation.mode, { signal });
    try {
      signal?.throwIfAborted();
      if (operation.source_node_id) this.emit(operation, 'FLOW_TRANSITION');
      this.emit(operation, operation.mode);
      const result = await work();
      signal?.throwIfAborted();
      return result;
    } catch (error) { this.emit(operation, 'ERROR'); throw error; }
    finally {
      // Do not release on AbortSignal alone. Work/process termination must finish first.
      lease.release();
      this.emit(operation, 'IDLE');
    }
  }
}
