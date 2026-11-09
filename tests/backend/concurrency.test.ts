import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import type { GraphActiveEvent } from '../../src/shared/types';
import { ShadowWorkspaceManager } from '../../src/core/workspace/ShadowWorkspaceManager.ts';
import { FileLockManager } from '../../src/core/concurrency/FileLockManager.ts';
import { GraphActivity, type GraphOperation } from '../../src/core/GraphActivity.ts';
import { DAGExecutor } from '../../src/core/DAGExecutor.ts';
import { CLIAdapter, JSONLinesCLIAdapter } from '../../src/adapters/CLIAdapter.ts';

async function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'synapse-lock-'));
  const project = path.join(root, 'source'); mkdirSync(project);
  writeFileSync(path.join(project, 'shared.txt'), '');
  const userData = path.join(root, 'appData');
  const manager = new ShadowWorkspaceManager(userData);
  const hash = (await manager.openProject(project)).project_hash;
  t.after(() => {
    manager.dispose();
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('synapse-lock-'));
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  return { root, project, userData, manager, hash, locks: new FileLockManager(manager, hash) };
}

test('two independent Codex/Gemini processes serialize writes via real SQLite', async (t) => {
  const { project, userData, hash, manager } = await fixture(t);
  const filename = path.join(project, 'shared.txt');
  const run = (agent: string) => new Promise<void>((resolve, reject) => {
    const child = fork(fileURLToPath(new URL('./lock-process.ts', import.meta.url)), [userData, hash, agent, filename],
      { execArgv: ['--experimental-transform-types'], windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let diagnostic = '';
    child.stderr!.on('data', (chunk) => { diagnostic += String(chunk); });
    child.on('error', reject);
    child.on('exit', (code) => { if (code === 0) resolve(); else reject(new Error(diagnostic)); });
  });
  await Promise.all([run('codex'), run('gemini')]);
  const lines = readFileSync(filename, 'utf8').trim().split('\n');
  const first = lines[0].split(':')[0];
  const second = first === 'codex' ? 'gemini' : 'codex';
  assert.deepEqual(lines, [`${first}:start`, `${first}:end`, `${second}:start`, `${second}:end`]);
  assert.equal(manager.access(hash, (db) => db.prepare('SELECT count(*) AS count FROM file_locks').get()!.count), 0);
  assert.deepEqual(readdirSync(project), ['shared.txt']);
});

test('read/write conflicts, cancellation, aliases and old release tokens cannot bypass ownership', async (t) => {
  const { locks } = await fixture(t);
  const read = await locks.acquireLock('shared.txt', 'codex', 'READING');
  await assert.rejects(locks.acquireLock('./shared.txt', 'gemini', 'WRITING', { waitMs: 0 }), /LOCK_CONFLICT/);
  await assert.rejects(locks.acquireLock('shared.txt', 'gemini', 'READING', { waitMs: 20 }), /LOCK_TIMEOUT/);
  await assert.rejects(locks.acquireLock('shared.txt', 'gemini', 'WRITING', { signal: AbortSignal.timeout(20) }));
  read.release();
  const write = await locks.acquireLock('shared.txt', 'gemini', 'WRITING');
  read.release();
  await assert.rejects(locks.acquireLock('shared.txt', 'codex', 'READING', { waitMs: 0 }), /LOCK_CONFLICT/);
  write.release();
  await assert.rejects(locks.acquireLock('../escape', 'codex', 'WRITING'), /INVALID_NODE_PATH/);
  await assert.rejects(locks.acquireLock('shared.txt', 'unknown' as 'codex', 'WRITING'), /INVALID_AGENT/);
});

test('DAG withFile and actual CLI file work emit ordered graph events and release on completion', async (t) => {
  const { manager, hash, project } = await fixture(t);
  const activity = new GraphActivity(manager);
  const events: GraphActiveEvent[] = [];
  const unsubscribe = activity.subscribe((event) => events.push(event));
  const operation: GraphOperation = { project_hash: hash, agent_id: 'codex', worker_model_name: 'verified-test-model',
    target_node_id: 'shared.txt', source_node_id: 'entry.ts', file_path: 'shared.txt', mode: 'WRITING' };
  const executor = new DAGExecutor(); executor.connectGraphActivity(activity);
  const result = await executor.execute([{ code: 'B1', title: 'Actual file write', agent: 'codex',
    run: ({ withFile }) => withFile(operation, () => writeFileSync(path.join(project, 'shared.txt'), 'DAG wrote')) }]);
  assert.equal(result.errors.size, 0);
  assert.deepEqual(events.map((event) => event.action), ['FLOW_TRANSITION', 'WRITING', 'IDLE']);
  assert.ok(events.every((event) => event.task_code === 'B1' && event.project_hash === hash && event.agent_id === 'codex'));
  const adapter = new CLIAdapter({ executable: process.execPath, args: ['-e', 'process.stdout.write(require("node:fs").readFileSync(process.argv[1],"utf8"))', path.join(project, 'shared.txt')] }, undefined, activity);
  const output = await adapter.run('', { graph: { ...operation, agent_id: 'gemini', mode: 'READING' } });
  assert.equal(output.stdout, 'DAG wrote');
  assert.deepEqual(events.slice(3).map((event) => event.action), ['FLOW_TRANSITION', 'READING', 'IDLE']);
  assert.ok(events.slice(3).every((event) => event.agent_id === 'gemini'));
  unsubscribe();
});

test('DAG timeout never releases a lock while an uncooperative handler is still alive', async (t) => {
  const { manager, hash, locks } = await fixture(t);
  const activity = new GraphActivity(manager);
  const events: GraphActiveEvent[] = []; activity.subscribe((event) => events.push(event));
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const executor = new DAGExecutor({ timeoutMs: 150 }); executor.connectGraphActivity(activity);
  const result = await executor.execute([{ code: 'A', title: 'Slow write', agent: 'codex',
    graph: { project_hash: hash, worker_model_name: 'test-model', target_node_id: 'shared.txt', file_path: 'shared.txt', mode: 'WRITING' },
    run: () => pending }]);
  assert.equal(result.errors.size, 1);
  await assert.rejects(locks.acquireLock('shared.txt', 'gemini', 'WRITING', { waitMs: 0 }), /LOCK_CONFLICT/);
  finish();
  const lease = await locks.acquireLock('shared.txt', 'gemini', 'WRITING', { waitMs: 1000 }); lease.release();
  assert.deepEqual(events.map((event) => event.action), ['WRITING', 'ERROR', 'IDLE']);
});

test('CLI cancellation retains lock until child closure, then publishes ERROR and IDLE', async (t) => {
  const { manager, hash, locks } = await fixture(t);
  const activity = new GraphActivity(manager);
  const events: GraphActiveEvent[] = []; activity.subscribe((event) => events.push(event));
  const adapter = new CLIAdapter({ executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] }, undefined, activity);
  await assert.rejects(adapter.run('', { signal: AbortSignal.timeout(150), graph: { project_hash: hash, agent_id: 'gemini',
    worker_model_name: 'test-model', target_node_id: 'shared.txt', file_path: 'shared.txt', mode: 'WRITING' } }), /cancelled/);
  const lease = await locks.acquireLock('shared.txt', 'codex', 'WRITING', { waitMs: 0 }); lease.release();
  assert.deepEqual(events.map((event) => event.action), ['WRITING', 'ERROR', 'IDLE']);
});

test('malformed final JSON line emits ERROR before releasing the graph operation', async (t) => {
  const { manager, hash } = await fixture(t);
  const activity = new GraphActivity(manager);
  const events: GraphActiveEvent[] = []; activity.subscribe((event) => events.push(event));
  const adapter = new JSONLinesCLIAdapter({ executable: process.execPath, args: ['-e', 'process.stdout.write("{broken")'] }, undefined, activity);
  await assert.rejects(adapter.runJSON('', { graph: { project_hash: hash, agent_id: 'codex',
    worker_model_name: 'test-model', file_path: 'shared.txt', target_node_id: 'shared.txt', mode: 'READING' } }));
  assert.deepEqual(events.map((event) => event.action), ['READING', 'ERROR', 'IDLE']);
});
