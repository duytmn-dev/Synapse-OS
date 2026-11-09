import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';
import { providerLabel, type ProviderAction, type ProviderStatus } from './ProviderRegistry.ts';

type ObjectValue = Record<string, unknown>;
const record = (value: unknown): ObjectValue => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
const records = (value: unknown): ObjectValue[] => Array.isArray(value) ? value.map(record) : [];

function sessionModel(session: ObjectValue): string | undefined {
  const selector = records(session.configOptions).find((option) => option.category === 'model' && option.type === 'select');
  const id = providerLabel(selector?.currentValue);
  if (!id) return;
  const options = records(selector?.options).flatMap((option) => Array.isArray(option.options) ? records(option.options) : [option]);
  return providerLabel(options.find((option) => option.value === id)?.name) ?? id;
}

export class AntigravityBrowserAuth {
  private sending = false;
  constructor(private readonly userData: string, private readonly command?: readonly [string, ...string[]]) {}

  action(action: ProviderAction): Promise<ProviderStatus> { return this.run(action); }

  async sendMessage(message: string): Promise<string> {
    if (typeof message !== 'string' || !message.trim() || message.length > 32000) {
      throw new WorkspaceError('AGY_INVALID_MESSAGE', 'Tin nhắn phải có nội dung và không vượt quá 32.000 ký tự.');
    }
    if (this.sending) throw new WorkspaceError('AGY_CHAT_BUSY', 'Gemini đang xử lý một tin nhắn khác.');
    this.sending = true;
    try {
      const result = await this.run('CHAT', message);
      if (!result.reply) throw new WorkspaceError('AGY_EMPTY_REPLY', 'Gemini không trả về nội dung.');
      return result.reply;
    } finally { this.sending = false; }
  }

  private async run(action: ProviderAction | 'CHAT', message?: string): Promise<ProviderStatus & { reply?: string }> {
    const cwd = action === 'CHAT' ? path.join(this.userData, 'gemini-chat') : this.userData;
    if (action === 'CHAT') await mkdir(cwd, { recursive: true, mode: 0o700 });
    const local = process.platform === 'win32' && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe') : undefined;
    const [executable, ...prefix] = this.command ?? [process.env.SYNAPSE_AGY_EXECUTABLE?.trim() ||
      (local && (await stat(local).catch(() => null))?.isFile() ? local : process.platform === 'win32' ? 'agy.exe' : 'agy')];
    if (/\.(cmd|bat)$/i.test(executable)) throw new WorkspaceError('AGY_CLI_NOT_FOUND', 'Chỉ định tệp thực thi Antigravity CLI.');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_APPLICATION_CREDENTIALS|GOOGLE_GENAI_USE_VERTEXAI|AGY_ADC_AUTH)$/i.test(key)));
    const child = spawn(executable, [...prefix, 'acp', ...(action === 'CHAT' ? ['--sandbox'] : [])], {
      env, cwd, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'ignore'],
    });
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
    let nextId = 0;
    let pending: { id: number; resolve: (response: ObjectValue) => void; reject: (error: Error) => void } | undefined;
    let failure: WorkspaceError | undefined;
    const advertised = new Map<string, Set<string>>();
    let output: { sessionId: string; text: string } | undefined;
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
        if (response.method && (typeof response.id === 'number' || typeof response.id === 'string')) {
          const result = response.method === 'session/request_permission'
            ? { result: { outcome: { outcome: 'cancelled' } } }
            : { error: { code: -32601, message: 'Client does not support this request' } };
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: response.id, ...result }) + '\n');
        } else if (pending && response.id === pending.id) pending.resolve(response);
        else if (response.method === 'session/update' && (action === 'REFRESH' || action === 'CHAT')) {
          const params = record(response.params);
          if (typeof params.sessionId !== 'string') return;
          const update = record(params.update);
          if (update.sessionUpdate === 'available_commands_update' && Array.isArray(update.availableCommands)) {
            if (!advertised.has(params.sessionId) && advertised.size >= 4) return;
            advertised.set(params.sessionId, new Set(records(update.availableCommands).map((command) => String(command.name))));
          }
          const content = record(update.content);
          if (output?.sessionId === params.sessionId && update.sessionUpdate === 'agent_message_chunk' &&
            content.type === 'text' && typeof content.text === 'string') {
            output.text = (output.text + content.text).slice(0, action === 'CHAT' ? 64000 : 8000);
          }
        }
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
      const session = await request('session/new', { cwd, mcpServers: [] });
      const error = record(session.error);
      const result = record(session.result);
      const connected = !session.error && typeof result.sessionId === 'string';
      const signedOut = error.code === -32000 && typeof error.message === 'string' && /authentication required/i.test(error.message);
      if ((!connected && !signedOut) || (action === 'CONNECT' && !connected) || (action === 'DISCONNECT' && connected)) {
        throw new WorkspaceError('AGY_AUTH_FAILED', 'Không xác nhận được trạng thái phiên Antigravity.');
      }
      let quotaReport: string | undefined;
      let reply: string | undefined;
      if (action === 'CHAT') {
        if (!connected) throw new WorkspaceError('AGY_AUTH_REQUIRED', 'Đăng nhập Gemini trong Cài đặt trước khi gửi tin nhắn.');
        const sessionId = result.sessionId as string;
        output = { sessionId, text: '' };
        const response = await request('session/prompt', { sessionId, prompt: [{ type: 'text',
          text: 'Đây là cuộc trò chuyện văn bản. Hãy trả lời trực tiếp, không dùng công cụ, không đọc hoặc sửa tệp.\n\n' + message }] }, 120000);
        const turn = requireResult(response, 'Gemini không xử lý được tin nhắn. Kiểm tra phiên đăng nhập và hạn mức.');
        if (!['end_turn', 'max_tokens'].includes(String(turn.stopReason))) {
          throw new WorkspaceError('AGY_CHAT_INCOMPLETE', 'Gemini chưa hoàn tất phản hồi.');
        }
        reply = output.text.trim();
      }
      if (connected && action === 'REFRESH') {
        const sessionId = result.sessionId as string;
        const deadline = Date.now() + 1500;
        while (!advertised.has(sessionId) && !failure && Date.now() < deadline) await delay(50);
        const commands = advertised.get(sessionId);
        const command = commands?.has('usage') ? '/usage' : commands?.has('quota') ? '/quota' : undefined;
        if (command) {
          output = { sessionId, text: '' };
          const response = await request('session/prompt', { sessionId, prompt: [{ type: 'text', text: command }] })
            .catch(() => undefined);
          if (response && !response.error && record(response.result).stopReason === 'end_turn') {
            quotaReport = output.text.replace(/\x1b\[[0-?]*[ -/]*[@-~]|[\x00-\x08\x0b-\x1f\x7f]/g, '').trim() || undefined;
          }
        }
      }
      const tier = record(record(record(result._meta).antigravity).tier);
      return { connection_status: connected ? 'CONNECTED' : 'DISCONNECTED',
        auth_method: connected ? 'Antigravity · ACP' : 'Chưa đăng nhập Google', quota_5h_percent: null, quota_week_percent: null,
        worker_model_name: connected ? sessionModel(result) : undefined,
        account_plan: connected ? providerLabel(tier.name) : undefined,
        quota_report: quotaReport, reply };
    } finally {
      lines.close();
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), 500);
      try { await closed; } finally { clearTimeout(timer); }
    }
  }
}
