import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, rmdir, chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';
import { runCLI, type CLIRunner, type CLIResult } from '../adapters/CLIAdapter.ts';

export interface FFmpegArtifact {
  url: string;
  /** SHA-256 of the executable AFTER decompression. */
  sha256: string;
  gzip?: boolean;
}
export interface MediaOptions {
  /** Writable directory. Electron integration should pass app.getPath('userData'). */
  dataDirectory: string;
  artifact?: FFmpegArtifact;
  fetch?: typeof fetch;
  runner?: CLIRunner;
  installTimeoutMs?: number;
  maxDownloadBytes?: number;
}

// Pinned upstream release asset and published executable digest:
// https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1
const WINDOWS_X64: FFmpegArtifact = {
  url: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-win32-x64.gz',
  sha256: '04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00',
  gzip: true,
};

export class LocalMediaTools {
  readonly directory: string;
  readonly executable: string;
  private readonly options: MediaOptions;
  private readonly runner: CLIRunner;

  constructor(options: MediaOptions) {
    if (!options.dataDirectory) throw new Error('A writable dataDirectory is required');
    this.options = { ...options, artifact: options.artifact ? { ...options.artifact } : undefined };
    this.directory = path.resolve(options.dataDirectory, '.plugins', 'ffmpeg');
    this.executable = path.join(this.directory, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    this.runner = options.runner ?? runCLI;
  }

  private artifact(): FFmpegArtifact {
    const artifact = this.options.artifact ?? (process.platform === 'win32' && process.arch === 'x64' ? WINDOWS_X64 : undefined);
    if (!artifact) throw new Error(`Provide a pinned FFmpeg artifact for ${process.platform}/${process.arch}`);
    if (new URL(artifact.url).protocol !== 'https:' || !/^[a-f\d]{64}$/i.test(artifact.sha256)) {
      throw new Error('FFmpeg requires an HTTPS URL and a SHA-256 digest');
    }
    return artifact;
  }

  private async valid(file: string, artifact: FFmpegArtifact, signal: AbortSignal): Promise<boolean> {
    try {
      const hash = createHash('sha256');
      await pipeline(createReadStream(file), hash, { signal });
      if (hash.digest('hex') !== artifact.sha256.toLowerCase()) return false;
      await this.runner({ executable: file, args: ['-version'], signal, timeoutMs: 10_000 });
      return true;
    } catch (error) {
      signal.throwIfAborted();
      if ((error as NodeJS.ErrnoException).code === 'EACCES') throw error;
      return false;
    }
  }

  /** Nothing is installed at construction/import time. A directory lock protects
   * concurrent instances/processes; timeout bounds abandoned-lock waits. Staging
   * files are verified before publication, and failed installs can be retried.
   */
  async ensureToolDependencies(options: { signal?: AbortSignal } = {}): Promise<string> {
    const artifact = this.artifact();
    const timeout = this.options.installTimeoutMs ?? 180_000;
    const limit = this.options.maxDownloadBytes ?? 256 * 1024 * 1024;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 2_147_483_647 || !Number.isSafeInteger(limit) || limit < 1) {
      throw new Error('Invalid installation timeout or download limit');
    }
    const signal = AbortSignal.any([AbortSignal.timeout(timeout), ...(options.signal ? [options.signal] : [])]);
    signal.throwIfAborted();
    if (await this.valid(this.executable, artifact, signal)) return this.executable;
    await mkdir(this.directory, { recursive: true });
    const lock = path.join(this.directory, '.install-lock');
    while (true) {
      signal.throwIfAborted();
      try { await mkdir(lock); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (await this.valid(this.executable, artifact, signal)) return this.executable;
        await sleep(50, undefined, { signal });
      }
    }
    const temporary = path.join(this.directory, `${randomUUID()}.partial${process.platform === 'win32' ? '.exe' : ''}`);
    try {
      if (await this.valid(this.executable, artifact, signal)) return this.executable;
      const response = await (this.options.fetch ?? fetch)(artifact.url, { signal });
      if (!response.ok || !response.body) throw new Error(`FFmpeg download failed: HTTP ${response.status}`);
      if (response.url && new URL(response.url).protocol !== 'https:') throw new Error('Insecure FFmpeg redirect');
      const bounded = () => {
        let size = 0;
        return new Transform({ transform(chunk: Buffer, _encoding, callback) {
          size += chunk.length;
          callback(size > limit ? new Error('FFmpeg download exceeds size limit') : null, chunk);
        } });
      };
      const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
      if (artifact.gzip) {
        await pipeline(source, bounded(), createGunzip(), bounded(), createWriteStream(temporary, { flags: 'wx' }), { signal });
      } else {
        await pipeline(source, bounded(), createWriteStream(temporary, { flags: 'wx' }), { signal });
      }
      if (process.platform !== 'win32') await chmod(temporary, 0o700);
      if (!await this.valid(temporary, artifact, signal)) throw new Error('FFmpeg integrity or executable validation failed');
      signal.throwIfAborted();
      // Only this installation's known target is removed, never a directory tree.
      await rm(this.executable, { force: true });
      await rename(temporary, this.executable);
      return this.executable;
    } finally {
      try { await rm(temporary, { force: true }); }
      finally { await rmdir(lock); }
    }
  }

  async runFFmpeg(args: readonly string[], options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<CLIResult> {
    const executable = await this.ensureToolDependencies(options);
    return this.runner({ executable, args: ['-hide_banner', '-nostdin', ...args], ...options });
  }

  async trim(input: string, output: string, startSeconds: number, durationSeconds: number,
    options: { signal?: AbortSignal } = {}): Promise<CLIResult> {
    this.validatePaths([input], output);
    if (!Number.isFinite(startSeconds) || startSeconds < 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error('Invalid trim interval');
    }
    // Re-encoding gives frame-accurate cuts; caller chooses the container by extension.
    return this.runFFmpeg(['-n', '-i', path.resolve(input), '-ss', String(startSeconds), '-t', String(durationSeconds), path.resolve(output)], options);
  }

  async concat(inputs: readonly string[], output: string, options: { signal?: AbortSignal } = {}): Promise<CLIResult> {
    this.validatePaths(inputs, output);
    if (inputs.length < 2) throw new Error('Concat requires at least two inputs with matching codecs/streams');
    const executable = await this.ensureToolDependencies(options);
    const list = path.join(this.directory, `${randomUUID()}.concat.txt`);
    const lines = inputs.map((input) => `file '${path.resolve(input).replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n');
    try {
      await writeFile(list, lines, { flag: 'wx' });
      return await this.runner({ executable, args: ['-hide_banner', '-nostdin', '-n', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.resolve(output)], signal: options.signal });
    } finally { await rm(list, { force: true }); }
  }

  private validatePaths(inputs: readonly string[], output: string): void {
    if (![...inputs, output].every((file) => file.trim() && !/[\r\n\0]/.test(file))) throw new Error('Invalid media path');
    const normalized = (file: string) => process.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file);
    if (inputs.some((input) => normalized(input) === normalized(output))) throw new Error('Output must differ from input');
  }
}
