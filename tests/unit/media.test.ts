import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { LocalMediaTools } from '../../src/media/LocalMediaTools.ts';
import type { CLIRunner, CLIRequest } from '../../src/adapters/CLIAdapter.ts';

const root = path.dirname(fileURLToPath(import.meta.url));
const binary = Buffer.from('test-only-ffmpeg-fixture');
const digest = createHash('sha256').update(binary).digest('hex');
const artifact = { url: 'https://example.invalid/ffmpeg.gz', sha256: digest, gzip: true };
const success: CLIRunner = async () => ({ stdout: 'ffmpeg fixture', stderr: '', exitCode: 0 });

async function fixture(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const directory = await mkdtemp(path.join(root, '.media-test-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), root);
    assert.ok(path.basename(directory).startsWith('.media-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('FFmpeg is lazy, verifies download, caches it and serializes concurrent installations', async (t) => {
  const directory = await fixture(t);
  let downloads = 0;
  const fetcher = (async () => { downloads++; return new Response(gzipSync(binary)); }) as typeof fetch;
  const options = { dataDirectory: directory, artifact, fetch: fetcher, runner: success };
  const first = new LocalMediaTools(options);
  assert.deepEqual(await readdir(directory), []);
  assert.equal(downloads, 0);
  const results = await Promise.all([first.ensureToolDependencies(), new LocalMediaTools(options).ensureToolDependencies()]);
  assert.equal(results[0], results[1]);
  assert.equal(downloads, 1);
  assert.deepEqual(await readFile(first.executable), binary);
  await first.ensureToolDependencies(); assert.equal(downloads, 1);
  assert.deepEqual(await readdir(first.directory), [path.basename(first.executable)]);
});

test('corrupt cache is replaced; corrupt download is rejected and can be retried', async (t) => {
  const directory = await fixture(t);
  let corrupt = true;
  const fetcher = (async () => new Response(gzipSync(corrupt ? Buffer.from('corrupt') : binary))) as typeof fetch;
  const media = new LocalMediaTools({ dataDirectory: directory, artifact, fetch: fetcher, runner: success });
  await assert.rejects(media.ensureToolDependencies(), /integrity/);
  assert.deepEqual(await readdir(media.directory), []);
  corrupt = false; await media.ensureToolDependencies();
  await writeFile(media.executable, 'broken');
  await media.ensureToolDependencies();
  assert.deepEqual(await readFile(media.executable), binary);
});

test('HTTP errors, oversized binaries and cancellation leave no partial install', async (t) => {
  const directory = await fixture(t);
  for (const fetcher of [
    (async () => new Response(null, { status: 503 })) as typeof fetch,
    (async () => new Response(gzipSync(binary))) as typeof fetch,
  ]) {
    const media = new LocalMediaTools({ dataDirectory: directory, artifact, fetch: fetcher, runner: success, maxDownloadBytes: 2 });
    await assert.rejects(media.ensureToolDependencies());
    assert.deepEqual(await readdir(media.directory), []);
  }
  const media = new LocalMediaTools({ dataDirectory: directory, artifact, runner: success });
  await assert.rejects(media.ensureToolDependencies({ signal: AbortSignal.abort() }));
  assert.deepEqual(await readdir(media.directory), []);
});

test('abandoned installation lock has a bounded wait', { timeout: 2000 }, async (t) => {
  const directory = await fixture(t);
  const media = new LocalMediaTools({ dataDirectory: directory, artifact, runner: success, installTimeoutMs: 50 });
  await mkdir(path.join(media.directory, '.install-lock'), { recursive: true });
  await assert.rejects(media.ensureToolDependencies());
});

test('trim and concat use argument arrays, refuse overwrite, and clean concat lists', async (t) => {
  const directory = await fixture(t);
  const calls: CLIRequest[] = [];
  let listing = '';
  let fail = false;
  const runner: CLIRunner = async (request) => {
    calls.push(request);
    const args = request.args ?? [];
    if (args.includes('concat')) listing = await readFile(args[args.indexOf('-i') + 1], 'utf8');
    if (fail && args[0] !== '-version') throw new Error('media failed');
    return { stdout: '', stderr: '', exitCode: 0 };
  };
  const media = new LocalMediaTools({ dataDirectory: directory, artifact, runner,
    fetch: (async () => new Response(gzipSync(binary))) as typeof fetch });
  await media.trim('a b.mp4', 'out.mp4', 1.5, 2);
  assert.ok(calls.at(-1)!.args!.includes(path.resolve('a b.mp4')));
  assert.ok(calls.at(-1)!.args!.includes('-n'));
  await media.concat(["a'b.mp4", 'other.mp4'], 'joined.mp4');
  assert.ok(listing.includes("a'\\''b.mp4"));
  assert.equal((await readdir(media.directory)).filter((name) => name.endsWith('.txt')).length, 0);
  fail = true;
  await assert.rejects(media.concat(['a.mp4', 'b.mp4'], 'joined.mp4'), /media failed/);
  assert.equal((await readdir(media.directory)).filter((name) => name.endsWith('.txt')).length, 0);
  await assert.rejects(media.trim('same.mp4', 'same.mp4', 0, 1));
  await assert.rejects(media.trim('a.mp4', 'out.mp4', -1, 1));
  await assert.rejects(media.concat(['a\n.mp4', 'b.mp4'], 'out.mp4'));
});

test('real FFmpeg lazy download, audio generation, trim and concat', {
  skip: process.env.SYNAPSE_MEDIA_SMOKE !== '1', timeout: 240_000,
}, async (t) => {
  const directory = await fixture(t);
  const media = new LocalMediaTools({ dataDirectory: directory });
  const input = path.join(directory, 'tone.wav');
  const clip = path.join(directory, 'clip.wav');
  const output = path.join(directory, 'joined.wav');
  await media.runFFmpeg(['-n', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', input]);
  await media.trim(input, clip, 0.25, 0.5);
  await media.concat([clip, clip], output);
  const decoded = await media.runFFmpeg(['-i', output, '-f', 'null', '-']);
  assert.match(decoded.stderr, /Duration: 00:00:01\.00/);
  assert.ok((await readFile(output)).length > 1000);
});
