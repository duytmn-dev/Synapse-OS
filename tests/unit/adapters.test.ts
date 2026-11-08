import test from 'node:test';
import assert from 'node:assert/strict';
import { runCLI, CLIAdapter, JSONLinesCLIAdapter, CLIError } from '../../src/adapters/CLIAdapter.ts';
import { Blackboard } from '../../src/adapters/Blackboard.ts';
import { QuotaTracker, FIVE_HOURS_MS, WEEK_MS } from '../../src/adapters/QuotaTracker.ts';

test('CLI transports stdin/arguments literally and keeps stderr separate', async () => {
  const prompt = 'xin chào "quoted"; $(echo injected) & | < >';
  const result = await runCLI({ executable: process.execPath,
    args: ['-e', 'process.stdin.pipe(process.stdout); process.stderr.write(process.argv[1]);', prompt], stdin: prompt });
  assert.equal(result.stdout, prompt);
  assert.equal(result.stderr, prompt);
  assert.equal(result.exitCode, 0);
});

test('CLI preserves split UTF-8 and streams output', async () => {
  const pieces: string[] = [];
  const result = await runCLI({ executable: process.execPath, args: ['-e',
    'const b=Buffer.from("Việt");process.stdout.write(b.subarray(0,3));setTimeout(()=>process.stdout.write(b.subarray(3)),20);'],
    onOutput: (_stream, text) => pieces.push(text) });
  assert.equal(result.stdout, 'Việt');
  assert.equal(pieces.join(''), 'Việt');
});

test('CLI handles nonzero exit, missing binary and rejects shell shims', async () => {
  await assert.rejects(runCLI({ executable: process.execPath, args: ['-e', 'process.stderr.write("failure");process.exit(7)'] }),
    (error: unknown) => error instanceof CLIError && error.result.exitCode === 7 && error.result.stderr === 'failure');
  await assert.rejects(runCLI({ executable: 'synapse-definitely-missing-executable' }), /ENOENT/);
  await assert.rejects(runCLI({ executable: 'agent.cmd' }), /native executable/);
});

test('CLI timeout, cancellation and output overflow settle without hanging', { timeout: 10000 }, async () => {
  await assert.rejects(runCLI({ executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], timeoutMs: 100 }), /timed out/);
  const controller = new AbortController();
  await assert.rejects(runCLI({ executable: process.execPath, signal: controller.signal,
    args: ['-e', 'console.log("ready");setInterval(()=>{},1000)'], onOutput: () => controller.abort() }), /cancelled/);
  await assert.rejects(runCLI({ executable: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(10000))'], maxOutputBytes: 10 }), /output limit/);
  await assert.rejects(runCLI({ executable: process.execPath, signal: AbortSignal.abort() }));
});

test('CLI adapters support configured commands and newline JSON streams', async () => {
  const adapter = new CLIAdapter({ executable: process.execPath, args: ['-e', 'process.stdin.pipe(process.stdout)'] });
  assert.equal((await adapter.run('hello')).stdout, 'hello');
  const events: unknown[] = [];
  const json = new JSONLinesCLIAdapter({ executable: process.execPath, args: ['-e',
    'process.stdout.write("{\\"part\\":");setTimeout(()=>process.stdout.write("1}\\n{\\"done\\":true}"),10)'] });
  assert.deepEqual(await json.runJSON('', { onEvent: (event) => events.push(event) }), [{ part: 1 }, { done: true }]);
  assert.equal(events.length, 2);
  const bad = new JSONLinesCLIAdapter({ executable: process.execPath, args: ['-e', 'console.log("not json")'] });
  await assert.rejects(bad.runJSON(''));
});

test('quota windows exclude exact left boundaries and include current usage', () => {
  let now = WEEK_MS * 2;
  const tracker = new QuotaTracker(() => now);
  tracker.configure('codex', { fiveHours: 100, week: 1000 });
  tracker.record('codex', { id: 'outside', units: 900, timestamp: now - WEEK_MS });
  tracker.record('codex', { id: 'week', units: 200, timestamp: now - WEEK_MS + 1 });
  tracker.record('codex', { id: 'edge5h', units: 100, timestamp: now - FIVE_HOURS_MS });
  tracker.record('codex', { id: 'recent', units: 25, timestamp: now });
  assert.deepEqual(tracker.getStats(), [{ agent_id: 'codex', usage_5h_percent: 25, usage_week_percent: 32.5 }]);
  now += FIVE_HOURS_MS;
  assert.equal(tracker.getStats()[0].usage_5h_percent, 0);
  now += WEEK_MS;
  assert.equal(tracker.getStats()[0].usage_week_percent, 0);
});

test('quota rejects invalid data, deduplicates retries, separates agents and caps overflow', () => {
  const tracker = new QuotaTracker(() => 1000);
  tracker.configure('codex', { fiveHours: 3, week: 10 });
  tracker.configure('claude', { fiveHours: 100, week: 100 });
  const record = { id: 'usage1', units: 1, timestamp: 1000 };
  tracker.record('codex', record); tracker.record('codex', record);
  assert.ok(Math.abs(tracker.getStats()[0].usage_5h_percent - 100 / 3) < 1e-12);
  assert.equal(tracker.getStats()[1].usage_week_percent, 0);
  assert.throws(() => tracker.record('codex', { ...record, units: 2 }), /Conflicting/);
  assert.throws(() => tracker.record('unknown', record));
  assert.throws(() => tracker.configure('x', { fiveHours: 0, week: 10 }));
  for (const units of [-1, NaN, Infinity, 1.5]) assert.throws(() => tracker.record('codex', { id: 'bad', units, timestamp: 0 }));
  assert.throws(() => tracker.record('codex', { id: 'future', units: 1, timestamp: 1001 }));
  tracker.record('codex', { id: 'large1', units: Number.MAX_SAFE_INTEGER, timestamp: 1000 });
  tracker.record('codex', { id: 'large2', units: Number.MAX_SAFE_INTEGER, timestamp: 1000 });
  assert.equal(tracker.getStats()[0].usage_week_percent, 100);
});

test('quota observers receive fresh snapshots and unsubscribe', () => {
  let now = WEEK_MS;
  const tracker = new QuotaTracker(() => now);
  tracker.configure('codex', { fiveHours: 100, week: 100 });
  let updates = 0;
  const off = tracker.onUpdated((stats) => { updates++; stats[0].usage_5h_percent = -1; });
  tracker.onUpdated(() => { throw new Error('observer'); });
  tracker.record('codex', { id: 'a', units: 20, timestamp: now });
  assert.equal(tracker.getStats()[0].usage_5h_percent, 20);
  now += FIVE_HOURS_MS; tracker.refresh();
  assert.equal(updates, 2);
  off(); tracker.refresh(); assert.equal(updates, 2);
});

test('Blackboard clones values, rejects stale writes and prevents ABA after delete', () => {
  const board = new Blackboard();
  const value = { text: 'original' };
  const written = board.write('task:A', value, 0);
  value.text = 'changed'; written.value.text = 'changed';
  assert.equal(board.read<typeof value>('task:A')?.value.text, 'original');
  const snapshot = board.read<typeof value>('task:A')!;
  snapshot.value.text = 'also changed';
  assert.equal(board.read<typeof value>('task:A')?.value.text, 'original');
  assert.throws(() => board.write('task:A', {}, 0), /conflict/);
  assert.equal(board.delete('task:A', 1), true);
  assert.equal(board.read('task:A'), undefined);
  assert.throws(() => board.write('task:A', {}, 1), /conflict/);
  assert.equal(board.write('task:A', {}, 2).revision, 3);
});
