import { DatabaseSync } from 'node:sqlite';
import { WorkspaceError } from './WorkspacePaths.ts';

export const SCHEMA = `
CREATE TABLE project_metadata (
  project_hash TEXT PRIMARY KEY NOT NULL,
  project_name TEXT NOT NULL,
  original_path TEXT NOT NULL,
  git_branch TEXT DEFAULT 'main',
  core_requirements TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
CREATE TABLE chat_sessions (
  session_id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0, 1)),
  messages_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(messages_json) AND json_type(messages_json) = 'array'),
  summary_text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
CREATE TABLE file_locks (
  node_id TEXT PRIMARY KEY NOT NULL, locked_by_agent TEXT NOT NULL,
  lock_mode TEXT NOT NULL CHECK(lock_mode IN ('READING', 'WRITING')), locked_at INTEGER NOT NULL
) STRICT;
CREATE TABLE graph_overrides (
  node_id TEXT PRIMARY KEY NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('DEFAULT', 'FOCUSED', 'EXCLUDED', 'ERROR')),
  error_message TEXT, updated_at INTEGER NOT NULL
) STRICT;
PRAGMA user_version = 1;
`;

/** Short-lived connections: every transaction closes its file handle on failure too. */
export function withDatabase<T>(filename: string, create: boolean, run: (db: DatabaseSync) => T): T {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(filename, { timeout: 5000 });
    db.exec('PRAGMA foreign_keys = ON; PRAGMA temp_store = MEMORY;');
    db.exec('BEGIN IMMEDIATE');
    try {
      const version = db.prepare('PRAGMA user_version').get()!.user_version;
      if (version !== 1 && version !== 2 && !(create && version === 0)) throw new WorkspaceError('UNSUPPORTED_SCHEMA', `Database version ${version}`);
      if (version === 0) db.exec(SCHEMA);
      const result = run(db);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError('DATABASE_ERROR', 'Shadow workspace database operation failed', error);
  } finally { db?.close(); }
}

/** Lazy, transactional Phase 3 migration. Existing locks are never discarded. */
export function ensureLockOwnership(db: DatabaseSync): void {
  if (db.prepare('PRAGMA user_version').get()!.user_version === 1) {
    db.exec('ALTER TABLE file_locks ADD COLUMN owner_token TEXT; PRAGMA user_version = 2;');
  }
}
