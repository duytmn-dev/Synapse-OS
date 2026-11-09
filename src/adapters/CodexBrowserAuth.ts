import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';
import { maskProviderEmail, providerLabel, type ProviderStatus } from './ProviderRegistry.ts';
import { findWindowsDesktopCodex } from './WindowsCodexDiscovery.ts';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === 'object' && !Array.isArray(value)
  ? value as ObjectValue : {};
type Action = 'CONNECT' | 'DISCONNECT' | 'REFRESH' | 'CHECK_CLI';
interface CodexClient {
  request(method: string, params?: ObjectValue): Promise<ObjectValue>;
  waitFor(predicate: () => boolean, deadline: number): Promise<void>;
  onNotification(callback: (method: string, params: ObjectValue) => void): void;
}

export class CodexBrowserAuth {
  constructor(private readonly userData: string, private readonly openBrowser: (url: string) => Promise<void>,
    private readonly command?: readonly [string, ...string[]]) {}

  private async withClient<T>(run: (client: CodexClient) => Promise<T>): Promise<T> {
    if (this.command) return this.run(run, this.command);
    const override = process.env.SYNAPSE_CODEX_EXECUTABLE?.trim();
    if (override) return this.run(run, [override]);
    try {
      return await this.run(run, [process.platform === 'win32' ? 'codex.exe' : 'codex']);
    } catch (error) {
      if (!(error instanceof WorkspaceError) || error.code !== 'CODEX_CLI_NOT_FOUND') throw error;
      const desktop = await findWindowsDesktopCodex();
      if (!desktop) throw error;
      return this.run(run, [desktop]);
    }
  }

  private async run<T>(run: (client: CodexClient) => Promise<T>, command: readonly [string, ...string[]]): Promise<T> {
    const [executable, ...prefix] = command;
    if (/\.(cmd|bat)$/i.test(executable)) throw new WorkspaceError('CODEX_CLI_NOT_FOUND', 'Chỉ định tệp thực thi Codex, ví dụ codex.exe.');
    const codexHome = path.join(this.userData, 'codex-account');
    await mkdir(codexHome, { recursive: true, mode: 0o700 });
    // Use a separate Codex home and exclude ambient credential overrides.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() === 'CODEX_CA_CERTIFICATE' || !/^(CODEX_|OPENAI_|CHATGPT_)/i.test(key)));
    env.CODEX_HOME = codexHome;
    const child = spawn(executable, [...prefix, 'app-server', '--listen', 'stdio://',
      '-c', 'cli_auth_credentials_store="keyring"'], {
      cwd: this.userData, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
    });
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
    let nextId = 0;
    let failed: WorkspaceError | undefined;
    const pending = new Map<number, (message: ObjectValue) => void>();
    let onNotification: ((method: string, params: ObjectValue) => void) | undefined;
    const terminate = (error: WorkspaceError) => {
      failed ??= error;
      for (const resolve of pending.values()) resolve({});
      pending.clear();
    };
    child.on('error', (error: NodeJS.ErrnoException) => terminate(error.code === 'ENOENT'
      ? new WorkspaceError('CODEX_CLI_NOT_FOUND', 'Cài Codex CLI hoặc đặt SYNAPSE_CODEX_EXECUTABLE đến tệp thực thi Codex.')
      : new WorkspaceError('CODEX_START_FAILED', 'Không khởi động được Codex CLI.')));
    child.on('close', () => terminate(new WorkspaceError('CODEX_STOPPED', 'Codex CLI đã đóng kết nối.')));
    child.stdin.on('error', () => terminate(new WorkspaceError('CODEX_STOPPED', 'Không gửi được yêu cầu đến Codex CLI.')));
    let buffer = '';
    const decoder = new StringDecoder('utf8');
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += decoder.write(chunk);
      if (buffer.length > 2 * 1024 * 1024) {
        terminate(new WorkspaceError('CODEX_PROTOCOL_ERROR', 'Phản hồi Codex quá lớn.'));
        child.kill();
        return;
      }
      for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        try {
          const message = object(JSON.parse(line));
          if (typeof message.id === 'number' && !message.method) pending.get(message.id)?.(message);
          if (typeof message.method === 'string') {
            if (typeof message.id === 'number' || typeof message.id === 'string') {
              child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Client request unavailable' } }) + '\n');
            } else {
              onNotification?.(message.method, object(message.params));
            }
          }
        } catch { /* Ignore non-protocol output. The request still has a deadline. */ }
      }
    });
    const request = async (method: string, params?: ObjectValue) => {
      if (failed) throw failed;
      const id = ++nextId;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const message = await new Promise<ObjectValue>((resolve, reject) => {
          pending.set(id, resolve);
          timer = setTimeout(() => reject(new WorkspaceError('CODEX_REQUEST_TIMEOUT', 'Codex không phản hồi đúng hạn.')), 12000);
          child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
        });
        if (failed) throw failed;
        if (message.error || !('result' in message)) throw new WorkspaceError('CODEX_REQUEST_FAILED', `Codex từ chối yêu cầu ${method}.`);
        return object(message.result);
      } finally { clearTimeout(timer); pending.delete(id); }
    };
    try {
      await request('initialize', { clientInfo: { name: 'synapse_os', title: 'Synapse OS', version: '0.0.1' } });
      child.stdin.write('{"method":"initialized"}\n');
      return await run({
        request,
        async waitFor(predicate, deadline) {
          while (!predicate() && !failed && Date.now() < deadline) await delay(100);
          if (!predicate() && failed) throw failed;
        },
        onNotification(callback) { onNotification = callback; },
      });
    } finally {
      child.stdin.end();
      const forceClose = setTimeout(() => child.kill(), 500);
      try { await closed; } finally { clearTimeout(forceClose); }
    }
  }

  async action(action: Action): Promise<ProviderStatus> {
    return this.withClient(async ({ request, waitFor, onNotification }) => {
      if (action === 'CONNECT') {
        const notifications = new Map<string, boolean>();
        onNotification((method, params) => {
          if (method === 'account/login/completed' && typeof params.loginId === 'string' && typeof params.success === 'boolean') {
            if (notifications.size >= 8) notifications.clear();
            notifications.set(params.loginId, params.success);
          }
        });
        const login = await request('account/login/start', { type: 'chatgpt' });
        const { loginId, authUrl } = login;
        const url = typeof authUrl === 'string' ? URL.parse(authUrl) : null;
        if (login.type !== 'chatgpt' || typeof loginId !== 'string' || !url || url.protocol !== 'https:' ||
          !['auth.openai.com', 'chatgpt.com'].includes(url.host) || url.username || url.password) {
          throw new WorkspaceError('CODEX_LOGIN_URL_INVALID', 'Codex không trả về liên kết đăng nhập ChatGPT hợp lệ.');
        }
        try {
          await this.openBrowser(url.href);
          await waitFor(() => notifications.has(loginId), Date.now() + 4 * 60_000);
          if (notifications.get(loginId) !== true) {
            throw new WorkspaceError('CODEX_LOGIN_INCOMPLETE', 'Chưa xác thực được tài khoản ChatGPT. Hãy bấm Kết nối để thử lại.');
          }
        } catch (error) {
          if (!notifications.has(loginId)) await request('account/login/cancel', { loginId }).catch(() => {});
          throw error instanceof WorkspaceError ? error : new WorkspaceError('CODEX_BROWSER_OPEN_FAILED', 'Không mở được trình duyệt mặc định.');
        }
      } else if (action === 'DISCONNECT') {
        await request('account/logout');
      }
      const account = await request('account/read', { refreshToken: action === 'REFRESH' });
      if (!('account' in account)) throw new WorkspaceError('CODEX_PROTOCOL_ERROR', 'Thiếu trạng thái tài khoản Codex.');
      const identity = object(account.account);
      const connected = identity.type === 'chatgpt';
      if (action === 'CONNECT' && !connected) throw new WorkspaceError('CODEX_LOGIN_INCOMPLETE', 'Codex chưa xác nhận phiên ChatGPT.');
      const limits = connected ? await request('account/rateLimits/read').catch(() => ({} as ObjectValue)) : {};
      const bucket = object(object(limits.rateLimitsByLimitId).codex ?? limits.rateLimits);
      const windows = [object(bucket.primary), object(bucket.secondary)];
      const usage = (minutes: number) => {
        const value = windows.find((window) => window.windowDurationMins === minutes)?.usedPercent;
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      };
      const fiveHours = usage(300);
      const week = usage(10080);
      return {
        connection_status: !connected ? 'DISCONNECTED' : fiveHours === 100 || week === 100 ? 'OUT_OF_QUOTA' : 'CONNECTED',
        auth_method: connected ? 'ChatGPT · OAuth' : 'Chưa đăng nhập ChatGPT',
        quota_5h_percent: fiveHours,
        quota_week_percent: week,
        account_hint: connected ? maskProviderEmail(identity.email) : undefined,
        account_plan: connected ? providerLabel(identity.planType) : undefined,
      };
    });
  }

  async sendMessage(message: string): Promise<string> {
    if (typeof message !== 'string' || !message.trim() || message.length > 32_000) {
      throw new WorkspaceError('INVALID_ARGUMENT', 'Tin nhắn Codex phải có từ 1 đến 32.000 ký tự.');
    }
    return this.withClient(async ({ request, waitFor, onNotification }) => {
      const account = await request('account/read', { refreshToken: false });
      if (!('account' in account)) throw new WorkspaceError('CODEX_PROTOCOL_ERROR', 'Thiếu trạng thái tài khoản Codex.');
      if (object(account.account).type !== 'chatgpt') {
        throw new WorkspaceError('CODEX_NOT_CONNECTED', 'Hãy đăng nhập Codex bằng ChatGPT trong Cài đặt.');
      }
      const cwd = path.join(this.userData, 'codex-chat');
      await mkdir(cwd, { recursive: true, mode: 0o700 });
      const started = await request('thread/start', { cwd, ephemeral: true, sandbox: 'read-only', approvalPolicy: 'never' });
      const threadId = object(started.thread).id;
      if (typeof threadId !== 'string' || !threadId) throw new WorkspaceError('CODEX_PROTOCOL_ERROR', 'Thiếu mã phiên Codex.');

      let observedTurn: string | undefined;
      let completed: ObjectValue | undefined;
      let finalReply = '';
      let unclassifiedReply = '';
      onNotification((method, params) => {
        if (params.threadId !== threadId) return;
        const turn = object(params.turn);
        const id = method === 'turn/completed' ? turn.id : params.turnId;
        if (typeof id !== 'string' || (observedTurn && observedTurn !== id)) return;
        if (method === 'turn/completed') {
          observedTurn = id;
          completed = turn;
        } else if (method === 'item/completed') {
          const item = object(params.item);
          if (item.type !== 'agentMessage' || typeof item.text !== 'string' || !item.text.trim()) return;
          observedTurn = id;
          if (item.phase === 'final_answer') finalReply = item.text.trim();
          if (item.phase == null) unclassifiedReply = item.text.trim();
        }
      });

      const turn = await request('turn/start', {
        threadId, input: [{ type: 'text', text: message }], approvalPolicy: 'never',
        sandboxPolicy: { type: 'readOnly' },
      });
      const turnId = object(turn.turn).id;
      if (typeof turnId !== 'string' || !turnId) throw new WorkspaceError('CODEX_PROTOCOL_ERROR', 'Thiếu mã lượt trả lời Codex.');
      await waitFor(() => completed !== undefined, Date.now() + 120_000);
      if (!completed) throw new WorkspaceError('CODEX_CHAT_TIMEOUT', 'Codex chưa trả lời sau 2 phút.');
      if (observedTurn !== turnId) throw new WorkspaceError('CODEX_PROTOCOL_ERROR', 'Codex trả về lượt chat không khớp.');
      if (completed.status !== 'completed') {
        if (object(completed.error).codexErrorInfo === 'usageLimitExceeded') {
          throw new WorkspaceError('CODEX_CHAT_QUOTA', 'Tài khoản Codex đã hết hạn mức.');
        }
        throw new WorkspaceError('CODEX_CHAT_FAILED', 'Codex không hoàn tất lượt chat.');
      }
      const reply = finalReply || unclassifiedReply;
      if (!reply) throw new WorkspaceError('CODEX_EMPTY_REPLY', 'Codex hoàn tất lượt chat nhưng không gửi văn bản.');
      return reply;
    });
  }
}
