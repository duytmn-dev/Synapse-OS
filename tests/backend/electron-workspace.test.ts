import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

test('bundled preload and real Electron main use SQLite in isolated appData', { timeout: 40000 }, async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'synapse-electron-workspace-'));
  try {
    mkdirSync(path.join(root, 'source'));
    mkdirSync(path.join(root, 'AppData'));
    const source = path.join(root, 'source', 'keep.txt');
    writeFileSync(source, 'Unchanged source');
    const external = ['electron', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)];
    for (const [entry, filename, format] of [
      ['./electron-workspace-entry.ts', 'main.mjs', 'es'],
      ['../../src/main/preload.ts', 'preload.cjs', 'cjs'],
    ] as const) {
      await build({ configFile: false, logLevel: 'error', build: { outDir: root, emptyOutDir: false,
        lib: { entry: fileURLToPath(new URL(entry, import.meta.url)), formats: [format], fileName: () => filename },
        rollupOptions: { external },
      } });
    }
    const repo = fileURLToPath(new URL('../../', import.meta.url));
    await build({
      configFile: false, root: repo, base: './', logLevel: 'error', plugins: [react()],
      resolve: { alias: { '@shared': path.join(repo, 'src', 'shared') } },
      build: { outDir: path.join(root, 'renderer'), emptyOutDir: false },
    });
    const electron = createRequire(import.meta.url)('electron') as string;
    const env: NodeJS.ProcessEnv = { ...process.env, SYNAPSE_WORKSPACE_TEST_ROOT: root, SYNAPSE_TEST_NODE: process.execPath };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = await promisify(execFile)(electron, [path.join(root, 'main.mjs')], { env, timeout: 30000, windowsHide: true });
    assert.match(result.stdout, /ELECTRON_WORKSPACE_OK/);
    assert.deepEqual(readdirSync(path.join(root, 'source')), ['keep.txt']);
    assert.equal(readFileSync(source, 'utf8'), 'Unchanged source');
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('synapse-electron-workspace-'));
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
