import path from 'node:path';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, realpathSync } from 'node:fs';

export class WorkspaceError extends Error {
  constructor(public readonly code: string, message: string, cause?: unknown) {
    super(`${code}: ${message}`, { cause });
  }
}

export function requiredText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
    throw new WorkspaceError('INVALID_ARGUMENT', `${field} must be a nonempty string without NUL`);
  }
}

export function projectHash(projectPath: string): string {
  requiredText(projectPath, 'projectPath');
  return createHash('sha256').update(path.resolve(projectPath)).digest('hex').slice(0, 16);
}

export function validateHash(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{16}$/.test(value)) {
    throw new WorkspaceError('INVALID_PROJECT_HASH', 'An explicit 16-character project hash is required');
  }
}

function contains(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** Resolve existing ancestors before creating anything, including Windows junctions. */
function prospectiveRealPath(target: string): string {
  try { return realpathSync(target); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = path.dirname(target);
    if (parent === target) throw error;
    // A dangling link must not be treated as a missing ordinary directory.
    try { if (lstatSync(target).isSymbolicLink()) throw new WorkspaceError('UNSAFE_STORAGE_PATH', 'Dangling storage link'); }
    catch (entryError) { if ((entryError as NodeJS.ErrnoException).code !== 'ENOENT') throw entryError; }
    return path.join(prospectiveRealPath(parent), path.basename(target));
  }
}

export class WorkspacePaths {
  readonly userData: string;
  readonly projects: string;
  constructor(userData: string) {
    requiredText(userData, 'userData');
    if (!path.isAbsolute(userData)) throw new WorkspaceError('INVALID_STORAGE_ROOT', 'userData must be absolute');
    this.userData = prospectiveRealPath(path.resolve(userData));
    this.projects = path.join(this.userData, 'projects');
  }

  assertSeparate(projectPath: string): void {
    const project = prospectiveRealPath(path.resolve(projectPath));
    const data = prospectiveRealPath(this.userData);
    if (data !== this.userData || contains(project, data) || contains(data, project)) {
      throw new WorkspaceError('PROJECT_STORAGE_OVERLAP', 'Project and userData must be disjoint directories');
    }
  }

  private ensureDirectories(targets: string[], create: boolean): string {
    // No redirected component anywhere under userData is allowed.
    for (const target of targets) {
      if (prospectiveRealPath(target) !== target) throw new WorkspaceError('UNSAFE_STORAGE_PATH', 'Storage directory was redirected');
      try {
        const info = lstatSync(target);
        if (info.isSymbolicLink() || !info.isDirectory()) throw new WorkspaceError('UNSAFE_STORAGE_PATH', 'Storage must be an ordinary directory');
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const directory = targets[targets.length - 1];
    if (create) mkdirSync(directory, { recursive: true });
    return directory;
  }

  directory(hash: string, create = false): string {
    validateHash(hash);
    return this.ensureDirectories([this.userData, this.projects, path.join(this.projects, hash)], create);
  }

  standaloneFile(create = false): string {
    const directory = this.ensureDirectories([this.userData, path.join(this.userData, 'chats')], create);
    return this.safeFile(directory, 'standalone.db', true);
  }

  file(hash: string, name: 'project.db' | 'graph.json', create = false): string {
    return this.safeFile(this.directory(hash, create), name, name === 'project.db');
  }

  private safeFile(directory: string, name: string, sqlite: boolean): string {
    // SQLite sidecars must obey the same rule as the database itself.
    for (const entry of sqlite ? [name, `${name}-journal`, `${name}-wal`, `${name}-shm`] : [name]) {
      try {
        const info = lstatSync(path.join(directory, entry));
        if (info.isSymbolicLink() || !info.isFile() || info.nlink !== 1) {
          throw new WorkspaceError('UNSAFE_STORAGE_PATH', 'Storage files must not be links or special files');
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    return path.join(directory, name);
  }
}
