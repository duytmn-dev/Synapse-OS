import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import type { IpcMain, IpcMainInvokeEvent, IpcRenderer, WebContents } from 'electron';
import { createSynapseAPI } from '../../src/main/PreloadBridge.ts';
import { EVENT_CHANNELS, IPC, REQUEST_CHANNELS, type SynapseRequests } from '../../src/main/ipc.ts';
import { phase0Handlers, registerPhase0Handlers } from '../../src/main/Phase0Handlers.ts';

// These are test-only inputs, never production snapshots.
const requests = {
  getQuota: ['synapse:quota:get', []],
  getTasks: ['synapse:tasks:get', []],
  getOffice: ['synapse:office:get', []],
  getActiveRooms: ['synapse:active_rooms:get', []],
  getWorkspaceStorage: ['synapse:storage:get', []],
  saveAgentKey: ['synapse:key:save', ['codex', 'test-only-key']],
  getGraphData: ['synapse:graph:get', ['0123456789abcdef']],
  controlGraphNode: ['synapse:graph:control', [{ project_hash: '0123456789abcdef', node_id: 'main.ts', command: 'FOCUS' }]],
  openShadowProject: ['synapse:shadow:open', ['D:\\example']],
  pickShadowProject: ['synapse:shadow:pick', []],
  getShadowProjects: ['synapse:shadow:list', []],
  getChatSessions: ['synapse:chat:list', [null]],
  mutateChatSession: ['synapse:chat:mutate', [{ action: 'CREATE', project_hash: null, new_title: 'Test' }]],
  getTaskTree: ['synapse:task_tree:get', []],
  getAINetworkSettings: ['synapse:settings:ai:get', []],
  setDefaultChatAgent: ['synapse:settings:ai:default', ['gemini_antigravity']],
  agentConnectionAction: ['synapse:settings:agent:action', ['codex', 'CHECK_CLI']],
  setFallbackOnError: ['synapse:settings:agent:fallback', ['codex', false]],
  setAgentAlertThreshold: ['synapse:settings:agent:threshold', ['codex', 80]],
  getAppearanceSettings: ['synapse:settings:appearance:get', []],
  saveAppearanceSettings: ['synapse:settings:appearance:save', [{ startup_behavior: 'RESTORE_SESSION', graph_render_fps: 'HIGH_60FPS', enable_graph_glow: true, enable_path_lights_up: true, enable_task_sound: false }]],
  getToolDependencies: ['synapse:tools:get', []],
  ensureToolDependency: ['synapse:tools:ensure', ['graphify']],
  getUpdateStatus: ['synapse:updates:get', []],
} satisfies { [K in keyof SynapseRequests]: [string, Parameters<SynapseRequests[K]>] };

function rendererHarness() {
  const emitter = new EventEmitter();
  const calls: unknown[][] = [];
  let failure: Error | undefined;
  const response = { marker: 'unchanged payload' };
  const renderer = {
    invoke: async (...args: unknown[]) => { calls.push(args); if (failure) throw failure; return response; },
    on: emitter.on.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
  } as unknown as Pick<IpcRenderer, 'invoke' | 'on' | 'removeListener'>;
  return { renderer, emitter, calls, response, fail: (error: Error) => { failure = error; } };
}

test('actual preload exposes only the complete typed API as window.synapse', async () => {
  const harness = rendererHarness();
  const exposed: [string, unknown][] = [];
  const source = readFileSync(new URL('../../src/main/preload.ts', import.meta.url), 'utf8');
  const preload = new SourceTextModule(source);
  await preload.link((id) => {
    if (id === 'electron') return new SyntheticModule(['ipcRenderer', 'contextBridge'], function () {
      this.setExport('ipcRenderer', harness.renderer);
      this.setExport('contextBridge', { exposeInMainWorld: (name: string, api: unknown) => exposed.push([name, api]) });
    });
    if (id === './PreloadBridge.ts') return new SyntheticModule(['createSynapseAPI'], function () {
      this.setExport('createSynapseAPI', createSynapseAPI);
    });
    throw new Error(`Unexpected preload dependency: ${id}`);
  });
  await preload.evaluate();
  assert.equal(exposed.length, 1);
  assert.equal(exposed[0][0], 'synapse');
  assert.deepEqual(Object.keys(exposed[0][1] as object).sort(), [...Object.keys(requests), ...Object.keys(EVENT_CHANNELS)].sort());
  assert.equal(new Set(Object.values(IPC)).size, Object.values(IPC).length);
});

for (const method of Object.keys(requests) as (keyof SynapseRequests)[]) {
  test(`request ${method}: channel, arguments, result and rejection are preserved`, async () => {
    const harness = rendererHarness();
    const api = createSynapseAPI(harness.renderer);
    const [channel, args] = requests[method];
    const call = api[method] as (...values: unknown[]) => Promise<unknown>;
    assert.equal(await call(...args), harness.response);
    assert.deepEqual(harness.calls, [[channel, ...args]]);
    const error = new Error('BACKEND_FAILURE');
    harness.fail(error);
    await assert.rejects(call(...args), (caught) => caught === error);
  });
}

const events = {
  onQuotaUpdated: 'synapse:quota:updated', onTasksUpdated: 'synapse:tasks:updated',
  onOfficeUpdated: 'synapse:office:updated', onActiveRoomsUpdated: 'active_rooms_update',
  onGraphDataUpdated: 'graph_data_update', onGraphActiveEvent: 'graph_active_event',
  onShadowProjectsUpdated: 'shadow_projects_update', onChatSessionsUpdated: 'chat_sessions_update',
  onTaskTreeUpdated: 'task_tree_update',
} satisfies Record<keyof typeof EVENT_CHANNELS, string>;

for (const method of Object.keys(events) as (keyof typeof events)[]) {
  test(`event ${method}: hides Electron event and removes only its own listener`, () => {
    const harness = rendererHarness();
    const api = createSynapseAPI(harness.renderer);
    const received: unknown[][] = [];
    const callback = (...args: unknown[]) => { received.push(args); };
    const unsubscribe = api[method](callback);
    const otherUnsubscribe = api[method](callback);
    const channel = events[method];
    const payload = { marker: 'event payload' };
    harness.emitter.emit(channel, { sender: 'must stay private' }, payload);
    assert.deepEqual(received, [[payload], [payload]]);
    unsubscribe(); unsubscribe();
    assert.equal(harness.emitter.listenerCount(channel), 1);
    harness.emitter.emit(channel, {}, payload);
    assert.equal(received.length, 3);
    otherUnsubscribe();
    assert.equal(harness.emitter.listenerCount(channel), 0);
  });
}

function mainHarness() {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  const ipc = {
    handle: (channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => {
      if (handlers.has(channel)) throw new Error('Duplicate handler');
      handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => { handlers.delete(channel); },
  } as Pick<IpcMain, 'handle' | 'removeHandler'>;
  let destroyed = false;
  const contents = { mainFrame: {}, isDestroyed: () => destroyed } as unknown as WebContents;
  let target: WebContents | null = contents;
  const trusted = { sender: contents, senderFrame: contents.mainFrame } as IpcMainInvokeEvent;
  return { handlers, ipc, contents, trusted, getContents: () => target,
    destroy: () => { destroyed = true; }, clear: () => { target = null; } };
}

test('every new channel is registered, authorized, rejects explicitly and is disposed', async () => {
  const harness = mainHarness();
  const dispose = registerPhase0Handlers(harness.ipc, harness.getContents);
  const legacy = ['getQuota', 'getTasks', 'getOffice', 'getActiveRooms', 'getWorkspaceStorage', 'saveAgentKey'];
  const expected = Object.keys(requests).filter((method) => !legacy.includes(method));
  assert.deepEqual(Object.keys(phase0Handlers).sort(), expected.sort());
  assert.equal(harness.handlers.size, expected.length);
  // Connect the real bridge to registered main handlers to exercise the full path.
  const renderer = rendererHarness();
  renderer.renderer.invoke = async (channel, ...args: unknown[]) => harness.handlers.get(channel)!(harness.trusted, ...args);
  const api = createSynapseAPI(renderer.renderer);
  for (const method of Object.keys(phase0Handlers) as (keyof typeof phase0Handlers)[]) {
    const handler = harness.handlers.get(REQUEST_CHANNELS[method])!;
    const call = api[method] as (...args: unknown[]) => Promise<unknown>;
    await assert.rejects(call(...requests[method][1]), new RegExp(`NOT_IMPLEMENTED: ${method}`));
    await assert.rejects(call(undefined, { malformed: true }), /NOT_IMPLEMENTED/);
    assert.throws(() => handler({ ...harness.trusted, sender: {} } as IpcMainInvokeEvent), /UNTRUSTED_SENDER/);
    assert.throws(() => handler({ ...harness.trusted, senderFrame: {} } as IpcMainInvokeEvent), /UNTRUSTED_SENDER/);
  }
  harness.destroy();
  for (const handler of harness.handlers.values()) assert.throws(() => handler(harness.trusted), /UNTRUSTED_SENDER/);
  harness.clear();
  for (const handler of harness.handlers.values()) assert.throws(() => handler(harness.trusted), /UNTRUSTED_SENDER/);
  dispose(); dispose();
  assert.equal(harness.handlers.size, 0);
});

test('failed registration rolls back only its own handlers', () => {
  const harness = mainHarness();
  const existing = () => undefined;
  harness.handlers.set(IPC.getChatSessions, existing);
  assert.throws(() => registerPhase0Handlers(harness.ipc, harness.getContents), /Duplicate handler/);
  assert.deepEqual([...harness.handlers], [[IPC.getChatSessions, existing]]);
});
