import { createHash } from 'node:crypto';
import type { AgentId, AgentSettingsProfile, AINetworkSettings, AppearanceAndGraphSettings } from '../shared/types';
import type { SecretStore } from './SecretStore.ts';
import { SettingsStore, validateAppearance } from './SettingsStore.ts';
import { ProviderRegistry, type ProviderStatus } from '../adapters/ProviderRegistry.ts';
import { checkProviderKey } from '../adapters/ProviderProbe.ts';
import { validateAgent } from '../core/concurrency/FileLockManager.ts';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';

export class SettingsService {
  private readonly settings: SettingsStore;
  private readonly providers: ProviderRegistry;
  // Validity is bound to the actual encrypted key content, never just an agent ID.
  private readonly verified = new Map<AgentId, string>();
  private readonly queues = new Map<AgentId, Promise<unknown>>();
  constructor(userData: string, private readonly secrets: Pick<SecretStore, 'read' | 'save'>,
    private readonly onStatus: (agent: AgentId, status: ProviderStatus) => void = () => {},
    providers?: ProviderRegistry) {
    this.settings = new SettingsStore(userData); this.providers = providers ?? new ProviderRegistry(userData);
  }
  private serial<T>(agent: AgentId, work: () => Promise<T>): Promise<T> {
    validateAgent(agent);
    const key = agent === 'chatgpt' ? 'codex' : agent;
    const next = (this.queues.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
    this.queues.set(key, next);
    void next.finally(() => { if (this.queues.get(key) === next) this.queues.delete(key); }).catch(() => {});
    return next;
  }
  isChatGPTLinked(): Promise<boolean> { return this.settings.isChatGPTLinked(); }
  setChatGPTLinked(linked: boolean): Promise<void> { return this.settings.setChatGPTLinked(linked); }
  private digest(key: string): string { return createHash('sha256').update(key).digest('hex'); }
  async profile(agent: AgentId, supplied?: ProviderStatus): Promise<AgentSettingsProfile> {
    validateAgent(agent);
    const config = await this.providers.config(agent);
    const status = supplied ?? await this.providers.status(agent);
    const key = await this.secrets.read(agent);
    const preferences = (await this.settings.read()).agents[agent];
    try { this.onStatus(agent, status); } catch { /* Closing renderer must not fail a verified status read. */ }
    return { agent_id: agent, display_name: config.display_name, role_description: config.role_description,
      connection_status: status.connection_status, auth_method: status.auth_method,
      quota_5h_percent: status.quota_5h_percent, quota_week_percent: status.quota_week_percent,
      account_hint: status.account_hint, account_plan: status.account_plan, worker_model_name: status.worker_model_name,
      quota_shared_with: status.quota_shared_with,
      quota_report: status.quota_report,
      ...(preferences?.threshold === undefined ? {} : { alert_threshold_percent: preferences.threshold }),
      fallback_api: { is_configured: key !== null, use_fallback_on_error: preferences?.fallback ?? false,
        ...(key === null ? {} : { api_key_masked: '••••••••' }), is_valid: key !== null && this.verified.get(agent) === this.digest(key) } };
  }
  async network(): Promise<AINetworkSettings> {
    const configs = await this.providers.configurations();
    const defaultAgent = (await this.settings.read()).defaultAgent ??
      (configs.gemini ? 'gemini' : configs.chatgpt ? 'chatgpt' : configs.codex && !('commands' in configs.codex) ? 'codex' : undefined);
    if (!defaultAgent || !configs[defaultAgent]) throw new WorkspaceError('DEFAULT_AGENT_NOT_CONFIGURED', 'Select a configured default chat agent');
    const agents = await Promise.all((Object.keys(configs) as AgentId[]).map(async (agent) => {
      try { return await this.profile(agent); }
      catch (error) {
        const config = configs[agent]!;
        if ('commands' in config || !(error instanceof WorkspaceError)) throw error;
        return this.profile(agent, { connection_status: 'DISCONNECTED',
          auth_method: error.code.endsWith('_CLI_NOT_FOUND') ? 'Chưa tìm thấy CLI' : 'Không kiểm tra được kết nối',
          quota_5h_percent: null, quota_week_percent: null });
      }
    }));
    return { default_chat_agent_id: defaultAgent, agents };
  }
  async setDefault(agent: string): Promise<AINetworkSettings> {
    validateAgent(agent); await this.profile(agent);
    await this.settings.update((s) => { s.defaultAgent = agent; });
    return this.network();
  }
  saveKey(agent: AgentId, key: string): Promise<void> {
    return this.serial(agent, async () => { await this.secrets.save(agent, key); this.verified.delete(agent); });
  }
  action(agent: AgentId, action: string): Promise<AgentSettingsProfile> {
    return this.serial(agent, async () => {
      if (!['CONNECT', 'DISCONNECT', 'REFRESH', 'CHECK_CLI', 'CHECK_API'].includes(action)) throw new WorkspaceError('INVALID_ACTION', 'Unknown connection action');
      if (action === 'CHECK_API') {
        const key = await this.secrets.read(agent);
        if (!key) throw new WorkspaceError('API_KEY_NOT_CONFIGURED', 'Save an API key before testing it');
        this.verified.delete(agent);
        if (await checkProviderKey(agent, key)) this.verified.set(agent, this.digest(key));
        return this.profile(agent);
      }
      const status = await this.providers.action(agent, action as 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI');
      return this.profile(agent, status);
    });
  }
  fallback(agent: AgentId, enabled: boolean): Promise<AgentSettingsProfile> {
    return this.serial(agent, async () => {
      if (typeof enabled !== 'boolean') throw new WorkspaceError('INVALID_SETTINGS', 'Fallback must be boolean');
      const before = await this.profile(agent);
      if (enabled && !before.fallback_api.is_valid) throw new WorkspaceError('API_KEY_UNVERIFIED', 'Verify the saved key before enabling fallback');
      await this.settings.update((s) => { s.agents[agent] = { ...s.agents[agent], fallback: enabled }; });
      return { ...before, fallback_api: { ...before.fallback_api, use_fallback_on_error: enabled } };
    });
  }
  threshold(agent: AgentId, percent: number): Promise<AgentSettingsProfile> {
    return this.serial(agent, async () => {
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new WorkspaceError('INVALID_SETTINGS', 'Threshold must be 0..100');
      const before = await this.profile(agent);
      await this.settings.update((s) => { s.agents[agent] = { ...s.agents[agent], threshold: percent }; });
      return { ...before, alert_threshold_percent: percent };
    });
  }
  async appearance(): Promise<AppearanceAndGraphSettings> {
    const value = (await this.settings.read()).appearance;
    if (!value) throw new WorkspaceError('APPEARANCE_NOT_CONFIGURED', 'Save graph appearance settings first');
    return value;
  }
  async saveAppearance(value: AppearanceAndGraphSettings): Promise<void> {
    validateAppearance(value);
    const projected: AppearanceAndGraphSettings = { startup_behavior: value.startup_behavior, graph_render_fps: value.graph_render_fps,
      enable_graph_glow: value.enable_graph_glow, enable_path_lights_up: value.enable_path_lights_up, enable_task_sound: value.enable_task_sound };
    await this.settings.update((s) => { s.appearance = projected; });
  }
}
