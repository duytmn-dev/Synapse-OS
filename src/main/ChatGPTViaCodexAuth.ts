import type { BrowserAuth, ProviderAction, ProviderStatus } from '../adapters/ProviderRegistry.ts';
import type { SettingsStore } from './SettingsStore.ts';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';

const disconnected: ProviderStatus = { connection_status: 'DISCONNECTED', auth_method: 'Chưa liên kết tài khoản Codex',
  quota_5h_percent: null, quota_week_percent: null };

export class ChatGPTViaCodexAuth implements BrowserAuth {
  constructor(private readonly settings: Pick<SettingsStore, 'isChatGPTLinked' | 'setChatGPTLinked'>,
    private readonly codex: BrowserAuth & { sendMessage?(message: string): Promise<string> }) {}

  async sendMessage(message: string): Promise<string> {
    if (!(await this.settings.isChatGPTLinked()) || !this.codex.sendMessage) {
      throw new WorkspaceError('CHATGPT_NOT_LINKED', 'Kết nối ChatGPT với tài khoản Codex trong Cài đặt.');
    }
    return this.codex.sendMessage(message);
  }

  async action(action: ProviderAction): Promise<ProviderStatus> {
    if (action === 'DISCONNECT') {
      await this.settings.setChatGPTLinked(false);
      return disconnected;
    }
    if (action !== 'CONNECT' && !(await this.settings.isChatGPTLinked())) return disconnected;
    let status = await this.codex.action(action === 'REFRESH' ? 'REFRESH' : 'CHECK_CLI');
    if (action === 'CONNECT') {
      if (status.connection_status === 'DISCONNECTED') status = await this.codex.action('CONNECT');
      if (status.connection_status !== 'DISCONNECTED') await this.settings.setChatGPTLinked(true);
    }
    if (status.connection_status === 'DISCONNECTED') return disconnected;
    return { ...status, auth_method: 'ChatGPT · Tài khoản Codex', quota_shared_with: 'codex' };
  }
}
