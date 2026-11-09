import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkProviderKey } from '../../src/adapters/ProviderProbe.ts';
import { ProviderRegistry } from '../../src/adapters/ProviderRegistry.ts';
import { SettingsStore } from '../../src/main/SettingsStore.ts';
import { SettingsService } from '../../src/main/SettingsService.ts';
import { SystemSettingsService } from '../../src/main/SystemSettingsService.ts';
import { createSettingsHandlers } from '../../src/main/SettingsHandlers.ts';
import type { AgentId } from '../../src/shared/types';

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'synapse-settings-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('synapse-settings-'));
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}
const noSecrets = { read: async () => null, save: async () => { throw new Error('Unexpected secret write'); } };

test('unconfigured Settings returns explicit errors instead of fake provider/quotas', async (t) => {
  const root = fixture(t);
  const settings = new SettingsService(root, noSecrets);
  const handlers = createSettingsHandlers(settings, new SystemSettingsService(root, '1.2.3'));
  await assert.rejects(handlers.getAINetworkSettings(), /PROVIDER_NOT_CONFIGURED/);
  await assert.rejects(handlers.agentConnectionAction('gemini', 'CHECK_CLI'), /PROVIDER_NOT_CONFIGURED/);
  await assert.rejects(handlers.getAppearanceSettings(), /APPEARANCE_NOT_CONFIGURED/);
  await assert.rejects(handlers.agentConnectionAction('codex', 'CHECK_API'), /API_KEY_NOT_CONFIGURED/);
  await assert.rejects(handlers.setAgentAlertThreshold('codex', NaN), /INVALID_SETTINGS/);
  await assert.rejects(handlers.setFallbackOnError('codex', 'yes' as unknown as boolean), /INVALID_SETTINGS/);
  await assert.rejects(handlers.ensureToolDependency('graphify'), /TOOL_INSTALL_NOT_CONFIGURED/);
  assert.deepEqual(await handlers.getUpdateStatus(), { current_version: '1.2.3', has_dev_build_ready: false });
});

test('appearance persists exact fields and concurrent settings changes are not lost', async (t) => {
  const root = fixture(t);
  const service = new SettingsService(root, noSecrets);
  const appearance = { startup_behavior: 'NEW_SESSION', graph_render_fps: 'POWER_SAVE_30FPS', enable_graph_glow: false,
    enable_path_lights_up: true, enable_task_sound: false } as const;
  await service.saveAppearance(appearance);
  assert.deepEqual(await new SettingsService(root, noSecrets).appearance(), appearance);
  await assert.rejects(service.saveAppearance({ ...appearance, graph_render_fps: 'bad' } as never), /INVALID_SETTINGS/);
  const store = new SettingsStore(root);
  await Promise.all([store.update((s) => { s.defaultAgent = 'codex'; }), store.update((s) => { s.agents.gemini = { threshold: 75 }; })]);
  assert.equal((await store.read()).defaultAgent, 'codex');
  assert.equal((await store.read()).agents.gemini!.threshold, 75);
  assert.ok(!readFileSync(path.join(root, 'settings.json'), 'utf8').includes('api_key'));
});

test('configured native status command is executed; malformed/unknown quota fails explicitly', async (t) => {
  const root = fixture(t);
  const statusFile = path.join(root, 'status.json');
  const marker = path.join(root, 'checked');
  const configuration = { codex: { display_name: 'Codex test fixture', role_description: 'Integration test only', commands: {
    status: { executable: process.execPath, args: ['-e', 'process.stdout.write(require("node:fs").readFileSync(process.argv[1]))', statusFile] },
    check_cli: { executable: process.execPath, args: ['-e', 'require("node:fs").writeFileSync(process.argv[1],"checked")', marker] },
  } } };
  writeFileSync(path.join(root, 'agent-providers.json'), JSON.stringify(configuration));
  writeFileSync(statusFile, JSON.stringify({ connection_status: 'CONNECTED', auth_method: 'test fixture', quota_5h_percent: 23, quota_week_percent: 44 }));
  const registry = new ProviderRegistry(root);
  assert.equal((await registry.action('codex', 'CHECK_CLI')).quota_5h_percent, 23);
  assert.equal(readFileSync(marker, 'utf8'), 'checked');
  const service = new SettingsService(root, noSecrets);
  assert.equal((await service.setDefault('codex')).default_chat_agent_id, 'codex');
  assert.equal((await service.threshold('codex', 72)).alert_threshold_percent, 72);
  assert.equal((await new SettingsService(root, noSecrets).profile('codex')).alert_threshold_percent, 72);
  await assert.rejects(service.fallback('codex', true), /API_KEY_UNVERIFIED/);
  writeFileSync(statusFile, JSON.stringify({ connection_status: 'CONNECTED', auth_method: 'test fixture' }));
  await assert.rejects(registry.status('codex'), /QUOTA_UNAVAILABLE/);
  await assert.rejects(registry.action('codex', 'CONNECT'), /PROVIDER_ACTION_UNAVAILABLE/);
});

test('API probes use fixed endpoints, correct headers, no redirects and no leaked errors', async () => {
  for (const agent of ['codex', 'chatgpt', 'gemini', 'claude'] as const) {
    const key = 'test-only-secret';
    const transport: typeof fetch = async (url, init) => {
      assert.equal(new URL(String(url)).protocol, 'https:');
      assert.equal(init!.redirect, 'error');
      const headers = init!.headers as Record<string, string>;
      assert.equal(headers[agent === 'gemini' ? 'x-goog-api-key' : agent === 'claude' ? 'x-api-key' : 'Authorization'], agent === 'codex' || agent === 'chatgpt' ? `Bearer ${key}` : key);
      return Response.json(agent === 'gemini' ? { models: [] } : { data: [] });
    };
    assert.equal(await checkProviderKey(agent, key, transport), true);
    assert.equal(await checkProviderKey(agent, key, async () => new Response(null, { status: 401 })), false);
    await assert.rejects(checkProviderKey(agent, key, async () => new Response(key, { status: 500 })), (error: Error) => /API_CHECK_FAILED/.test(error.message) && !error.message.includes(key));
    await assert.rejects(checkProviderKey(agent, key, async () => { throw new Error(key); }), (error: Error) => error.message.startsWith('API_CONNECTION_FAILED') && !error.message.includes(key));
    await assert.rejects(checkProviderKey(agent, key, async () => Response.json({ unexpected: true })), /API_RESPONSE_INVALID/);
  }
});

test('staged updates require a real file with matching SHA-256', async (t) => {
  const root = fixture(t);
  const directory = path.join(root, 'updates'); mkdirSync(directory);
  const artifact = Buffer.from('test artifact bytes');
  writeFileSync(path.join(directory, 'update.exe'), artifact);
  writeFileSync(path.join(directory, 'ready.json'), JSON.stringify({ version: '2.0.0', filename: 'update.exe', sha256: createHash('sha256').update(artifact).digest('hex') }));
  const system = new SystemSettingsService(root, '1.0.0');
  assert.deepEqual(await system.updates(), { current_version: '1.0.0', has_dev_build_ready: true, dev_build_version: '2.0.0' });
  writeFileSync(path.join(directory, 'update.exe'), 'corrupt');
  await assert.rejects(system.updates(), /UPDATE_ARTIFACT_INVALID/);
});

if (process.env.SYNAPSE_PROVIDER_SMOKE === '1') {
  for (const agent of ['codex', 'gemini', 'claude'] as AgentId[]) {
    test(`live ${agent} API rejects an invalid key without model generation`, { timeout: 20000 }, async () => {
      assert.equal(await checkProviderKey(agent, 'synapse-deliberately-invalid-key'), false);
    });
  }
}
