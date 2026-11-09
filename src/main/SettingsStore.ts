import path from 'node:path';
import { readFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { AgentId, AppearanceAndGraphSettings } from '../shared/types';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';

interface StoredSettings {
  defaultAgent?: AgentId;
  chatgptLinked?: boolean;
  appearance?: AppearanceAndGraphSettings;
  agents: Partial<Record<AgentId, { fallback?: boolean; threshold?: number }>>;
}
export function validateAppearance(value: unknown): asserts value is AppearanceAndGraphSettings {
  const v = value as AppearanceAndGraphSettings | null;
  if (!v || !['RESTORE_SESSION', 'NEW_SESSION'].includes(v.startup_behavior) || !['HIGH_60FPS', 'POWER_SAVE_30FPS'].includes(v.graph_render_fps) ||
    ![v.enable_graph_glow, v.enable_path_lights_up, v.enable_task_sound].every((x) => typeof x === 'boolean')) throw new WorkspaceError('INVALID_SETTINGS', 'Invalid graph appearance settings');
}
export class SettingsStore {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly userData: string) {}
  async isChatGPTLinked(): Promise<boolean> { return (await this.read()).chatgptLinked !== false; }
  setChatGPTLinked(linked: boolean): Promise<void> {
    return this.update((settings) => { settings.chatgptLinked = linked; });
  }
  async read(): Promise<StoredSettings> {
    try {
      const parsed = JSON.parse(await readFile(path.join(this.userData, 'settings.json'), 'utf8')) as StoredSettings;
      if (!parsed || typeof parsed.agents !== 'object' || !parsed.agents) throw new Error('Invalid settings');
      if (parsed.chatgptLinked !== undefined && typeof parsed.chatgptLinked !== 'boolean') throw new Error('Invalid account link');
      if (parsed.appearance) validateAppearance(parsed.appearance);
      for (const [id, value] of Object.entries(parsed.agents)) {
        if (!['codex', 'gemini', 'claude', 'chatgpt'].includes(id) || !value ||
          (value.fallback !== undefined && typeof value.fallback !== 'boolean') ||
          (value.threshold !== undefined && (!Number.isFinite(value.threshold) || value.threshold < 0 || value.threshold > 100))) throw new Error('Invalid settings');
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { agents: {} };
      throw new WorkspaceError('SETTINGS_READ_FAILED', 'Cannot read settings');
    }
  }
  update(change: (settings: StoredSettings) => void): Promise<void> {
    const work = this.tail.catch(() => {}).then(async () => {
      const data = await this.read(); change(data);
      await mkdir(this.userData, { recursive: true });
      const temporary = path.join(this.userData, `${randomUUID()}.settings.tmp`);
      try {
        await writeFile(temporary, JSON.stringify(data), { flag: 'wx', mode: 0o600 });
        await rename(temporary, path.join(this.userData, 'settings.json'));
      } finally { await rm(temporary, { force: true }); }
    });
    this.tail = work;
    return work;
  }
}
