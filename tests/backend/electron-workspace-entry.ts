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
  const dispose = registerPhase0Handlers(ipcMain, () => window.webContents, {
    ...createWorkspaceHandlers(manager, () => window.webContents),
    ...createSettingsHandlers(settings, new SystemSettingsService(app.getPath('userData'), app.getVersion())),
  });
  const disposeCredentials = registerSettingsCredentials(ipcMain, () => window.webContents, settings);
  const activity = new GraphActivity(manager);
  const graphBridge = new GraphEventBridge(activity, () => window.webContents);
  window.webContents.on('preload-error', (_event, _path, error) => { console.error(error); app.exit(1); });
  try {
    await window.loadURL('data:text/html,<html><body>Workspace integration test</body></html>');
    const sourcePath = path.join(root, 'source');
    const opened = await window.webContents.executeJavaScript(`window.synapse.openShadowProject(${JSON.stringify(sourcePath)})`);
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
      let error;
      try { await window.synapse.mutateChatSession({action:'CREATE',project_hash:hash}); } catch (caught) { error = caught.message; }
      stop();
      return {id, pinned, projects, sessions, notifications, error, node:typeof require};
    })()`);
    assert.equal(result.node, 'undefined');
    assert.equal(result.pinned[0].is_pinned, true);
    assert.equal(result.sessions[0].title, 'Renamed');
    assert.equal(result.projects[0].project_hash, hash);
    assert.ok(result.notifications.length >= 3);
    assert.match(result.error, /INVALID_ARGUMENT/);
    assert.equal(manager.getSessionContext(hash, result.id).core_requirements, 'Real Electron hydration');
    assert.equal(readFileSync(path.join(app.getPath('userData'), 'projects', hash, 'project.db')).subarray(0, 16).toString(), 'SQLite format 3\0');
    const deleted = await window.webContents.executeJavaScript(`window.synapse.mutateChatSession({action:'DELETE',project_hash:${JSON.stringify(hash)},session_id:${JSON.stringify(result.id)}})`);
    assert.deepEqual(deleted, []);
    console.log('ELECTRON_WORKSPACE_OK: real SQLite, appData path, isolated preload, IPC CRUD, hydration, notifications and serialized errors');
  } finally { disposeCredentials(); graphBridge.dispose(); dispose(); manager.dispose(); window.destroy(); }
  clearTimeout(timer);
  app.exit(0);
}).catch((error: unknown) => { console.error(error); clearTimeout(timer); app.exit(1); });
