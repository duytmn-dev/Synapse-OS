import path from 'node:path';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { ToolDependencyStatus, UpdateStatus } from '../shared/types';
import { LocalMediaTools } from '../media/LocalMediaTools.ts';
import { runCLI, type AgentCLIConfig } from '../adapters/CLIAdapter.ts';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';
import { sizeOf } from './WorkspaceStorage.ts';

type ToolId = ToolDependencyStatus['tool_id'];
interface ToolConfig { check: AgentCLIConfig; install?: AgentCLIConfig; directory: string }
export class SystemSettingsService {
  private readonly media: LocalMediaTools;
  constructor(private readonly userData: string, private readonly version: string) {
    this.media = new LocalMediaTools({ dataDirectory: userData });
  }
  private async config(): Promise<Partial<Record<Exclude<ToolId, 'ffmpeg'>, ToolConfig>>> {
    try {
      const value = JSON.parse(await readFile(path.join(this.userData, 'tool-providers.json'), 'utf8')) as Partial<Record<Exclude<ToolId, 'ffmpeg'>, ToolConfig>>;
      if (!value || typeof value !== 'object') throw new Error('Invalid tools');
      for (const [id, config] of Object.entries(value)) {
        if (!['graphify', 'python_scripts'].includes(id) || !config || !path.isAbsolute(config.directory)) throw new Error('Invalid tools');
        for (const command of [config.check, ...(config.install ? [config.install] : [])]) {
          if (!command || !path.isAbsolute(command.executable) || /\.(cmd|bat)$/i.test(command.executable) ||
            (command.args !== undefined && (!Array.isArray(command.args) || !command.args.every((arg) => typeof arg === 'string')))) throw new Error('Invalid tool command');
        }
        // Installers are trusted backend commands, but their destination stays in userData.
        const relative = path.relative(this.userData, config.directory);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Tool directory must be inside userData');
      }
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw new WorkspaceError('TOOL_CONFIG_INVALID', 'Cannot read tool-providers.json');
    }
  }
  async tools(): Promise<ToolDependencyStatus[]> {
    const config = await this.config();
    const entries: ToolDependencyStatus[] = [];
    for (const id of ['graphify', 'ffmpeg', 'python_scripts'] as const) {
      if (id === 'ffmpeg') {
        entries.push({ tool_id: id, tool_name: 'FFmpeg', is_installed: await this.media.isInstalled(), size_mb: await sizeOf(this.media.directory) / 1048576 });
      } else {
        const tool = config[id];
        let installed = false;
        if (tool) {
          try { await runCLI({ ...tool.check, cwd: this.userData, timeoutMs: 15000 }); installed = true; }
          catch { throw new WorkspaceError('TOOL_CHECK_FAILED', `Configured ${id} check failed`); }
        }
        entries.push({ tool_id: id, tool_name: id === 'graphify' ? 'Graphify' : 'Python Scripts', is_installed: installed,
          size_mb: tool ? await sizeOf(tool.directory) / 1048576 : 0 });
      }
    }
    return entries;
  }
  async ensureTool(id: ToolId): Promise<ToolDependencyStatus> {
    if (id === 'ffmpeg') await this.media.ensureToolDependencies();
    else if (id === 'graphify' || id === 'python_scripts') {
      const tool = (await this.config())[id];
      if (!tool?.install) throw new WorkspaceError('TOOL_INSTALL_NOT_CONFIGURED', `Configure an installer for ${id}`);
      try { await runCLI({ ...tool.install, cwd: this.userData }); }
      catch { throw new WorkspaceError('TOOL_INSTALL_FAILED', `Installer failed for ${id}`); }
    } else throw new WorkspaceError('INVALID_TOOL', 'Unknown tool');
    const result = (await this.tools()).find((tool) => tool.tool_id === id)!;
    if (!result.is_installed) throw new WorkspaceError('TOOL_INSTALL_FAILED', 'Installed tool failed verification');
    return result;
  }
  async updates(): Promise<UpdateStatus> {
    let manifest: { version: string; filename: string; sha256: string };
    const directory = path.join(this.userData, 'updates');
    try { manifest = JSON.parse(await readFile(path.join(directory, 'ready.json'), 'utf8')) as typeof manifest; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { current_version: this.version, has_dev_build_ready: false };
      throw new WorkspaceError('UPDATE_MANIFEST_INVALID', 'Cannot read staged update');
    }
    if (!manifest || typeof manifest.version !== 'string' || !manifest.version.trim() || typeof manifest.filename !== 'string' ||
      path.basename(manifest.filename) !== manifest.filename || /[:\\/]/.test(manifest.filename) || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) throw new WorkspaceError('UPDATE_MANIFEST_INVALID', 'Invalid staged update metadata');
    try {
      const filename = path.join(directory, manifest.filename);
      const info = await lstat(filename);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('Invalid artifact');
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(filename)) hash.update(chunk);
      if (hash.digest('hex') !== manifest.sha256.toLowerCase()) throw new Error('Checksum mismatch');
    } catch { throw new WorkspaceError('UPDATE_ARTIFACT_INVALID', 'Staged update is missing or corrupt'); }
    return { current_version: this.version, has_dev_build_ready: true, dev_build_version: manifest.version };
  }
}
