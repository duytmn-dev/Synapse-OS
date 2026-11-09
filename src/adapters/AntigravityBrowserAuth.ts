import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';
import type { ProviderAction, ProviderStatus } from './ProviderRegistry.ts';

type ObjectValue = Record<string, unknown>;
const record = (value: unknown): ObjectValue => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};

export class AntigravityBrowserAuth {
  constructor(private readonly userData: string, private readonly command?: readonly [string, ...string[]]) {}

  async action(action: ProviderAction): Promise<ProviderStatus> {
    const local = process.platform === 'win32' && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe') : undefined;
    const [executable, ...prefix] = this.command ?? [process.env.SYNAPSE_AGY_EXECUTABLE?.trim() ||
      (local && (await stat(local).catch(() => null))?.isFile() ? local : process.platform === 'win32' ? 'agy.exe' : 'agy')];
    if (/\.(cmd|bat)$/i.test(executable)) throw new WorkspaceError('AGY_CLI_NOT_FOUND', 'Chỉ định tệp thực thi Antigravity CLI.');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_APPLICATION_CREDENTIALS|GOOGLE_GENAI_USE_VERTEXAI|AGY_ADC_AUTH)$/i.test(key)));
    const child = spawn(executable, [...prefix, 'acp'], {
      env, cwd: this.userData, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'ignore'],
    });
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
    let nextId = 0;
    let pending: { id: number; resolve: (response: ObjectValue) => void; reject: (error: Error) => void } | undefined;
    let failure: WorkspaceError | undefined;
    const stop = (error: WorkspaceError) => { failure ??= error; pending?.reject(failure); };
    child.on('error', (error: NodeJS.ErrnoException) => stop(error.code === 'ENOENT'
      ? new WorkspaceError('AGY_CLI_NOT_FOUND', 'Cài Antigravity CLI (agy) hoặc đặt SYNAPSE_AGY_EXECUTABLE.')
      : new WorkspaceError('AGY_START_FAILED', 'Không khởi động được Antigravity CLI.')));
    child.on('close', () => stop(new WorkspaceError('AGY_STOPPED', 'Antigravity CLI đã đóng kết nối.')));
    child.stdin.on('error', () => stop(new WorkspaceError('AGY_STOPPED', 'Không gửi được yêu cầu đến Antigravity CLI.')));
    let bytes = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) {
        stop(new WorkspaceError('AGY_PROTOCOL_ERROR', 'Phản hồi Antigravity quá lớn.'));
        child.kill();
      }
    });
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => {
      try {
        const response = record(JSON.parse(line));
        if (response.method && typeof response.id === 'number') {
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: response.id,
            error: { code: -32601, message: 'Client does not support this request' } }) + '\n');
        } else if (pending && response.id === pending.id) pending.resolve(response);
      } catch { /* Requests time out if the server never returns a valid response. */ }
    });
    const request = async (method: string, params: ObjectValue, timeoutMs = 15000) => {
      if (failure) throw failure;
      const id = ++nextId;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await new Promise<ObjectValue>((resolve, reject) => {
          pending = { id, resolve, reject };
          timer = setTimeout(() => reject(new WorkspaceError('AGY_AUTH_TIMEOUT', 'Antigravity không hoàn tất yêu cầu đúng hạn.')), timeoutMs);
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        });
      } finally { clearTimeout(timer); pending = undefined; }
    };
    const requireResult = (response: ObjectValue, message: string) => {
      if (response.error || !('result' in response)) throw new WorkspaceError('AGY_AUTH_FAILED', message);
      return record(response.result);
    };
    try {
      const init = requireResult(await request('initialize', { protocolVersion: 1,
        clientInfo: { name: 'synapse_os', title: 'Synapse OS', version: '0.0.1' }, clientCapabilities: {} }),
      'Antigravity CLI không hỗ trợ ACP. Hãy cập nhật agy.');
      if (init.protocolVersion !== 1) throw new WorkspaceError('AGY_PROTOCOL_ERROR', 'Phiên bản ACP không tương thích.');
      if (action === 'CONNECT') {
        const methods: unknown[] = Array.isArray(init.authMethods) ? init.authMethods : [];
        if (!methods.some((method) => record(method).id === 'oauth-personal' &&
          (record(method).type === undefined || record(method).type === 'agent'))) {
          throw new WorkspaceError('AGY_OAUTH_UNAVAILABLE', 'Bản Antigravity CLI này chưa hỗ trợ đăng nhập Google từ ứng dụng.');
        }
        requireResult(await request('authenticate', { methodId: 'oauth-personal' }, 240000), 'Chưa hoàn tất đăng nhập Google.');
      } else if (action === 'DISCONNECT') {
        const logout = record(record(init.agentCapabilities).auth).logout;
        if (logout === undefined || logout === null) throw new WorkspaceError('AGY_LOGOUT_UNAVAILABLE', 'Hãy chạy /logout trong Antigravity CLI để đăng xuất.');
        requireResult(await request('logout', {}), 'Antigravity không xác nhận đăng xuất.');
      }
      const session = await request('session/new', { cwd: this.userData, mcpServers: [] });
      const error = record(session.error);
      const connected = !session.error && typeof record(session.result).sessionId === 'string';
      const signedOut = error.code === -32000 && typeof error.message === 'string' && /authentication required/i.test(error.message);
      if ((!connected && !signedOut) || (action === 'CONNECT' && !connected) || (action === 'DISCONNECT' && connected)) {
        throw new WorkspaceError('AGY_AUTH_FAILED', 'Không xác nhận được trạng thái phiên Antigravity.');
      }
      return { connection_status: connected ? 'CONNECTED' : 'DISCONNECTED',
        auth_method: connected ? 'Antigravity · ACP' : 'Chưa đăng nhập Google', quota_5h_percent: null, quota_week_percent: null };
    } finally {
      lines.close();
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), 500);
      try { await closed; } finally { clearTimeout(timer); }
    }
  }
}
