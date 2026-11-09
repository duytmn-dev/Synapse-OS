import { spawn } from 'node:child_process';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { GraphActivity, GraphOperation } from '../core/GraphActivity.ts';

export interface CLIRequest {
  executable: string;
  args?: readonly string[];
  stdin?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxOutputBytes?: number;
  onOutput?: (stream: 'stdout' | 'stderr', text: string) => void;
}
export interface CLIResult { stdout: string; stderr: string; exitCode: number }
export type CLIRunner = (request: CLIRequest) => Promise<CLIResult>;

export class CLIError extends Error {
  readonly result: CLIResult;
  constructor(message: string, result: CLIResult) {
    super(message);
    this.name = 'CLIError';
    this.result = result;
  }
}

/** Executes native binaries (or node + a CLI's .js entry), never shell command strings.
 * Caller supplies installed CLI paths/flags; login and provider permissions remain
 * with that CLI. On Windows .cmd/.bat shims must be resolved to their .js entry.
 */
export const runCLI: CLIRunner = async (request) => {
  request.signal?.throwIfAborted();
  const timeout = request.timeoutMs ?? 120_000;
  const limit = request.maxOutputBytes ?? 4 * 1024 * 1024;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 2_147_483_647) throw new Error('Invalid CLI timeout');
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid output limit');
  if (!request.executable || /\.(cmd|bat)$/i.test(request.executable)) throw new Error('Use a native executable or node with a CLI .js entry');
  return new Promise<CLIResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let done = false;
    let failure: Error | undefined;
    let grace: ReturnType<typeof setTimeout> | undefined;
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
    const child = spawn(request.executable, [...(request.args ?? [])], {
      cwd: request.cwd, env: request.env ? { ...process.env, ...request.env } : process.env,
      shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: 'pipe',
    });
    const finish = (code: number | null): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(grace);
      request.signal?.removeEventListener('abort', abort);
      stdout += decoders.stdout.end(); stderr += decoders.stderr.end();
      const result = { stdout, stderr, exitCode: code ?? -1 };
      if (failure || code !== 0) reject(new CLIError(failure?.message ?? `CLI exited with code ${code}`, result));
      else resolve(result);
    };
    const stop = (reason: Error): void => {
      if (failure || done) return;
      failure = reason;
      if (child.pid) {
        if (process.platform === 'win32') {
          const killer = spawn(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
            ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false });
          killer.on('error', () => { child.kill(); });
          killer.on('exit', (code) => { if (code !== 0) child.kill(); });
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        }
      }
      grace = setTimeout(() => {
        child.kill('SIGKILL');
        child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
        // Never report completion until 'close': graph locks must outlive the process.
      }, 2000);
    };
    const abort = () => stop(new Error('CLI cancelled'));
    const timer = setTimeout(() => stop(new Error('CLI timed out')), timeout);
    const consume = (stream: 'stdout' | 'stderr', data: Buffer): void => {
      if (done || failure) return;
      bytes += data.length;
      if (bytes > limit) { stop(new Error('CLI output limit exceeded')); return; }
      const text = decoders[stream].write(data);
      if (stream === 'stdout') stdout += text; else stderr += text;
      try { request.onOutput?.(stream, text); } catch (error) {
        stop(error instanceof Error ? error : new Error(String(error)));
      }
    };
    child.stdout.on('data', (data: Buffer) => consume('stdout', data));
    child.stderr.on('data', (data: Buffer) => consume('stderr', data));
    child.on('error', (error) => {
      if (child.pid) stop(error); // A failed kill is not proof that the process exited.
      else { failure = error; finish(null); }
    });
    child.on('close', finish);
    child.stdin.on('error', (error) => stop(error));
    request.signal?.addEventListener('abort', abort, { once: true });
    if (request.signal?.aborted) abort();
    child.stdin.end(request.stdin ?? '');
  });
};

export interface AgentCLIConfig { executable: string; args?: readonly string[]; cwd?: string; timeoutMs?: number }

/** Prompts go through stdin, keeping quotes/metacharacters out of the command line. */
export class CLIAdapter {
  private readonly config: AgentCLIConfig;
  private readonly runner: CLIRunner;
  constructor(config: AgentCLIConfig, runner: CLIRunner = runCLI, private readonly activity?: GraphActivity) {
    this.config = { ...config, args: [...(config.args ?? [])] };
    this.runner = runner;
  }
  run(prompt: string, options: Pick<CLIRequest, 'signal' | 'onOutput'> & { graph?: GraphOperation } = {}): Promise<CLIResult> {
    const { graph, ...request } = options;
    const run = () => this.runner({ ...this.config, ...request, stdin: prompt });
    return this.withGraph(graph, options.signal, run);
  }
  protected withGraph<T>(graph: GraphOperation | undefined, signal: AbortSignal | undefined, run: () => Promise<T>): Promise<T> {
    if (!graph) return run();
    if (!this.activity) return Promise.reject(new Error('GRAPH_SERVICE_UNAVAILABLE: Configure GraphActivity for file operations'));
    return this.activity.run(graph, run, signal);
  }
}

/** For CLIs configured to emit one JSON value per stdout line. stderr stays separate. */
export class JSONLinesCLIAdapter extends CLIAdapter {
  async runJSON(prompt: string, options: { signal?: AbortSignal; onEvent?: (event: unknown) => void; graph?: GraphOperation } = {}): Promise<unknown[]> {
    return this.withGraph(options.graph, options.signal, async () => {
    let pending = '';
    const events: unknown[] = [];
    const parse = (line: string): void => {
      if (!line.trim()) return;
      const event: unknown = JSON.parse(line);
      events.push(event);
      options.onEvent?.(event);
    };
    await this.run(prompt, { signal: options.signal, onOutput: (stream, text) => {
      if (stream !== 'stdout') return;
      pending += text;
      let end: number;
      while ((end = pending.indexOf('\n')) !== -1) {
        parse(pending.slice(0, end)); pending = pending.slice(end + 1);
      }
    } });
    parse(pending);
    return events;
    });
  }
}
