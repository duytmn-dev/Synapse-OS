import test from 'node:test';
import assert from 'node:assert/strict';
import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import { DAGExecutor } from '../core/DAGExecutor.ts';
import { VisualOfficeBridge } from './VisualOfficeBridge.ts';
import { IPC } from './ipc.ts';

test('bridge forwards real executor events, retains snapshots, authorizes reads and disposes', async () => {
  const handlers = new Map<string, (event: IpcMainInvokeEvent) => unknown>();
  const sent: { channel: string; payload: unknown }[] = [];
  let destroyed = false;
  const contents = {
    mainFrame: {}, isDestroyed: () => destroyed,
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
  } as unknown as WebContents;
  let target: WebContents | null = contents;
  const ipc = {
    handle: (channel: string, listener: (event: IpcMainInvokeEvent) => unknown) => { handlers.set(channel, listener); },
    removeHandler: (channel: string) => { handlers.delete(channel); },
  } as Pick<IpcMain, 'handle' | 'removeHandler'>;
  const executor = new DAGExecutor();
  const bridge = new VisualOfficeBridge(executor, ipc, () => target);
  const trusted = { sender: contents, senderFrame: contents.mainFrame } as IpcMainInvokeEvent;
  assert.deepEqual(handlers.get(IPC.getOffice)!(trusted), []);
  await executor.execute([{ code: 'B', title: 'Parent', agent: 'codex', children: [
    { code: 'B1', title: 'Child', agent: 'codex', run: () => 'ok' },
  ] }]);
  assert.ok(sent.some(({ channel, payload }) => channel === IPC.officeUpdated &&
    (payload as { active_task_code: string }).active_task_code === 'B1'));
  assert.ok(sent.some(({ channel }) => channel === IPC.tasksUpdated));
  assert.deepEqual(handlers.get(IPC.getTasks)!(trusted), executor.getTasks());
  assert.equal(bridge.getOffice()[0].animation_state, 'IDLE');
  const snapshot = bridge.getOffice();
  snapshot[0].active_task_code = 'tampered';
  assert.equal(bridge.getOffice()[0].active_task_code, null);
  assert.throws(() => handlers.get(IPC.getTasks)!({ sender: {} } as IpcMainInvokeEvent), /Untrusted/);
  assert.throws(() => handlers.get(IPC.getOffice)!({ ...trusted, senderFrame: {} } as IpcMainInvokeEvent), /Untrusted/);
  destroyed = true;
  const before = sent.length;
  await executor.execute([{ code: 'C', title: 'C', agent: 'claude', run: () => {} }]);
  assert.equal(sent.length, before);
  assert.throws(() => handlers.get(IPC.getTasks)!(trusted), /Untrusted/);
  destroyed = false;
  target = null;
  assert.throws(() => handlers.get(IPC.getTasks)!(trusted), /Untrusted/);
  bridge.dispose();
  bridge.dispose();
  assert.equal(handlers.size, 0);
  target = contents;
  await executor.execute([{ code: 'D', title: 'D', agent: 'claude', run: () => {} }]);
  assert.equal(sent.length, before);
});
