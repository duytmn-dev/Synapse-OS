import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { lstatSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { isDeepStrictEqual, promisify } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import type { ChatSessionItem, ChatSessionMutationRequest, ShadowProjectInfo } from '../../shared/types';
import { ContextHydrator, type HydratedContext } from './ContextHydrator.ts';
import { STANDALONE_CHAT_SCHEMA, withDatabase } from './ShadowWorkspaceDB.ts';
import { projectHash, requiredText, validateHash, WorkspaceError, WorkspacePaths } from './WorkspacePaths.ts';

const execute = promisify(execFile);

async function gitBranch(projectPath: string): Promise<string> {
  // Ignore ambient repository overrides: inspect the folder explicitly selected by the user.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  env.LC_ALL = 'C';
  const git = (args: string[]) => execute('git', ['--no-optional-locks', '-C', projectPath, ...args], { env, timeout: 10000, windowsHide: true });
  try { return (await git(['symbolic-ref', '--quiet', '--short', 'HEAD'])).stdout.trim(); }
  catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    if (failure.code === 'ENOENT') throw new WorkspaceError('GIT_UNAVAILABLE', 'Git executable is not installed', error);
    // Empty string explicitly represents a verified non-Git directory, never a fabricated main branch.
    if (failure.stderr?.includes('not a git repository')) return '';
    if (Number(failure.code) === 1) {
      try { return `detached:${(await git(['rev-parse', '--verify', 'HEAD'])).stdout.trim()}`; }
      catch (cause) { throw new WorkspaceError('GIT_STATE_ERROR', 'Cannot read detached HEAD', cause); }
    }
    throw new WorkspaceError('GIT_STATE_ERROR', 'Cannot determine the Git branch', error);
  }
}

export class ShadowWorkspaceManager {
  readonly paths: WorkspacePaths;
  private readonly hydrator: ContextHydrator;
  private readonly contexts = new Map<string, HydratedContext>();

  constructor(userData: string) {
    this.paths = new WorkspacePaths(userData);
    this.hydrator = new ContextHydrator(this.paths);
  }

  private metadata(db: DatabaseSync, hash: string): ShadowProjectInfo {
    const row = db.prepare('SELECT * FROM project_metadata WHERE project_hash = ?').get(hash);
    if (!row || typeof row.original_path !== 'string' || typeof row.project_name !== 'string' || typeof row.git_branch !== 'string' || projectHash(row.original_path) !== hash) {
      throw new WorkspaceError('INVALID_METADATA', 'Project identity is missing or inconsistent');
    }
    this.paths.assertSeparate(row.original_path);
    return { project_hash: hash, project_name: row.project_name, original_path: row.original_path,
      git_branch: row.git_branch, is_shadow_workspace: true, sessions: this.sessions(db, hash) };
  }

  /** Backend-only transaction boundary, including project identity/path validation. */
  access<T>(hash: string, operation: (db: DatabaseSync) => T): T {
    validateHash(hash);
    const filename = this.paths.file(hash, 'project.db');
    try { lstatSync(filename); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new WorkspaceError('PROJECT_NOT_FOUND', 'Open the project before accessing its workspace');
      throw new WorkspaceError('STORAGE_IO_ERROR', 'Cannot inspect project.db', error);
    }
    return withDatabase(filename, false, (db) => { this.metadata(db, hash); return operation(db); });
  }

  getProject(hash: string): ShadowProjectInfo { return this.access(hash, (db) => this.metadata(db, hash)); }

  async openProject(projectPath: string): Promise<ShadowProjectInfo> {
    requiredText(projectPath, 'projectPath');
    const original = path.resolve(projectPath);
    try {
      if (!statSync(original).isDirectory()) throw new WorkspaceError('INVALID_PROJECT_PATH', 'Project must be a directory');
      this.paths.assertSeparate(original);
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError('INVALID_PROJECT_PATH', 'Project directory is unavailable', error);
    }
    const canonical = realpathSync(original);
    const branch = await gitBranch(original);
    // Recheck after asynchronous Git access, before any write.
    if (realpathSync(original) !== canonical) throw new WorkspaceError('PROJECT_PATH_CHANGED', 'Project directory changed while opening');
    this.paths.assertSeparate(original);
    const hash = projectHash(original);
    const filename = this.paths.file(hash, 'project.db', true);
    return withDatabase(filename, true, (db) => {
      const existing = db.prepare('SELECT original_path FROM project_metadata').all();
      if (existing.length && (existing.length !== 1 || existing[0].original_path !== original)) {
        throw new WorkspaceError('PROJECT_HASH_COLLISION', 'Stored path differs from requested project');
      }
      const now = Date.now();
      db.prepare(`INSERT INTO project_metadata (project_hash, project_name, original_path, git_branch, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_hash) DO UPDATE SET git_branch = excluded.git_branch, updated_at = excluded.updated_at`)
        .run(hash, path.basename(original) || original, original, branch, now, now);
      return this.metadata(db, hash);
    });
  }

  listProjects(): ShadowProjectInfo[] {
    // Validate the parent even when no project has been opened in this process.
    this.paths.directory('0000000000000000');
    let entries: string[];
    try { entries = readdirSync(this.paths.projects); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new WorkspaceError('STORAGE_IO_ERROR', 'Cannot enumerate shadow projects', error);
    }
    return entries.filter((entry) => /^[a-f0-9]{16}$/.test(entry)).sort()
      .map((hash) => this.access(hash, (db) => this.metadata(db, hash)));
  }

  private sessions(db: DatabaseSync, hash: string | null): ChatSessionItem[] {
    return db.prepare('SELECT session_id, title, is_pinned, updated_at FROM chat_sessions ORDER BY is_pinned DESC, updated_at DESC, session_id').all().map((row) => {
      if (typeof row.session_id !== 'string' || typeof row.title !== 'string' || typeof row.updated_at !== 'number' || ![0, 1].includes(Number(row.is_pinned))) {
        throw new WorkspaceError('INVALID_SESSION', 'Invalid persisted chat session');
      }
      return { session_id: row.session_id, project_hash: hash, title: row.title, is_pinned: row.is_pinned === 1, updated_at: row.updated_at };
    });
  }

  listSessions(hash: string | null): ChatSessionItem[] {
    if (hash === null && !this.standaloneExists()) return [];
    return this.accessChats(hash, (db) => this.sessions(db, hash));
  }

  private standaloneExists(): boolean {
    try { lstatSync(this.paths.standaloneFile()); return true; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  private accessChats<T>(hash: string | null, run: (db: DatabaseSync) => T, create = false): T {
    if (hash !== null) return this.access(hash, run);
    if (!create && !this.standaloneExists()) throw new WorkspaceError('SESSION_NOT_FOUND', 'No standalone chat exists');
    return withDatabase(this.paths.standaloneFile(create), create, run, STANDALONE_CHAT_SCHEMA);
  }

  mutateSession(request: ChatSessionMutationRequest): ChatSessionItem[] {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new WorkspaceError('INVALID_ARGUMENT', 'A chat mutation object is required');
    const { action, project_hash: hash, session_id: id, new_title: title } = request;
    if (hash !== null) validateHash(hash);
    if (!['CREATE', 'RENAME', 'TOGGLE_PIN', 'DELETE'].includes(action)) throw new WorkspaceError('INVALID_ACTION', 'Unsupported chat action');
    if (action === 'CREATE' || action === 'RENAME') requiredText(title, 'new_title');
    if (action !== 'CREATE') requiredText(id, 'session_id');
    if (action === 'CREATE' && id !== undefined) throw new WorkspaceError('INVALID_ARGUMENT', 'CREATE assigns its own session ID');
    let created: { id: string; context: HydratedContext } | undefined;
    const result = this.accessChats(hash, (db) => {
      const now = Date.now();
      if (action === 'CREATE') {
        const sessionId = randomUUID();
        if (hash !== null) created = { id: sessionId, context: this.hydrator.hydrate(db, hash) };
        db.prepare('INSERT INTO chat_sessions (session_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(sessionId, title!, now, now);
      } else {
        if (!db.prepare('SELECT 1 FROM chat_sessions WHERE session_id = ?').get(id!)) throw new WorkspaceError('SESSION_NOT_FOUND', 'Session does not belong to this chat scope');
        if (action === 'DELETE') db.prepare('DELETE FROM chat_sessions WHERE session_id = ?').run(id!);
        if (action === 'RENAME') db.prepare('UPDATE chat_sessions SET title = ?, updated_at = max(updated_at + 1, ?) WHERE session_id = ?').run(title!, now, id!);
        if (action === 'TOGGLE_PIN') db.prepare('UPDATE chat_sessions SET is_pinned = 1 - is_pinned, updated_at = max(updated_at + 1, ?) WHERE session_id = ?').run(now, id!);
      }
      if (hash !== null) db.prepare('UPDATE project_metadata SET updated_at = max(updated_at + 1, ?) WHERE project_hash = ?').run(now, hash);
      return this.sessions(db, hash);
    }, action === 'CREATE');
    // Only publish RAM context after the SQLite transaction has committed.
    if (created) this.contexts.set(`${hash}:${created.id}`, created.context);
    if (action === 'DELETE') this.contexts.delete(`${hash}:${id}`);
    return result;
  }

  setCoreRequirements(hash: string, requirements: string): void {
    if (typeof requirements !== 'string') throw new WorkspaceError('INVALID_ARGUMENT', 'Requirements must be text');
    this.access(hash, (db) => { db.prepare('UPDATE project_metadata SET core_requirements = ?, updated_at = max(updated_at + 1, ?) WHERE project_hash = ?').run(requirements, Date.now(), hash); });
  }

  saveSessionContent(hash: string, id: string, messages: unknown[], summary: string): void {
    if (typeof summary !== 'string') throw new WorkspaceError('INVALID_ARGUMENT', 'Summary must be text');
    this.writeMessages(hash, id, messages, summary);
  }

  readSessionMessages(hash: string | null, id: string): unknown[] {
    requiredText(id, 'session_id');
    return this.accessChats(hash, (db) => {
      const row = db.prepare('SELECT messages_json FROM chat_sessions WHERE session_id = ?').get(id);
      if (!row) throw new WorkspaceError('SESSION_NOT_FOUND', 'Session does not belong to this chat scope');
      if (typeof row.messages_json !== 'string') throw new WorkspaceError('INVALID_SESSION', 'Invalid stored messages');
      const messages: unknown = JSON.parse(row.messages_json);
      if (!Array.isArray(messages)) throw new WorkspaceError('INVALID_SESSION', 'Invalid stored messages');
      return messages;
    });
  }

  saveSessionMessages(hash: string | null, id: string, messages: unknown[]): ChatSessionItem[] {
    return this.writeMessages(hash, id, messages);
  }

  private writeMessages(hash: string | null, id: string, messages: unknown[], summary?: string): ChatSessionItem[] {
    requiredText(id, 'session_id');
    if (!Array.isArray(messages)) throw new WorkspaceError('INVALID_ARGUMENT', 'Messages must be an array');
    let json: string;
    try {
      json = JSON.stringify(messages);
      if (Buffer.byteLength(json) > 8 * 1024 * 1024) throw new Error('Message history exceeds 8 MiB');
      if (!isDeepStrictEqual(JSON.parse(json), messages)) throw new Error('Message data would be lost during JSON encoding');
    }
    catch (error) { throw new WorkspaceError('INVALID_ARGUMENT', 'Messages must be JSON serializable', error); }
    return this.accessChats(hash, (db) => {
      const result = db.prepare('UPDATE chat_sessions SET messages_json = ?, summary_text = coalesce(?, summary_text), updated_at = max(updated_at + 1, ?) WHERE session_id = ?').run(json, summary ?? null, Date.now(), id);
      if (result.changes !== 1) throw new WorkspaceError('SESSION_NOT_FOUND', 'Session does not belong to this chat scope');
      return this.sessions(db, hash);
    });
  }

  getSessionContext(hash: string, id: string): HydratedContext {
    requiredText(id, 'session_id');
    return this.access(hash, (db) => {
      if (!db.prepare('SELECT 1 FROM chat_sessions WHERE session_id = ?').get(id)) throw new WorkspaceError('SESSION_NOT_FOUND', 'Session does not belong to this project');
      const key = `${hash}:${id}`;
      const context = this.contexts.get(key) ?? this.hydrator.hydrate(db, hash, id);
      this.contexts.set(key, context);
      return structuredClone(context);
    });
  }

  dispose(): void { this.contexts.clear(); }
}
