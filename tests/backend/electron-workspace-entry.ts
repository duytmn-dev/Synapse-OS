// Executed only by electron-workspace.test.ts in an isolated temporary appData directory.
import { app, BrowserWindow, ipcMain } from 'electron';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createWorkspaceRuntime } from '../../src/main/WorkspaceRuntime.ts';
import { createWorkspaceHandlers } from '../../src/main/WorkspaceHandlers.ts';
import { registerPhase0Handlers } from '../../src/main/Phase0Handlers.ts';
import { SecretStore } from '../../src/main/SecretStore.ts';
import { SettingsService } from '../../src/main/SettingsService.ts';
import { SystemSettingsService } from '../../src/main/SystemSettingsService.ts';
import { createSettingsHandlers, registerSettingsCredentials } from '../../src/main/SettingsHandlers.ts';
import { GraphActivity } from '../../src/core/GraphActivity.ts';
import { GraphEventBridge } from '../../src/main/GraphEventBridge.ts';
import { CodexBrowserAuth } from '../../src/adapters/CodexBrowserAuth.ts';
import { ProviderRegistry } from '../../src/adapters/ProviderRegistry.ts';
import { createChatHandlers } from '../../src/main/ChatHandlers.ts';

const root = process.env.SYNAPSE_WORKSPACE_TEST_ROOT;
if (!root || !path.isAbsolute(root)) throw new Error('Missing isolated test directory');
app.setPath('appData', path.join(root, 'AppData'));
app.setPath('userData', path.join(root, 'AppData'));
const timer = setTimeout(() => { console.error('Electron workspace test timed out'); app.exit(1); }, 20000);
void app.whenReady().then(async () => {
  const manager = createWorkspaceRuntime(app);
  assert.equal(app.getPath('userData'), path.join(root, 'AppData', 'SynapseOS'));
  const window = new BrowserWindow({ show: false, webPreferences: {
    preload: path.join(path.dirname(fileURLToPath(import.meta.url)), 'preload.cjs'),
    sandbox: true, contextIsolation: true, nodeIntegration: false,
  } });
  const secrets = new SecretStore(path.join(app.getPath('userData'), 'secrets'));
  const settings = new SettingsService(app.getPath('userData'), secrets);
  const codexFixture = path.join(root, 'codex-chat-fixture.cjs');
  writeFileSync(codexFixture, `
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const emit = (data) => console.log(JSON.stringify(data));
    require('node:readline').createInterface({ input: process.stdin }).on('line', (line) => {
      const { id, method, params } = JSON.parse(line);
      if (id === undefined) return;
      let result = {};
      if (method === 'account/read') {
        assert.equal(path.basename(process.env.CODEX_HOME), 'codex-account');
        result = { account: { type: 'chatgpt' } };
      } else if (method === 'thread/start') {
        assert.equal(params.cwd, path.join(path.dirname(process.env.CODEX_HOME), 'codex-chat'));
        assert.equal(params.ephemeral, true);
        assert.equal(params.sandbox, 'read-only');
        assert.equal(params.approvalPolicy, 'never');
        result = { thread: { id: 'thread' } };
      } else if (method === 'turn/start') {
        assert.equal(params.threadId, 'thread');
        assert.equal(params.sandboxPolicy.type, 'readOnly');
        assert.equal(params.approvalPolicy, 'never');
        const [input] = params.input;
        assert.equal(input.type, 'text');
        emit({ method: 'item/completed', params: { threadId: 'foreign', turnId: 'other', item: { type: 'agentMessage', phase: 'final_answer', text: 'Other thread' } } });
        emit({ method: 'item/completed', params: { threadId: 'thread', turnId: 'turn', item: { type: 'agentMessage', phase: 'commentary', text: 'Internal progress' } } });
        if (input.text !== 'empty test') {
          emit({ method: 'item/completed', params: { threadId: 'thread', turnId: 'turn', item: { type: 'agentMessage', phase: 'final_answer', text: 'Codex reply to ' + input.text } } });
        }
        const status = input.text === 'quota test' ? 'failed' : 'completed';
        const error = status === 'failed' ? { codexErrorInfo: 'usageLimitExceeded' } : null;
        emit({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status, error } } });
        result = { turn: { id: 'turn' } };
      }
      emit({ id, result });
    });
  `);
  const node = process.env.SYNAPSE_TEST_NODE;
  assert.ok(node);
  const codex = new CodexBrowserAuth(app.getPath('userData'), async () => { throw new Error('Unexpected browser open'); }, [node, codexFixture]);
  const providers = new ProviderRegistry(app.getPath('userData'), codex, {}, { codex: (message) => codex.sendMessage(message) });
  let selectedDirectory: string | null = null;
  const dispose = registerPhase0Handlers(ipcMain, () => window.webContents, {
    ...createWorkspaceHandlers(manager, () => window.webContents, async () => selectedDirectory),
    ...createSettingsHandlers(settings, new SystemSettingsService(app.getPath('userData'), app.getVersion())),
    sendCodexMessage: (message) => codex.sendMessage(message),
    ...createChatHandlers(providers),
  });
  const disposeCredentials = registerSettingsCredentials(ipcMain, () => window.webContents, settings);
  const activity = new GraphActivity(manager);
  const graphBridge = new GraphEventBridge(activity, () => window.webContents);
  window.webContents.on('preload-error', (_event, _path, error) => { console.error(error); app.exit(1); });
  try {
    await window.loadURL('data:text/html,<html><body>Workspace integration test</body></html>');
    await assert.rejects(window.webContents.executeJavaScript("window.synapse.sendCodexMessage('quota test')"), /CODEX_CHAT_QUOTA/);
    await assert.rejects(window.webContents.executeJavaScript("window.synapse.sendCodexMessage('empty test')"), /CODEX_EMPTY_REPLY/);
    const sourcePath = path.join(root, 'source');
    assert.equal(await window.webContents.executeJavaScript('window.synapse.pickShadowProject()'), null);
    assert.deepEqual(manager.listProjects(), []);
    selectedDirectory = sourcePath;
    const opened = await window.webContents.executeJavaScript('window.synapse.pickShadowProject()');
    assert.equal(opened.original_path, sourcePath);
    const hash = opened.project_hash as string;
    await window.webContents.executeJavaScript(`window.graphEvents = []; window.stopGraph = window.synapse.onGraphActiveEvent(e => window.graphEvents.push(e)); void 0`);
    await activity.run({ project_hash: hash, agent_id: 'codex', worker_model_name: 'integration-test-model',
      target_node_id: 'keep.txt', file_path: 'keep.txt', source_node_id: 'entry.ts', mode: 'READING' }, () => readFileSync(path.join(root, 'source', 'keep.txt')));
    const graphEvents = await window.webContents.executeJavaScript('window.stopGraph(); window.graphEvents');
    assert.deepEqual(graphEvents.map((event: { action: string }) => event.action), ['FLOW_TRANSITION', 'READING', 'IDLE']);
    const testKey = 'test-only-encrypted-credential';
    await window.webContents.executeJavaScript(`window.synapse.saveAgentKey('codex', ${JSON.stringify(testKey)})`);
    assert.equal(await new SecretStore(path.join(app.getPath('userData'), 'secrets')).read('codex'), testKey);
    const encryptedFile = readdirSync(path.join(app.getPath('userData'), 'secrets'))[0];
    assert.equal(readFileSync(path.join(app.getPath('userData'), 'secrets', encryptedFile)).includes(Buffer.from(testKey)), false);
    const statusScript = path.join(app.getPath('userData'), 'test-status.cjs');
    // Test-only provider protocol fixture executed by a real native Node process.
    writeFileSync(statusScript, 'console.log(JSON.stringify({connection_status:"CONNECTED",auth_method:"test fixture",quota_5h_percent:12,quota_week_percent:34}))');
    writeFileSync(path.join(app.getPath('userData'), 'agent-providers.json'), JSON.stringify({ codex: {
      display_name: 'Test provider', role_description: 'Test fixture only', commands: {
        status: { executable: process.env.SYNAPSE_TEST_NODE, args: [statusScript] },
        check_cli: { executable: process.env.SYNAPSE_TEST_NODE, args: ['--version'] },
      },
    }, custom: {
      display_name: 'Custom Chat', role_description: 'Configured in the test',
      commands: { chat: { executable: node, args: ['-p', 'require("node:fs").readFileSync(0, "utf8")'] } },
    } }));
    const network = await window.webContents.executeJavaScript(`window.synapse.setDefaultChatAgent('codex')`);
    assert.equal(network.agents[0].fallback_api.api_key_masked, '••••••••');
    assert.equal(JSON.stringify(network).includes(testKey), false);
    assert.equal(network.agents[0].fallback_api.is_valid, false);
    assert.equal((await window.webContents.executeJavaScript(`window.synapse.agentConnectionAction('codex','CHECK_CLI')`)).connection_status, 'CONNECTED');
    assert.equal((await window.webContents.executeJavaScript(`window.synapse.setAgentAlertThreshold('codex',81)`)).alert_threshold_percent, 81);
    const appearance = { startup_behavior: 'NEW_SESSION', graph_render_fps: 'HIGH_60FPS', enable_graph_glow: true, enable_path_lights_up: true, enable_task_sound: false };
    await window.webContents.executeJavaScript(`window.synapse.saveAppearanceSettings(${JSON.stringify(appearance)})`);
    assert.deepEqual(await window.webContents.executeJavaScript('window.synapse.getAppearanceSettings()'), appearance);
    manager.setCoreRequirements(hash, 'Real Electron hydration');
    const result = await window.webContents.executeJavaScript(`(async () => {
      const notifications = [];
      const stop = window.synapse.onChatSessionsUpdated(sessions => notifications.push(sessions));
      const hash = ${JSON.stringify(hash)};
      const created = await window.synapse.mutateChatSession({action:'CREATE', project_hash:hash, new_title:'Electron chat'});
      const id = created[0].session_id;
      await window.synapse.mutateChatSession({action:'RENAME', project_hash:hash, session_id:id, new_title:'Renamed'});
      const pinned = await window.synapse.mutateChatSession({action:'TOGGLE_PIN', project_hash:hash, session_id:id});
      const projects = await window.synapse.getShadowProjects();
      const sessions = await window.synapse.getChatSessions(hash);
      const [standalone] = await window.synapse.mutateChatSession({action:'CREATE', project_hash:null, new_title:'Standalone chat'});
      const standaloneMessages = [{id:'one', author:'user', authorName:'Bạn', time:'12:34', text:'Standalone message', attachments:[]}];
      await window.synapse.saveChatMessages(null, standalone.session_id, standaloneMessages);
      const savedMessages = await window.synapse.getChatMessages(null, standalone.session_id);
      let isolationError;
      try { await window.synapse.getChatMessages(hash, standalone.session_id); } catch (caught) { isolationError = caught.message; }
      let error;
      try { await window.synapse.mutateChatSession({action:'CREATE',project_hash:hash}); } catch (caught) { error = caught.message; }
      stop();
      return {id, pinned, projects, sessions, notifications, error, savedMessages, standaloneMessages, isolationError, node:typeof require};
    })()`);
    assert.equal(result.node, 'undefined');
    assert.equal(result.pinned[0].is_pinned, true);
    assert.equal(result.sessions[0].title, 'Renamed');
    assert.equal(result.projects[0].project_hash, hash);
    assert.ok(result.notifications.length >= 3);
    assert.match(result.error, /INVALID_ARGUMENT/);
    assert.deepEqual(result.savedMessages, result.standaloneMessages);
    assert.match(result.isolationError, /SESSION_NOT_FOUND/);
    assert.equal(manager.getSessionContext(hash, result.id).core_requirements, 'Real Electron hydration');
    assert.equal(readFileSync(path.join(app.getPath('userData'), 'projects', hash, 'project.db')).subarray(0, 16).toString(), 'SQLite format 3\0');
    const deleted = await window.webContents.executeJavaScript(`window.synapse.mutateChatSession({action:'DELETE',project_hash:${JSON.stringify(hash)},session_id:${JSON.stringify(result.id)}})`);
    assert.deepEqual(deleted, []);

    const renderer = path.join(root, 'renderer', 'index.html');
    await window.loadFile(renderer);
    await window.webContents.executeJavaScript(`(async () => {
      const wait = async (find, label) => {
        for (let tries = 0; tries < 200; tries++) {
          const match = find();
          if (match) return match;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error('Renderer did not show ' + label);
      };
      const namedButton = (text, scope = document) =>
        [...scope.querySelectorAll('button')].find(button => button.textContent.trim() === text);
      const titleIs = (text) => document.querySelector('h1')?.textContent.trim() === text;
      const sidebar = await wait(() => document.querySelector('aside'), 'Sidebar');
      await wait(() => namedButton('Standalone chat', sidebar), 'standalone history');
      await wait(() => document.body.textContent.includes('Standalone message'), 'saved standalone message');
      const projectLabel = await wait(() => [...sidebar.querySelectorAll('span')].find(node =>
        node.textContent.trim() === 'source'), 'project');
      projectLabel.click();
      const newProjectChat = await wait(() => sidebar.querySelector('[aria-label="Tạo chat trong dự án source"]'), 'project chat button');
      newProjectChat.click();
      await wait(() => sidebar.querySelector('[aria-current="true"]')?.textContent.trim() === 'Cuộc trò chuyện 1', 'selected project chat');
      if (document.body.textContent.includes('Standalone message')) throw new Error('Standalone transcript leaked into project');
      namedButton('@Agent').click();
      await wait(() => namedButton('●Custom Chat') || [...document.querySelectorAll('li button')].find(button =>
        button.lastElementChild?.textContent.trim() === 'Custom Chat'), 'configured agent in the agent menu');
      const codexOption = await wait(() => [...document.querySelectorAll('li button')].find(button =>
        button.lastElementChild?.textContent.trim() === 'Codex'), 'Codex in the agent menu');
      codexOption.click();
      await wait(() => namedButton('@Codex'), 'selected Codex');
      const textarea = document.querySelector('textarea');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Project-only message');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      (await wait(() => { const send = namedButton('Gửi'); return send && !send.disabled && send; }, 'enabled send button')).click();
      await wait(() => document.body.textContent.includes('Codex reply to Project-only message'), 'Codex response');
      if (document.body.textContent.includes('Internal progress')) throw new Error('Codex commentary leaked into the final response');
      namedButton('Cuộc trò chuyện mới', sidebar).click();
      await wait(() => titleIs('Cuộc trò chuyện 2') && !sidebar.querySelector('[aria-label="Tạo chat trong dự án source"]'), 'new standalone chat');
      if (document.body.textContent.includes('Project-only message')) throw new Error('Project transcript leaked into standalone chat');
      namedButton('Standalone chat', sidebar).click();
      await wait(() => document.body.textContent.includes('Standalone message'), 'selected standalone transcript');
      projectLabel.click();
      await wait(() => document.body.textContent.includes('Project-only message'), 'selected project transcript');
    })()`);
    const standaloneChats = manager.listSessions(null);
    assert.equal(standaloneChats.length, 2);
    const [projectChat] = manager.listSessions(hash);
    assert.equal(manager.listSessions(hash).length, 1);
    const projectMessages = manager.readSessionMessages(hash, projectChat.session_id) as { authorName: string; text: string }[];
    assert.deepEqual(projectMessages.map(({ authorName, text }) => [authorName, text]),
      [['Bạn', 'Project-only message'], ['Codex', 'Codex reply to Project-only message']]);
    await window.loadFile(renderer);
    assert.ok(await window.webContents.executeJavaScript(`(async () => {
      for (let tries = 0; tries < 200; tries++) {
        const sidebar = document.querySelector('aside');
        if (sidebar?.textContent.includes('Standalone chat') && sidebar.textContent.includes('Cuộc trò chuyện 2')) {
          return !sidebar.textContent.includes('Cuộc trò chuyện 1') && !document.body.textContent.includes('Project-only message');
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      return false;
    })()`));
    console.log('ELECTRON_WORKSPACE_OK: isolated preload, real SQLite, IPC CRUD and separate sidebar histories');
  } finally { disposeCredentials(); graphBridge.dispose(); dispose(); manager.dispose(); window.destroy(); }
  clearTimeout(timer);
  app.exit(0);
}).catch((error: unknown) => { console.error(error); clearTimeout(timer); app.exit(1); });
