import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, rmSync, symlinkSync, linkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import type { ChatSessionMutationRequest } from '../../src/shared/types';
import { ShadowWorkspaceManager } from '../../src/core/workspace/ShadowWorkspaceManager.ts';
import { projectHash, WorkspacePaths } from '../../src/core/workspace/WorkspacePaths.ts';
import { createWorkspaceHandlers } from '../../src/main/WorkspaceHandlers.ts';
import { registerPhase0Handlers } from '../../src/main/Phase0Handlers.ts';
import { IPC } from '../../src/main/ipc.ts';

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'synapse-workspace-'));
  const project = path.join(root, 'source');
  const userData = path.join(root, 'AppData', 'SynapseOS');
  mkdirSync(project);
  writeFileSync(path.join(project, 'main.ts'), 'export const answer = 42;\n');
  const manager = new ShadowWorkspaceManager(userData);
  t.after(() => {
    manager.dispose();
    // The resolved deletion target must be the unique temporary fixture, never the repository.
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('synapse-workspace-'));
    rmSync(root, { recursive: true, force: true });
  });
  return { root, project, userData, manager };
}

function snapshot(directory: string): unknown[] {
  return readdirSync(directory).sort().map((name) => {
    const file = path.join(directory, name);
    const info = lstatSync(file);
    return [name, info.mtimeMs, info.isDirectory() ? snapshot(file) : createHash('sha256').update(readFileSync(file)).digest('hex')];
  });
}

function inspect<T>(filename: string, run: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(filename);
  try { return run(db); } finally { db.close(); }
}

test('real SQLite creates the four specified tables outside source and reopens without pollution', async (t) => {
  const { project, userData, manager } = fixture(t);
  const before = snapshot(project);
  const result = await manager.openProject(path.join(project, '.', 'nested', '..'));
  const hash = createHash('sha256').update(path.resolve(project)).digest('hex').slice(0, 16);
  assert.equal(result.project_hash, hash);
  assert.equal(result.original_path, project);
  assert.equal(result.git_branch, '');
  assert.equal(result.is_shadow_workspace, true);
  assert.deepEqual(result.sessions, []);
  const database = path.join(userData, 'projects', hash, 'project.db');
  assert.ok(readFileSync(database).subarray(0, 16).equals(Buffer.from('SQLite format 3\0')));
  inspect(database, (db) => {
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name),
      ['chat_sessions', 'file_locks', 'graph_overrides', 'project_metadata']);
    const row = db.prepare('SELECT * FROM project_metadata').get()!;
    assert.equal(row.core_requirements, '');
    assert.equal(row.project_hash, hash);
    assert.ok(Number(row.created_at) > 0);
  });
  const reopened = new ShadowWorkspaceManager(userData);
  assert.deepEqual(reopened.listProjects(), [result]);
  assert.deepEqual(await reopened.openProject(project), result);
  reopened.dispose();
  assert.deepEqual(snapshot(project), before);
});

test('CRUD preserves literal titles, pin state, timestamps and project isolation across restart', async (t) => {
  const { root, project, userData, manager } = fixture(t);
  const before = snapshot(project);
  const hash = (await manager.openProject(project)).project_hash;
  const other = path.join(root, 'other'); mkdirSync(other);
  const otherHash = (await manager.openProject(other)).project_hash;
  const title = "Xin chào'); DROP TABLE chat_sessions; --";
  const created = manager.mutateSession({ action: 'CREATE', project_hash: hash, new_title: title })[0];
  assert.equal(created.title, title);
  assert.equal(created.is_pinned, false);
  assert.equal(created.project_hash, hash);
  const request = { project_hash: hash, session_id: created.session_id };
  let sessions = manager.mutateSession({ ...request, action: 'RENAME', new_title: 'Đổi tên' });
  assert.equal(sessions[0].title, 'Đổi tên');
  assert.ok(sessions[0].updated_at > created.updated_at);
  sessions = manager.mutateSession({ ...request, action: 'TOGGLE_PIN' });
  assert.equal(sessions[0].is_pinned, true);
  const restarted = new ShadowWorkspaceManager(userData);
  assert.deepEqual(restarted.listSessions(hash), sessions);
  assert.deepEqual(restarted.listSessions(otherHash), []);
  assert.throws(() => restarted.mutateSession({ ...request, project_hash: otherHash, action: 'DELETE' }), /SESSION_NOT_FOUND/);
  assert.equal(restarted.mutateSession({ ...request, action: 'TOGGLE_PIN' })[0].is_pinned, false);
  assert.deepEqual(restarted.mutateSession({ ...request, action: 'DELETE' }), []);
  assert.throws(() => restarted.mutateSession({ ...request, action: 'DELETE' }), /SESSION_NOT_FOUND/);
  assert.throws(() => manager.getSessionContext(hash, created.session_id), /SESSION_NOT_FOUND/);
  restarted.dispose();
  assert.deepEqual(snapshot(project), before);
});

test('CREATE hydrates persisted requirements, old summaries and graph into RAM; never stores the prompt', async (t) => {
  const { project, userData, manager } = fixture(t);
  const before = snapshot(project);
  const hash = (await manager.openProject(project)).project_hash;
  manager.setCoreRequirements(hash, 'Yêu cầu gốc: giữ nguyên dữ liệu');
  const first = manager.mutateSession({ action: 'CREATE', project_hash: hash, new_title: 'First' })[0];
  manager.saveSessionContent(hash, first.session_id, [{ role: 'user', content: 'Message' }], 'Đã chọn SQLite');
  const graph = { nodes: [{ id: 'main.ts' }], edges: [] };
  writeFileSync(manager.paths.file(hash, 'graph.json'), JSON.stringify(graph));
  const restarted = new ShadowWorkspaceManager(userData);
  const second = restarted.mutateSession({ action: 'CREATE', project_hash: hash, new_title: 'Second' }).find((s) => s.session_id !== first.session_id)!;
  const context = restarted.getSessionContext(hash, second.session_id);
  assert.equal(context.core_requirements, 'Yêu cầu gốc: giữ nguyên dữ liệu');
  assert.deepEqual(context.chat_summaries, [{ session_id: first.session_id, summary_text: 'Đã chọn SQLite' }]);
  assert.deepEqual(context.graph, graph);
  assert.ok(context.system_prompt.includes('Đã chọn SQLite'));
  context.chat_summaries[0].summary_text = 'tampered';
  assert.equal(restarted.getSessionContext(hash, second.session_id).chat_summaries[0].summary_text, 'Đã chọn SQLite');
  inspect(manager.paths.file(hash, 'project.db'), (db) => {
    const row = db.prepare('SELECT * FROM chat_sessions WHERE session_id = ?').get(second.session_id)!;
    assert.equal(row.messages_json, '[]');
    assert.equal(row.summary_text, '');
    assert.ok(!Object.keys(row).includes('system_prompt'));
    assert.equal(db.prepare('SELECT messages_json FROM chat_sessions WHERE session_id = ?').get(first.session_id)!.messages_json, '[{"role":"user","content":"Message"}]');
  });
  restarted.dispose();
  assert.deepEqual(snapshot(project), before);
});

test('missing graph is explicit null; corrupt graph aborts CREATE atomically', async (t) => {
  const { project, manager } = fixture(t);
  const hash = (await manager.openProject(project)).project_hash;
  const first = manager.mutateSession({ action: 'CREATE', project_hash: hash, new_title: 'Before graph exists' })[0];
  assert.equal(manager.getSessionContext(hash, first.session_id).graph, null);
  for (const invalid of ['{broken', '[]', 'null']) {
    writeFileSync(manager.paths.file(hash, 'graph.json'), invalid);
    assert.throws(() => manager.mutateSession({ action: 'CREATE', project_hash: hash, new_title: 'Must roll back' }), /GRAPH_CONTEXT_ERROR/);
    assert.equal(manager.listSessions(hash).length, 1);
  }
});

test('summary and message writes reject lossy input and unknown sessions without partial updates', async (t) => {
  const { project, manager } = fixture(t);
  const hash = (await manager.openProject(project)).project_hash;
  const session = manager.mutateSession({ action: 'CREATE', project_hash: hash, new_title: 'Persisted' })[0];
  manager.saveSessionContent(hash, session.session_id, [{ content: 'Original' }], 'Original summary');
  for (const messages of [[undefined], [{ content: undefined }], [NaN], [BigInt(1)]]) {
    assert.throws(() => manager.saveSessionContent(hash, session.session_id, messages, 'Must not replace'), /INVALID_ARGUMENT/);
  }
  assert.throws(() => manager.saveSessionContent(hash, 'missing', [], 'Missing'), /SESSION_NOT_FOUND/);
  inspect(manager.paths.file(hash, 'project.db'), (db) => {
    const row = db.prepare('SELECT messages_json, summary_text FROM chat_sessions WHERE session_id = ?').get(session.session_id)!;
    assert.equal(row.messages_json, '[{"content":"Original"}]');
    assert.equal(row.summary_text, 'Original summary');
  });
});

test('invalid mutations and unknown scopes fail without creating files or changing rows', async (t) => {
  const { project, userData, manager } = fixture(t);
  assert.deepEqual(manager.listProjects(), []);
  assert.throws(() => manager.listSessions('0123456789abcdef'), /PROJECT_NOT_FOUND/);
  assert.throws(() => lstatSync(userData), { code: 'ENOENT' });
  const hash = (await manager.openProject(project)).project_hash;
  const before = snapshot(project);
  const invalid: unknown[] = [null, {}, { action: 'CREATE' }, { action: 'CREATE', project_hash: null, new_title: 'Standalone' },
    { action: 'CREATE', project_hash: '../escape', new_title: 'Bad' },
    { action: 'CREATE', project_hash: hash, new_title: ' ' },
    { action: 'CREATE', project_hash: hash, new_title: 'A', session_id: 'supplied' },
    { action: 'RENAME', project_hash: hash, new_title: 'A' },
    { action: 'TOGGLE_PIN', project_hash: hash, session_id: 'missing' },
    { action: 'INVALID', project_hash: hash }];
  for (const request of invalid) assert.throws(() => manager.mutateSession(request as ChatSessionMutationRequest));
  assert.deepEqual(manager.listSessions(hash), []);
  assert.deepEqual(snapshot(project), before);
});

test('nonexistent/file project paths and storage nested under source reject before writing', async (t) => {
  const { root, project, manager } = fixture(t);
  const before = snapshot(project);
  await assert.rejects(manager.openProject(path.join(root, 'missing')), /INVALID_PROJECT_PATH/);
  await assert.rejects(manager.openProject(path.join(project, 'main.ts')), /INVALID_PROJECT_PATH/);
  const unsafe = new ShadowWorkspaceManager(path.join(project, 'new', 'SynapseOS'));
  await assert.rejects(unsafe.openProject(project), /PROJECT_STORAGE_OVERLAP/);
  assert.deepEqual(snapshot(project), before);
  assert.throws(() => new WorkspacePaths('relative'), /INVALID_STORAGE_ROOT/);
});

test('junction-redirection of projects into source is rejected before database writes', async (t) => {
  const { project, userData, manager } = fixture(t);
  mkdirSync(userData, { recursive: true });
  symlinkSync(project, path.join(userData, 'projects'), 'junction');
  const before = snapshot(project);
  await assert.rejects(manager.openProject(project), /UNSAFE_STORAGE_PATH/);
  assert.deepEqual(snapshot(project), before);
});

test('hard-linked database and redirected project directory are rejected', async (t) => {
  const { root, project, manager } = fixture(t);
  const hash = (await manager.openProject(project)).project_hash;
  linkSync(manager.paths.file(hash, 'project.db'), path.join(root, 'linked.db'));
  assert.throws(() => manager.listSessions(hash), /UNSAFE_STORAGE_PATH/);
  const otherHash = projectHash(path.join(root, 'other'));
  symlinkSync(project, path.join(manager.paths.projects, otherHash), 'junction');
  assert.throws(() => manager.listSessions(otherHash), /UNSAFE_STORAGE_PATH/);
});

test('corrupt databases and unsupported schemas produce explicit errors', async (t) => {
  const { project, manager } = fixture(t);
  const hash = (await manager.openProject(project)).project_hash;
  const filename = manager.paths.file(hash, 'project.db');
  inspect(filename, (db) => db.exec('PRAGMA user_version = 99'));
  assert.throws(() => manager.listSessions(hash), /UNSUPPORTED_SCHEMA/);
  writeFileSync(filename, 'not sqlite');
  assert.throws(() => manager.listSessions(hash), /DATABASE_ERROR/);
});

test('actual Git branch including unborn HEAD is read without writing to the repository', async (t) => {
  const { project, manager } = fixture(t);
  execFileSync('git', ['init', '--initial-branch=phase-one-test', project], { windowsHide: true });
  const before = snapshot(project);
  const results = await Promise.all([manager.openProject(project), manager.openProject(project)]);
  assert.equal(results[0].git_branch, 'phase-one-test');
  assert.equal(results[1].project_hash, results[0].project_hash);
  assert.equal(manager.listProjects().length, 1);
  assert.deepEqual(snapshot(project), before);
});

test('real service IPC adapters persist CRUD, emit snapshots and enforce sender authorization', async (t) => {
  const { project, manager } = fixture(t);
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  const sent: { channel: string; payload: unknown }[] = [];
  const contents = { mainFrame: {}, isDestroyed: () => false, send: (channel: string, payload: unknown) => sent.push({ channel, payload }) } as unknown as WebContents;
  const ipc = { handle: (channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel) } as Pick<IpcMain, 'handle' | 'removeHandler'>;
  const dispose = registerPhase0Handlers(ipc, () => contents, createWorkspaceHandlers(manager, () => contents));
  t.after(dispose);
  const event = { sender: contents, senderFrame: contents.mainFrame } as IpcMainInvokeEvent;
  const invoke = async (channel: string, ...args: unknown[]) => handlers.get(channel)!(event, ...args);
  assert.throws(() => handlers.get(IPC.openShadowProject)!({ ...event, senderFrame: {} } as IpcMainInvokeEvent, project), /UNTRUSTED_SENDER/);
  const opened = await invoke(IPC.openShadowProject, project) as { project_hash: string };
  const hash = opened.project_hash;
  const sessions = await invoke(IPC.mutateChatSession, { action: 'CREATE', project_hash: hash, new_title: 'Via IPC' }) as { session_id: string }[];
  const request = { project_hash: hash, session_id: sessions[0].session_id };
  await invoke(IPC.mutateChatSession, { ...request, action: 'RENAME', new_title: 'Renamed via IPC' });
  await invoke(IPC.mutateChatSession, { ...request, action: 'TOGGLE_PIN' });
  assert.equal(manager.listSessions(hash)[0].is_pinned, true);
  assert.equal(manager.listSessions(hash)[0].title, 'Renamed via IPC');
  assert.deepEqual(await invoke(IPC.getChatSessions, hash), manager.listSessions(hash));
  assert.deepEqual(await invoke(IPC.getShadowProjects), manager.listProjects());
  const notifications = sent.length;
  await assert.rejects(invoke(IPC.mutateChatSession, { action: 'CREATE', project_hash: hash }), /INVALID_ARGUMENT/);
  assert.equal(sent.length, notifications);
  assert.ok(sent.some((s) => s.channel === IPC.chatSessionsUpdated));
  assert.ok(sent.some((s) => s.channel === IPC.shadowProjectsUpdated));
  assert.deepEqual(await invoke(IPC.mutateChatSession, { ...request, action: 'DELETE' }), []);
  dispose();
  assert.equal(handlers.size, 0);
});
