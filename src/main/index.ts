import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC } from './ipc';
import { DAGExecutor } from '../core/DAGExecutor.ts';
import { VisualOfficeBridge } from './VisualOfficeBridge.ts';
import { AgentStatusBridge } from './AgentStatusBridge.ts';
import { getWorkspaceStorageInfo } from './WorkspaceStorage.ts';
import { SecretStore } from './SecretStore.ts';
import { registerPhase0Handlers } from './Phase0Handlers.ts';
import type { ShadowWorkspaceManager } from '../core/workspace/ShadowWorkspaceManager.ts';
import { createWorkspaceHandlers } from './WorkspaceHandlers.ts';
import { createWorkspaceRuntime } from './WorkspaceRuntime.ts';
import { GraphActivity } from '../core/GraphActivity.ts';
import { GraphEventBridge } from './GraphEventBridge.ts';
import { CLIAdapter, type AgentCLIConfig } from '../adapters/CLIAdapter.ts';
import { SettingsService } from './SettingsService.ts';
import { SystemSettingsService } from './SystemSettingsService.ts';
import { createSettingsHandlers, registerSettingsCredentials } from './SettingsHandlers.ts';
import { KnowledgeGraphService } from '../adapters/graphify/KnowledgeGraphService.ts';
import { createGraphHandlers } from './GraphHandlers.ts';

const directory = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

export const dagExecutor = new DAGExecutor();
export let officeBridge: VisualOfficeBridge | undefined;
export let agentStatusBridge: AgentStatusBridge | undefined;
export let secretStore: SecretStore;
let disposePhase0: (() => void) | undefined;
export let shadowWorkspaceManager: ShadowWorkspaceManager;
export let graphActivity: GraphActivity;
export let settingsService: SettingsService;
export let knowledgeGraphService: KnowledgeGraphService;
let graphEventBridge: GraphEventBridge | undefined;
let disposeCredentials: (() => void) | undefined;

export function createAgentCLIAdapter(config: AgentCLIConfig): CLIAdapter {
  if (!graphActivity) throw new Error('GRAPH_SERVICE_UNAVAILABLE');
  return new CLIAdapter(config, undefined, graphActivity);
}

function registerIPC(): void {
  shadowWorkspaceManager = createWorkspaceRuntime(app);
  graphActivity = new GraphActivity(shadowWorkspaceManager);
  dagExecutor.connectGraphActivity(graphActivity);
  graphEventBridge = new GraphEventBridge(graphActivity, () => mainWindow?.webContents ?? null);
  agentStatusBridge = new AgentStatusBridge(ipcMain, () => mainWindow?.webContents ?? null);
  secretStore = new SecretStore(path.join(app.getPath('userData'), 'secrets'));
  settingsService = new SettingsService(app.getPath('userData'), secretStore, (agent, status) => {
    agentStatusBridge?.update({ agent_id: agent, connection_status: status.connection_status,
      worker_model_name: status.worker_model_name, keychain_configured: null });
  });
  knowledgeGraphService = new KnowledgeGraphService(shadowWorkspaceManager);
  disposePhase0 = registerPhase0Handlers(ipcMain, () => mainWindow?.webContents ?? null,
    { ...createWorkspaceHandlers(shadowWorkspaceManager, () => mainWindow?.webContents ?? null),
      ...createSettingsHandlers(settingsService, new SystemSettingsService(app.getPath('userData'), app.getVersion())),
      ...createGraphHandlers(knowledgeGraphService, () => mainWindow?.webContents ?? null),
      getTaskTree: async () => {
        const currentTasks = dagExecutor.getTasks();
        const completed = currentTasks.filter((t) => t.status === 'COMPLETED').length;
        return {
          root_title: 'Quy trình DAG',
          completed_count: completed,
          total_count: currentTasks.length,
          tasks: currentTasks.map((t) => ({
            task_code: t.step_code,
            title: t.title,
            assigned_agent: (t.assigned_agent ?? 'codex') as any,
            status: t.status === 'WAITING' ? ('PENDING' as const) : t.status,
            children: t.sub_tasks?.map((sub) => ({
              task_code: sub.sub_code,
              title: sub.title,
              assigned_agent: (t.assigned_agent ?? 'gemini') as any,
              status: sub.status === 'WAITING' ? ('PENDING' as const) : (sub.status as any),
            })),
          })),
        };
      },
    });
  dagExecutor.onTasksUpdated(() => {
    try {
      const contents = mainWindow?.webContents;
      if (contents && !contents.isDestroyed()) {
        const currentTasks = dagExecutor.getTasks();
        const completed = currentTasks.filter((t) => t.status === 'COMPLETED').length;
        contents.send(IPC.taskTreeUpdated, {
          root_title: 'Quy trình DAG',
          completed_count: completed,
          total_count: currentTasks.length,
          tasks: currentTasks.map((t) => ({
            task_code: t.step_code,
            title: t.title,
            assigned_agent: (t.assigned_agent ?? 'codex') as any,
            status: t.status === 'WAITING' ? 'PENDING' : t.status,
            children: t.sub_tasks?.map((sub) => ({
              task_code: sub.sub_code,
              title: sub.title,
              assigned_agent: (t.assigned_agent ?? 'gemini') as any,
              status: sub.status === 'WAITING' ? 'PENDING' : sub.status,
            })),
          })),
        });
      }
    } catch { /* ignore */ }
  });
  disposeCredentials = registerSettingsCredentials(ipcMain, () => mainWindow?.webContents ?? null, settingsService);
  officeBridge = new VisualOfficeBridge(dagExecutor, ipcMain, () => mainWindow?.webContents ?? null);
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

app.on('will-quit', () => { disposeCredentials?.(); disposePhase0?.(); graphEventBridge?.dispose(); knowledgeGraphService?.dispose(); shadowWorkspaceManager?.dispose(); officeBridge?.dispose(); agentStatusBridge?.dispose(); ipcMain.removeHandler(IPC.getStorage); });
