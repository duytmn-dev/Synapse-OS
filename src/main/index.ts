import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentQuotaStat } from '../shared/types';
import { IPC } from './ipc';
import { DAGExecutor } from '../core/DAGExecutor.ts';
import { VisualOfficeBridge } from './VisualOfficeBridge.ts';
import { AgentStatusBridge } from './AgentStatusBridge.ts';
import { getWorkspaceStorageInfo } from './WorkspaceStorage.ts';
import { SecretStore } from './SecretStore.ts';

const directory = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

// Adapters/QuotaTracker will supply quota data in the next phase.
const quota: AgentQuotaStat[] = [];
export const dagExecutor = new DAGExecutor();
export let officeBridge: VisualOfficeBridge | undefined;
export let agentStatusBridge: AgentStatusBridge | undefined;
export let secretStore: SecretStore;

function registerIPC(): void {
  for (const [channel, snapshot] of [
    [IPC.getQuota, quota],
  ] as const) {
    ipcMain.handle(channel, (event) => {
      if (!mainWindow || event.sender !== mainWindow.webContents ||
          event.senderFrame !== mainWindow.webContents.mainFrame) {
        throw new Error('Untrusted IPC sender');
      }
      return snapshot;
    });
  }
  officeBridge = new VisualOfficeBridge(dagExecutor, ipcMain, () => mainWindow?.webContents ?? null);
  agentStatusBridge = new AgentStatusBridge(ipcMain, () => mainWindow?.webContents ?? null);
  secretStore = new SecretStore(path.join(app.getPath('userData'), 'secrets'));
  ipcMain.handle(IPC.saveKey, async (event, agentId: unknown, key: unknown) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Untrusted IPC sender');
    if (typeof agentId !== 'string' || typeof key !== 'string') throw new Error('Invalid key request');
    await secretStore.save(agentId, key);
    const existing = agentStatusBridge!.snapshot().agents.find((agent) => agent.agent_id === agentId);
    agentStatusBridge!.update({ agent_id: agentId, connection_status: existing?.connection_status ?? 'DISCONNECTED',
      worker_model_name: existing?.worker_model_name, keychain_configured: null });
  });
  ipcMain.handle(IPC.getStorage, (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('Untrusted IPC sender');
    }
    return getWorkspaceStorageInfo(app.getPath('userData'), app.getAppPath()).then((storage) => {
      agentStatusBridge?.updateStorage(storage);
      return storage;
    });
  });
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Synapse OS',
    webPreferences: {
      preload: path.join(directory, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow = window;
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.on('closed', () => { mainWindow = null; });

  const devURL = process.env.VITE_DEV_SERVER_URL;
  if (!app.isPackaged && devURL) {
    await window.loadURL(devURL);
  } else {
    await window.loadFile(path.join(directory, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  registerIPC();
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch((error: unknown) => { console.error(error); app.quit(); });
    }
  });
}).catch((error: unknown) => { console.error(error); app.quit(); });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => { officeBridge?.dispose(); agentStatusBridge?.dispose(); ipcMain.removeHandler(IPC.getStorage); ipcMain.removeHandler(IPC.saveKey); });
