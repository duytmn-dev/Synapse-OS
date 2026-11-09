import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkProviderKey } from '../../src/adapters/ProviderProbe.ts';
import { ProviderRegistry } from '../../src/adapters/ProviderRegistry.ts';
import { CodexBrowserAuth } from '../../src/adapters/CodexBrowserAuth.ts';
import { ClaudeBrowserAuth } from '../../src/adapters/ClaudeBrowserAuth.ts';
import { AntigravityBrowserAuth } from '../../src/adapters/AntigravityBrowserAuth.ts';
import { CLIError } from '../../src/adapters/CLIAdapter.ts';
import { ChatGPTViaCodexAuth } from '../../src/main/ChatGPTViaCodexAuth.ts';
import { WorkspaceError } from '../../src/core/workspace/WorkspacePaths.ts';
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

test('ChatGPT reuses Codex login and can unlink without logging out Codex', async (t) => {
  const store = new SettingsStore(fixture(t));
  const calls: string[] = [];
  const auth = new ChatGPTViaCodexAuth(store, { action: async (action) => {
    calls.push(action);
    return { connection_status: 'CONNECTED', auth_method: 'ChatGPT · OAuth', quota_5h_percent: 0, quota_week_percent: 24 };
  } });
  const linked = await auth.action('CONNECT');
  assert.equal(linked.connection_status, 'CONNECTED');
  assert.equal(linked.quota_shared_with, 'codex');
  assert.equal(linked.quota_5h_percent, 0);
  assert.equal(linked.quota_week_percent, 24);
  assert.equal((await auth.action('DISCONNECT')).connection_status, 'DISCONNECTED');
  assert.equal((await auth.action('CHECK_CLI')).connection_status, 'DISCONNECTED');
  assert.deepEqual(calls, ['CHECK_CLI']);
  assert.equal((await auth.action('CONNECT')).connection_status, 'CONNECTED');
});

test('Claude login and logout require verified CLI status and never invent quota', async (t) => {
  let loggedIn = false;
  const calls: string[] = [];
  const root = fixture(t);
  const auth = new ClaudeBrowserAuth(root, async (request) => {
    assert.equal(request.env?.CLAUDE_CONFIG_DIR, path.join(root, 'claude-account'));
    assert.equal(request.args?.[0], 'auth');
    const command = request.args![1];
    calls.push(command);
    if (command === 'login') loggedIn = true;
    if (command === 'logout') loggedIn = false;
    const result = { stdout: JSON.stringify({ loggedIn, authMethod: loggedIn ? 'claude.ai' : 'none', email: 'hidden@example.invalid' }),
      stderr: '', exitCode: command === 'status' && !loggedIn ? 1 : 0 };
    if (result.exitCode === 1) throw new CLIError('CLI exited with code 1', result);
    return result;
  });
  const connected = await auth.action('CONNECT');
  assert.equal(connected.connection_status, 'CONNECTED');
  assert.equal(connected.quota_5h_percent, null);
  assert.equal(connected.account_hint, 'h•••@example.invalid');
  assert.doesNotMatch(JSON.stringify(connected), /hidden@example/);
  assert.equal((await auth.action('DISCONNECT')).connection_status, 'DISCONNECTED');
  assert.deepEqual(calls, ['login', 'status', 'logout', 'status']);
});

test('Antigravity ACP verifies login, reads advertised quota and returns chat replies', async (t) => {
  const root = fixture(t);
  const script = path.join(root, 'agy-fixture.cjs');
  const marker = path.join(root, 'signed-in');
  writeFileSync(script, `
    const fs = require('node:fs');
    const marker = process.argv[2];
    const update = (sessionId, update) => console.log(JSON.stringify({
      jsonrpc: '2.0', method: 'session/update', params: { sessionId, update }
    }));
    require('node:readline').createInterface({ input: process.stdin }).on('line', (line) => {
      const { id, method, params } = JSON.parse(line);
      let result;
      if (method === 'initialize') {
        if (params.protocolVersion !== 1) process.exit(2);
        result = { protocolVersion: 1, authMethods: [{ id: 'oauth-personal' }], agentCapabilities: { auth: { logout: {} } } };
      } else if (method === 'authenticate') {
        if (params.methodId !== 'oauth-personal') process.exit(3);
        fs.writeFileSync(marker, 'signed-in');
        result = {};
      } else if (method === 'logout') {
        fs.rmSync(marker, { force: true });
        result = {};
      } else if (method === 'session/new' && fs.existsSync(marker)) {
        if (params.mcpServers.length !== 0) process.exit(4);
        if (!fs.existsSync(marker + '.no-usage')) update('test-session',
          { sessionUpdate: 'available_commands_update', availableCommands: [{ name: 'usage' }] });
        result = { sessionId: 'test-session', configOptions: [
          { category: 'model', type: 'select', currentValue: 'test-model', options: [
            { group: 'default', options: [{ value: 'test-model', name: 'Test Model' }] }
          ] }
        ], _meta: { antigravity: { tier: { name: 'Test Plan' } } } };
      } else if (method === 'session/prompt') {
        const text = params.prompt[0].text;
        fs.appendFileSync(marker + '.prompts', text + '\\n');
        if (text !== '/usage' && !process.argv.includes('--sandbox')) process.exit(5);
        update('another-session', { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ignore me' } });
        update(params.sessionId, { sessionUpdate: 'agent_message_chunk', content: {
          type: 'text', text: text === '/usage' ? 'Gemini weekly: 62% remaining' : 'Gemini response.'
        } });
        result = { stopReason: 'end_turn' };
      }
      console.log(JSON.stringify(result
        ? { jsonrpc: '2.0', id, result }
        : { jsonrpc: '2.0', id, error: { code: -32000, message: 'Authentication required' } }));
    });
  `);
  const auth = new AntigravityBrowserAuth(root, [process.execPath, script, marker]);
  assert.equal((await auth.action('CHECK_CLI')).connection_status, 'DISCONNECTED');
  await assert.rejects(auth.sendMessage('Hello'), /AGY_AUTH_REQUIRED/);
  const connected = await auth.action('CONNECT');
  assert.equal(connected.connection_status, 'CONNECTED');
  assert.equal(connected.quota_week_percent, null);
  assert.equal(connected.worker_model_name, 'Test Model');
  assert.equal(connected.account_plan, 'Test Plan');
  assert.equal((await auth.action('REFRESH')).quota_report, 'Gemini weekly: 62% remaining');
  assert.equal(await auth.sendMessage('Xin chào'), 'Gemini response.');
  writeFileSync(marker + '.no-usage', '');
  assert.equal((await auth.action('REFRESH')).quota_report, undefined);
  assert.equal((readFileSync(marker + '.prompts', 'utf8').match(/^\/usage$/gm) ?? []).length, 1);
  assert.equal((await auth.action('DISCONNECT')).connection_status, 'DISCONNECTED');
});

test('a missing optional CLI does not hide a working account and its partial quota', async (t) => {
  const root = fixture(t);
  const settings = new SettingsService(root, noSecrets, undefined, new ProviderRegistry(root, {
    action: async () => ({ connection_status: 'CONNECTED', auth_method: 'OAuth', quota_5h_percent: 0, quota_week_percent: null }),
  }, {
    claude: { display_name: 'Claude', role_description: 'Claude Code', auth: { action: async () => {
      throw new WorkspaceError('CLAUDE_CLI_NOT_FOUND', 'test CLI missing');
    } } },
  }));
  const { agents } = await settings.network();
  assert.equal(agents.find((a) => a.agent_id === 'codex')?.quota_5h_percent, 0);
  assert.equal(agents.find((a) => a.agent_id === 'claude')?.connection_status, 'DISCONNECTED');
  await assert.rejects(settings.action('claude', 'CONNECT'), /CLAUDE_CLI_NOT_FOUND/);
});

test('built-in Codex uses browser OAuth without provider config and reads actual quota windows', async (t) => {
  const root = fixture(t);
  const script = path.join(root, 'codex-fixture.cjs');
  writeFileSync(script, `
    const fs = require('node:fs');
    const path = require('node:path');
    const readline = require('node:readline');
    const session = path.join(process.env.CODEX_HOME, 'fixture-session');
    const send = (message) => process.stdout.write(JSON.stringify(message) + '\\n');
    readline.createInterface({ input: process.stdin }).on('line', (line) => {
      const { id, method, params } = JSON.parse(line);
      if (id === undefined) return;
      let result = {};
      if (method === 'account/login/start') {
        if (params.type !== 'chatgpt') process.exit(2);
        result = { type: 'chatgpt', loginId: 'test', authUrl: 'https://auth.openai.com/oauth/authorize' };
      } else if (method === 'account/read') {
        result = { account: fs.existsSync(session) ? { type: 'chatgpt', email: 'private@example.invalid', planType: 'plus' } : null };
      } else if (method === 'account/rateLimits/read') {
        result = { rateLimits: { primary: { windowDurationMins: 15, usedPercent: 99 }, secondary: { windowDurationMins: 10080, usedPercent: 27 } } };
      } else if (method === 'account/logout') {
        fs.rmSync(session, { force: true });
      }
      send({ id, result });
      if (method === 'account/login/start') {
        const timer = setInterval(() => {
          if (!fs.existsSync(session)) return;
          clearInterval(timer);
          send({ method: 'account/login/completed', params: { loginId: 'test', success: true } });
        }, 25);
        timer.unref();
      }
    });
  `);
  const opened: string[] = [];
  const auth = new CodexBrowserAuth(root, async (url) => {
    opened.push(url);
    writeFileSync(path.join(root, 'codex-account', 'fixture-session'), 'fixture only');
  }, [process.execPath, script]);
  const service = new SettingsService(root, noSecrets, undefined, new ProviderRegistry(root, auth));
  assert.equal((await service.network()).agents[0].connection_status, 'DISCONNECTED');
  const profile = await service.action('codex', 'CONNECT');
  assert.deepEqual(opened, ['https://auth.openai.com/oauth/authorize']);
  assert.equal(profile.connection_status, 'CONNECTED');
  assert.equal(profile.quota_5h_percent, null);
  assert.equal(profile.quota_week_percent, 27);
  assert.equal(profile.account_hint, 'p•••@example.invalid');
  assert.equal(profile.account_plan, 'plus');
  assert.doesNotMatch(JSON.stringify(profile), /private@example/);
  assert.equal((await service.action('codex', 'REFRESH')).connection_status, 'CONNECTED');
  assert.equal((await service.action('codex', 'DISCONNECT')).connection_status, 'DISCONNECTED');
});

test('Codex cannot open a non-OpenAI authorization URL', async (t) => {
  const root = fixture(t);
  const script = path.join(root, 'codex-fixture.cjs');
  writeFileSync(script, `
    require('node:readline').createInterface({ input: process.stdin }).on('line', (line) => {
      const { id, method } = JSON.parse(line);
      if (id === undefined) return;
      const result = method === 'account/login/start'
        ? { type: 'chatgpt', loginId: 'test', authUrl: 'https://auth.openai.com.example.invalid/oauth/authorize' } : {};
      console.log(JSON.stringify({ id, result }));
    });
  `);
  let opened = false;
  const auth = new CodexBrowserAuth(root, async () => { opened = true; }, [process.execPath, script]);
  await assert.rejects(auth.action('CONNECT'), /CODEX_LOGIN_URL_INVALID/);
  assert.equal(opened, false);
});

if (process.env.SYNAPSE_CODEX_AUTH_SMOKE === '1') {
  test('installed Codex creates and cancels an official browser login from isolated AppData', async (t) => {
    const root = fixture(t);
    let host: string | undefined;
    const auth = new CodexBrowserAuth(root, async (url) => {
      host = new URL(url).hostname;
      throw new Error('Test cancels before opening a browser');
    });
    assert.equal((await auth.action('CHECK_CLI')).connection_status, 'DISCONNECTED');
    await assert.rejects(auth.action('CONNECT'), /CODEX_BROWSER_OPEN_FAILED/);
    assert.ok(host === 'auth.openai.com' || host === 'chatgpt.com');
    assert.equal((await auth.action('CHECK_CLI')).connection_status, 'DISCONNECTED');
  });
}

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
