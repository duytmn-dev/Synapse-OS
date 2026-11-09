import path from 'node:path';
import { lstatSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { AgentId } from '../../shared/types';
import type { ShadowWorkspaceManager } from '../workspace/ShadowWorkspaceManager.ts';
import { ensureLockOwnership } from '../workspace/ShadowWorkspaceDB.ts';
import { requiredText, WorkspaceError } from '../workspace/WorkspacePaths.ts';

export function validateAgent(value: unknown): asserts value is AgentId {
  if (!['codex', 'gemini', 'chatgpt', 'claude'].includes(value as string)) throw new WorkspaceError('INVALID_AGENT', 'Unknown agent');
}
export type LockMode = 'READING' | 'WRITING';
export interface FileLease { node_id: string; release(): void }

/** The specified node_id primary key permits one owner. Reads are deliberately
 * serialized too; a writer can never overlap any reader. All processes use SQLite.
 * No lease expiration: a timed-out task may still write until its process exits. */
export class FileLockManager {
  constructor(private readonly workspace: ShadowWorkspaceManager, readonly projectHash: string) {}

  canonicalNode(nodeId: string): string {
    requiredText(nodeId, 'node_id');
    const normalized = nodeId.replaceAll('\\', '/');
    if (path.isAbsolute(nodeId) || path.win32.isAbsolute(nodeId) || normalized.split('/').includes('..') || normalized.includes(':')) {
      throw new WorkspaceError('INVALID_NODE_PATH', 'node_id must stay within the project');
    }
    const original = this.workspace.getProject(this.projectHash).original_path;
    const root = realpathSync(original);
    if (path.resolve(original) !== root) throw new WorkspaceError('PROJECT_ALIAS_UNSUPPORTED', 'Open the canonical project path before locking files');
    const absolute = path.resolve(root, normalized);
    const resolveExisting = (target: string): string => {
      try {
        const info = lstatSync(target);
        if (info.isSymbolicLink() || (info.isFile() && info.nlink !== 1)) throw new WorkspaceError('UNSAFE_NODE_PATH', 'Linked files cannot be locked by path');
        return realpathSync(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return path.join(resolveExisting(path.dirname(target)), path.basename(target));
      }
    };
    const actual = resolveExisting(absolute);
    let relative = path.relative(root, actual).replaceAll('\\', '/');
    if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) throw new WorkspaceError('INVALID_NODE_PATH', 'File is outside the project');
    if (process.platform === 'win32') relative = relative.toLowerCase();
    return relative;
  }

  async acquireLock(nodeId: string, agent: AgentId, mode: LockMode,
    options: { signal?: AbortSignal; waitMs?: number } = {}): Promise<FileLease> {
    validateAgent(agent);
    if (mode !== 'READING' && mode !== 'WRITING') throw new WorkspaceError('INVALID_LOCK_MODE', 'Expected READING or WRITING');
    const waitMs = options.waitMs ?? 30000;
    if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > 2147483647) throw new WorkspaceError('INVALID_TIMEOUT', 'Invalid lock wait');
    const key = this.canonicalNode(nodeId);
    const token = randomUUID();
    const deadline = performance.now() + waitMs;
    while (true) {
      options.signal?.throwIfAborted();
      const acquired = this.workspace.access(this.projectHash, (db) => {
        ensureLockOwnership(db);
        return db.prepare('INSERT OR IGNORE INTO file_locks (node_id, locked_by_agent, lock_mode, locked_at, owner_token) VALUES (?, ?, ?, ?, ?)')
          .run(key, agent, mode, Date.now(), token).changes === 1;
      });
      if (acquired) {
        let released = false;
        return { node_id: key, release: () => {
          if (released) return;
          this.workspace.access(this.projectHash, (db) => {
            db.prepare('DELETE FROM file_locks WHERE node_id = ? AND owner_token = ?').run(key, token);
          });
          released = true;
        } };
      }
      if (performance.now() >= deadline) throw new WorkspaceError(waitMs === 0 ? 'LOCK_CONFLICT' : 'LOCK_TIMEOUT', `File is already locked: ${key}`);
      await sleep(Math.min(40, Math.max(1, deadline - performance.now())), undefined, { signal: options.signal });
    }
  }
}
