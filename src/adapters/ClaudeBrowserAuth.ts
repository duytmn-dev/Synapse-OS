import { mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { CLIError, runCLI, type CLIRunner } from './CLIAdapter.ts';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';
import { maskProviderEmail, providerLabel, type ProviderAction, type ProviderStatus } from './ProviderRegistry.ts';

export class ClaudeBrowserAuth {
  constructor(private readonly userData: string, private readonly runner: CLIRunner = runCLI) {}

  async action(action: ProviderAction): Promise<ProviderStatus> {
    const config = path.join(this.userData, 'claude-account');
    await mkdir(config, { recursive: true, mode: 0o700 });
    const native = path.join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
    const executable = process.env.SYNAPSE_CLAUDE_EXECUTABLE?.trim() ||
      ((await stat(native).catch(() => null))?.isFile() ? native : path.basename(native));
    const env = { CLAUDE_CONFIG_DIR: config, ANTHROPIC_API_KEY: undefined, ANTHROPIC_AUTH_TOKEN: undefined,
      CLAUDE_CODE_OAUTH_TOKEN: undefined, CLAUDE_CODE_USE_BEDROCK: undefined, CLAUDE_CODE_USE_VERTEX: undefined,
      CLAUDE_CODE_USE_FOUNDRY: undefined, ANTHROPIC_BASE_URL: undefined };
    const run = async (command: 'login' | 'logout' | 'status') => {
      try {
        return await this.runner({ executable, args: ['auth', command], cwd: config, env,
          timeoutMs: command === 'login' ? 240000 : 15000, maxOutputBytes: 1024 * 1024 });
      } catch (error) {
        if (error instanceof CLIError && command === 'status' && error.result.exitCode === 1) return error.result;
        if (error instanceof Error && /\bENOENT\b/.test(error.message)) {
          throw new WorkspaceError('CLAUDE_CLI_NOT_FOUND', 'Cài Claude Code hoặc đặt SYNAPSE_CLAUDE_EXECUTABLE đến tệp Claude CLI.');
        }
        throw new WorkspaceError('CLAUDE_AUTH_FAILED', command === 'login'
          ? 'Claude Code chưa hoàn tất đăng nhập trong trình duyệt.' : 'Không kiểm tra hoặc đăng xuất được phiên Claude Code.');
      }
    };
    if (action === 'CONNECT') await run('login');
    if (action === 'DISCONNECT') await run('logout');
    const result = await run('status');
    let status: { loggedIn?: boolean; authMethod?: string; email?: unknown; subscriptionType?: unknown };
    try { status = JSON.parse(result.stdout); }
    catch { throw new WorkspaceError('CLAUDE_STATUS_INVALID', 'Claude Code không trả về trạng thái JSON.'); }
    if (!status || typeof status.loggedIn !== 'boolean') throw new WorkspaceError('CLAUDE_STATUS_INVALID', 'Thiếu trạng thái đăng nhập Claude Code.');
    const connected = result.exitCode === 0 && status.loggedIn && status.authMethod === 'claude.ai';
    if (action === 'CONNECT' && !connected) throw new WorkspaceError('CLAUDE_AUTH_FAILED', 'Claude Code chưa xác nhận tài khoản Claude.');
    if (action === 'DISCONNECT' && status.loggedIn) throw new WorkspaceError('CLAUDE_AUTH_FAILED', 'Claude Code chưa xác nhận đăng xuất.');
    return { connection_status: connected ? 'CONNECTED' : 'DISCONNECTED',
      auth_method: connected ? 'Claude · OAuth' : 'Chưa đăng nhập Claude', quota_5h_percent: null, quota_week_percent: null,
      account_hint: connected ? maskProviderEmail(status.email) : undefined,
      account_plan: connected ? providerLabel(status.subscriptionType) : undefined };
  }
}
