import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentId, AgentSettingsProfile } from '../shared/types';
import { runCLI, type AgentCLIConfig } from './CLIAdapter.ts';
import { requiredText, WorkspaceError } from '../core/workspace/WorkspacePaths.ts';
import { validateAgent } from '../core/concurrency/FileLockManager.ts';

export type ProviderStatus = Pick<AgentSettingsProfile, 'connection_status' | 'auth_method' | 'quota_5h_percent' | 'quota_week_percent'> & { worker_model_name?: string };
export interface ProviderConfig {
  display_name: string;
  role_description: string;
  commands: { status: AgentCLIConfig; check_cli?: AgentCLIConfig; connect?: AgentCLIConfig; disconnect?: AgentCLIConfig };
}

/** Trusted backend configuration. CLI wrappers must normalize their verified
 * provider response, including quota, into ProviderStatus JSON. No guessed flags. */
export class ProviderRegistry {
  constructor(private readonly userData: string) {}
  async configurations(): Promise<Partial<Record<AgentId, ProviderConfig>>> {
    let input: unknown;
    try { input = JSON.parse(await readFile(path.join(this.userData, 'agent-providers.json'), 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new WorkspaceError('PROVIDER_NOT_CONFIGURED', 'Configure agent-providers.json in userData');
      throw new WorkspaceError('PROVIDER_CONFIG_INVALID', 'Cannot read provider configuration');
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new WorkspaceError('PROVIDER_CONFIG_INVALID', 'Expected agent configuration object');
    for (const [agent, config] of Object.entries(input)) {
      validateAgent(agent);
      if (!config || typeof config !== 'object') throw new WorkspaceError('PROVIDER_CONFIG_INVALID', 'Invalid provider');
      requiredText(config.display_name, 'display_name'); requiredText(config.role_description, 'role_description');
      if (!config.commands?.status) throw new WorkspaceError('PROVIDER_CONFIG_INVALID', 'Status command required');
      for (const [name, command] of Object.entries(config.commands)) {
        if (!['status', 'check_cli', 'connect', 'disconnect'].includes(name) || !command || typeof command !== 'object') throw new WorkspaceError('PROVIDER_CONFIG_INVALID', 'Invalid command');
        const value = command as AgentCLIConfig;
        requiredText(value.executable, 'executable');
        if (!path.isAbsolute(value.executable) || /\.(cmd|bat)$/i.test(value.executable) ||
          (value.args !== undefined && (!Array.isArray(value.args) || !value.args.every((arg) => typeof arg === 'string')))) {
          throw new WorkspaceError('PROVIDER_CONFIG_INVALID', 'Use an absolute native executable and literal argument array');
        }
      }
    }
    if (!Object.keys(input).length) throw new WorkspaceError('PROVIDER_NOT_CONFIGURED', 'No configured providers');
    return input as Partial<Record<AgentId, ProviderConfig>>;
  }
  async config(agent: AgentId): Promise<ProviderConfig> {
    validateAgent(agent);
    const config = (await this.configurations())[agent];
    if (!config) throw new WorkspaceError('PROVIDER_NOT_CONFIGURED', `No configuration for ${agent}`);
    return config;
  }
  async execute(command: AgentCLIConfig): Promise<string> {
    try { return (await runCLI({ ...command, cwd: this.userData, timeoutMs: command.timeoutMs ?? 15000, maxOutputBytes: 1024 * 1024 })).stdout; }
    catch { throw new WorkspaceError('PROVIDER_COMMAND_FAILED', 'Configured provider command failed; check installation/login'); }
  }
  async status(agent: AgentId): Promise<ProviderStatus> {
    const config = await this.config(agent);
    let status: ProviderStatus;
    try { status = JSON.parse(await this.execute(config.commands.status)) as ProviderStatus; }
    catch (error) { if (error instanceof WorkspaceError) throw error; throw new WorkspaceError('PROVIDER_STATUS_INVALID', 'Status command must return JSON'); }
    if (!status || !['CONNECTED', 'DISCONNECTED', 'OUT_OF_QUOTA'].includes(status.connection_status) || typeof status.auth_method !== 'string') {
      throw new WorkspaceError('PROVIDER_STATUS_INVALID', 'Missing verified connection state');
    }
    if (![status.quota_5h_percent, status.quota_week_percent].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)) {
      throw new WorkspaceError('QUOTA_UNAVAILABLE', 'Provider must supply actual 5h and weekly quota percentages');
    }
    if (status.worker_model_name !== undefined) requiredText(status.worker_model_name, 'worker_model_name');
    return { connection_status: status.connection_status, auth_method: status.auth_method,
      quota_5h_percent: status.quota_5h_percent, quota_week_percent: status.quota_week_percent, worker_model_name: status.worker_model_name };
  }
  async action(agent: AgentId, action: 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI'): Promise<ProviderStatus> {
    const config = await this.config(agent);
    if (action !== 'REFRESH') {
      const name = { CONNECT: 'connect', DISCONNECT: 'disconnect', CHECK_CLI: 'check_cli' }[action] as 'connect' | 'disconnect' | 'check_cli';
      const command = config.commands[name];
      if (!command) throw new WorkspaceError('PROVIDER_ACTION_UNAVAILABLE', `Configure ${name} for ${agent}`);
      await this.execute(command);
    }
    return this.status(agent);
  }
}
