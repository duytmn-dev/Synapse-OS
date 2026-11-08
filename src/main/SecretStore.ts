import { safeStorage } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Electron safeStorage uses OS encryption (DPAPI on Windows). Ciphertext is
 * stored in userData, not in Windows Credential Manager. No plaintext IPC reads. */
export class SecretStore {
  constructor(private readonly directory: string) {}
  private file(agent: string): string {
    if (!agent.trim() || agent.length > 200) throw new Error('Invalid agent ID');
    return path.join(this.directory, createHash('sha256').update(agent).digest('hex') + '.bin');
  }
  private ensureEncryption(): void {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption unavailable');
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
      throw new Error('OS key store unavailable');
    }
  }
  async read(agent: string): Promise<string | null> {
    this.ensureEncryption();
    try { return safeStorage.decryptString(await readFile(this.file(agent))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async save(agent: string, secret: string): Promise<void> {
    if (!secret || secret.length > 16384) throw new Error('Invalid API key');
    this.ensureEncryption();
    const target = this.file(agent);
    await mkdir(this.directory, { recursive: true });
    const temporary = path.join(this.directory, `${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, safeStorage.encryptString(secret), { flag: 'wx', mode: 0o600 });
      await rename(temporary, target);
    } finally { await rm(temporary, { force: true }); }
  }
}
