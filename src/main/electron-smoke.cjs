// Run after npm run build: electron src/main/electron-smoke.cjs
const { app } = require('electron');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const timer = setTimeout(() => { console.error('Electron IPC test timed out'); app.exit(1); }, 15000);
const loaded = import(pathToFileURL(path.resolve(__dirname, '../../dist-electron/index.js')).href);

app.on('browser-window-created', (_event, window) => {
  window.webContents.on('preload-error', (_event, _path, error) => { console.error(error); app.exit(1); });
  window.webContents.once('did-finish-load', async () => {
    try {
      const { dagExecutor } = await loaded;
      const prefs = window.webContents.getLastWebPreferences();
      assert.equal(prefs.nodeIntegration, false);
      assert.equal(prefs.contextIsolation, true);
      assert.equal(prefs.sandbox, true);
      await window.webContents.executeJavaScript(`
        window.testEvents = [];
        window.testTasks = [];
        window.stopOffice = window.synapse.onOfficeUpdated(event => window.testEvents.push(event));
        window.stopTasks = window.synapse.onTasksUpdated(tasks => window.testTasks.push(tasks));
        void 0;
      `);
      await dagExecutor.execute([{ code: 'B', title: 'Parent', agent: 'codex', children: [
        { code: 'B1', title: 'Child', agent: 'codex', run: () => 'ok' },
      ] }]);
      const result = await window.webContents.executeJavaScript(`(async () => {
        const tasks = await window.synapse.getTasks();
        const office = await window.synapse.getOffice();
        window.stopOffice(); window.stopTasks();
        return { tasks, office, events: window.testEvents, updates: window.testTasks, node: typeof require };
      })()`);
      assert.equal(result.node, 'undefined');
      assert.ok(result.tasks.every(task => task.status === 'COMPLETED'));
      assert.ok(result.events.some(event => event.active_task_code === 'B1' && event.animation_state === 'TYPING'));
      assert.equal(result.office[0].animation_state, 'IDLE');
      assert.equal(result.office[0].active_task_code, null);
      assert.ok(result.updates.length > 0);
      await dagExecutor.execute([{ code: 'C', title: 'C', agent: 'codex', run: () => {} }]);
      const count = await window.webContents.executeJavaScript('window.testEvents.length');
      assert.equal(count, result.events.length);
      console.log('ELECTRON_IPC_OK: B1 events, snapshots, unsubscribe and renderer isolation verified');
      clearTimeout(timer);
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
});
