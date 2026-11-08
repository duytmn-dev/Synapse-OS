import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getWorkspaceStorageInfo } from './WorkspaceStorage.ts';

test('reports user data, temp and app sizes without double counting nested app', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'synapse-storage-'));
  try {
    await mkdir(path.join(root, 'temp'));
    await mkdir(path.join(root, 'app'));
    await writeFile(path.join(root, 'temp', 'a'), Buffer.alloc(100));
    await writeFile(path.join(root, 'app', 'b'), Buffer.alloc(200));
    const result = await getWorkspaceStorageInfo(root, path.join(root, 'app'));
    assert.equal(result.total_used_mb, 300 / 1048576);
    assert.equal(result.core_app_mb, 200 / 1048576);
    assert.equal(result.temp_files_mb, 100 / 1048576);
  } finally { await rm(root, { recursive: true, force: true }); }
});
