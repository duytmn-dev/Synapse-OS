import test from 'node:test';
import assert from 'node:assert/strict';
import { DAGExecutor, type DAGTask } from './DAGExecutor.ts';
import { UniversalTriageRouter } from './UniversalTriageRouter.ts';
import type { VisualOfficeEvent } from '../shared/types';

const leaf = (code: string, overrides: Partial<DAGTask> = {}): DAGTask => ({
  code, title: code, agent: 'codex', run: () => code, ...overrides,
});
const group = (code: string, children: DAGTask[], dependsOn?: string[]): DAGTask => ({
  code, title: code, agent: 'codex', children, dependsOn,
});
const delay = (ms = 5) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test('nested parent/child DAG completes with one worker and group dependencies', { timeout: 2000 }, async () => {
  const executor = new DAGExecutor({ concurrency: 1 });
  const order: string[] = [];
  const run = (code: string, dependsOn?: string[]) => leaf(code, {
    dependsOn, run: () => { order.push(code); return code; },
  });
  const result = await executor.execute([
    group('B', [group('B1', [run('B1a')]), run('B2', ['B1'])], ['A']),
    run('A'),
    leaf('C', { dependsOn: ['B'], run: ({ dependencies }) => {
      assert.deepEqual([...dependencies.keys()].sort(), ['B1a', 'B2']);
      order.push('C');
    } }),
  ]);
  assert.deepEqual(order, ['A', 'B1a', 'B2', 'C']);
  assert.equal(result.errors.size, 0);
  assert.ok(result.tasks.every((task) => task.status === 'COMPLETED'));
  assert.equal(result.tasks.find((task) => task.step_code === 'B')?.sub_tasks?.[0].status, 'COMPLETED');
});

test('invalid DAGs reject before executing any task', async () => {
  let called = 0;
  const badPlans: DAGTask[][] = [
    [leaf('A'), leaf('A')],
    [leaf('A', { dependsOn: ['missing'] })],
    [leaf('A', { dependsOn: ['A'] })],
    [leaf('A', { dependsOn: ['B'] }), leaf('B', { dependsOn: ['A'] })],
    [group('P', [leaf('C', { dependsOn: ['P'] })])],
    [group('P', [leaf('C')], ['C'])],
    [group('P', [leaf('C')], ['P'])],
    [leaf('A', { children: [leaf('B')] })],
    [leaf('A', { timeoutMs: Infinity })],
  ];
  for (const tasks of badPlans) {
    await assert.rejects(new DAGExecutor().execute([leaf('unrelated', { run: () => { called++; } }), ...tasks]));
  }
  assert.equal(called, 0);
});

test('global concurrency and per-room desks are bounded without badge collisions', async () => {
  const executor = new DAGExecutor({ concurrency: 5 });
  const occupied = new Map<string, string>();
  const violations: string[] = [];
  const events: VisualOfficeEvent[] = [];
  let active = 0;
  let peak = 0;
  executor.onOfficeUpdated((event) => {
    events.push(event);
    const key = `${event.room_id}:${event.desk_index}`;
    if (event.animation_state === 'THINKING') {
      if (occupied.has(key)) violations.push(key);
      occupied.set(key, event.active_task_code!);
    }
    if (event.animation_state === 'IDLE') occupied.delete(key);
  });
  const result = await executor.execute(Array.from({ length: 10 }, (_, index) => leaf(`T${index}`, {
    agent: index < 6 ? 'codex' : 'gemini',
    run: async () => { active++; peak = Math.max(peak, active); await delay(); active--; },
  })));
  assert.equal(result.errors.size, 0);
  assert.equal(peak, 5);
  assert.deepEqual(violations, []);
  assert.equal(occupied.size, 0);
  assert.ok(events.some((event) => event.room_id === 'GEMINI_AGY'));
  assert.equal(events.filter((event) => event.animation_state === 'DONE').length, 10);
});

test('failure skips dependent subtrees while independent work finishes', async () => {
  const ran: string[] = [];
  const result = await new DAGExecutor().execute([
    leaf('A', { run: () => { throw new Error('boom'); } }),
    group('B', [leaf('B1', { run: () => ran.push('B1') })], ['A']),
    leaf('C', { run: () => ran.push('C') }),
  ]);
  assert.deepEqual(ran, ['C']);
  assert.equal(result.errors.get('A')?.message, 'boom');
  assert.equal(result.tasks.find((task) => task.step_code === 'B')?.status, 'FAILED');
  assert.ok(result.errors.has('B1'));
});

test('timeout releases scheduling slots even for an unresolved promise', { timeout: 2000 }, async () => {
  let taskSignal: AbortSignal | undefined;
  const result = await new DAGExecutor({ concurrency: 1, timeoutMs: 20 }).execute([
    leaf('A', { run: ({ signal }) => { taskSignal = signal; return new Promise(() => {}); } }),
    leaf('B'),
    leaf('C', { dependsOn: ['A'] }),
  ]);
  assert.ok(taskSignal?.aborted);
  assert.match(result.errors.get('A')!.message, /timed out/);
  assert.ok(result.outputs.has('B'));
  assert.ok(result.errors.has('C'));
});

test('abort settles running and queued work, resets desks, and allows another run', { timeout: 2000 }, async () => {
  const executor = new DAGExecutor({ concurrency: 1 });
  const controller = new AbortController();
  const events: VisualOfficeEvent[] = [];
  executor.onOfficeUpdated((event) => events.push(event));
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  let count = 0;
  const execution = executor.execute([
    leaf('A', { run: () => { started(); return new Promise(() => {}); } }),
    leaf('B', { run: () => { count++; } }),
  ], { signal: controller.signal });
  await ready;
  await assert.rejects(executor.execute([leaf('X')]), /active DAG/);
  controller.abort(new Error('stop'));
  const result = await execution;
  assert.ok(result.tasks.every((task) => task.status === 'FAILED'));
  assert.equal(count, 0);
  assert.equal(events.at(-1)?.animation_state, 'IDLE');
  assert.equal((await executor.execute([leaf('next')])).errors.size, 0);
});

test('pre-aborted execution runs no work and empty graph completes', async () => {
  let count = 0;
  const result = await new DAGExecutor().execute([leaf('A', { run: () => count++ })], { signal: AbortSignal.abort() });
  assert.equal(count, 0);
  assert.equal(result.tasks[0].status, 'FAILED');
  assert.deepEqual((await new DAGExecutor().execute([])).tasks, []);
});

test('throwing/mutating observers cannot corrupt execution and unsubscribe works', async () => {
  const executor = new DAGExecutor();
  executor.onTasksUpdated((tasks) => { tasks[0].status = 'FAILED'; throw new Error('observer'); });
  executor.onOfficeUpdated(() => { throw new Error('observer'); });
  let count = 0;
  const off = executor.onOfficeUpdated(() => count++);
  off();
  const result = await executor.execute([leaf('A')]);
  assert.equal(result.tasks[0].status, 'COMPLETED');
  const snapshot = executor.getTasks();
  snapshot[0].status = 'FAILED';
  assert.equal(executor.getTasks()[0].status, 'COMPLETED');
  assert.equal(count, 0);
});

test('router separates chat and DAG, rejects contradictory or incomplete requests', async () => {
  const executor = new DAGExecutor();
  let officeEvents = 0;
  executor.onOfficeUpdated(() => officeEvents++);
  const router = new UniversalTriageRouter(executor, (message) => `reply:${message}`);
  assert.deepEqual(await router.route({ message: 'Explain a DAG' }), { path: 'FAST', response: 'reply:Explain a DAG' });
  assert.equal(officeEvents, 0);
  const result = await router.route({ message: 'Execute', tasks: [leaf('A')] });
  assert.equal(result.path, 'DAG');
  assert.ok(officeEvents > 0);
  assert.throws(() => router.classify({ message: ' ', tasks: [leaf('A')] }));
  assert.throws(() => router.classify({ message: 'run', path: 'DAG' }));
  assert.throws(() => router.classify({ message: 'chat', path: 'FAST', tasks: [leaf('A')] }));
  await assert.rejects(router.route({ message: 'hello' }, { signal: AbortSignal.abort() }));
});
