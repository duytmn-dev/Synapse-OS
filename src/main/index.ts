import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentQuotaStat } from '../shared/types';
import { IPC } from './ipc';
import { DAGExecutor } from '../core/DAGExecutor.ts';
import { VisualOfficeBridge } from './VisualOfficeBridge.ts';

const directory = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

// Adapters/QuotaTracker will supply quota data in the next phase.
const quota: AgentQuotaStat[] = [];
export const dagExecutor = new DAGExecutor();
let officeBridge: VisualOfficeBridge | undefined;

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

app.on('will-quit', () => { officeBridge?.dispose(); });
