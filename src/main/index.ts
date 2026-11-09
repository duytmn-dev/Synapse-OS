import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
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
import { ProviderRegistry } from '../adapters/ProviderRegistry.ts';
import { CodexBrowserAuth } from '../adapters/CodexBrowserAuth.ts';
import { ClaudeBrowserAuth } from '../adapters/ClaudeBrowserAuth.ts';
import { AntigravityBrowserAuth } from '../adapters/AntigravityBrowserAuth.ts';
import { ChatGPTViaCodexAuth } from './ChatGPTViaCodexAuth.ts';
import { createChatHandlers } from './ChatHandlers.ts';
import { sendClaudeMessage } from '../adapters/ClaudeChat.ts';

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
  const userData = app.getPath('userData');
  const codexAuth = new CodexBrowserAuth(userData, (url) => shell.openExternal(url));
  const antigravity = new AntigravityBrowserAuth(userData);
  const chatgptAuth = new ChatGPTViaCodexAuth({
    isChatGPTLinked: () => settingsService.isChatGPTLinked(),
    setChatGPTLinked: (linked) => settingsService.setChatGPTLinked(linked),
  }, codexAuth);
  const providers = new ProviderRegistry(userData, codexAuth, {
    chatgpt: { display_name: 'ChatGPT', role_description: 'Tài khoản ChatGPT dùng chung với Codex', auth: chatgptAuth },
    claude: { display_name: 'Claude', role_description: 'Claude Code', auth: new ClaudeBrowserAuth(userData) },
    gemini: { display_name: 'Gemini', role_description: 'Google Antigravity CLI', auth: antigravity },
  }, {
    gemini: (message) => antigravity.sendMessage(message),
    chatgpt: (message) => chatgptAuth.sendMessage(message),
    codex: (message) => codexAuth.sendMessage(message),
    claude: async (message) => sendClaudeMessage(await secretStore.read('claude'), message),
  });
  settingsService = new SettingsService(userData, secretStore, (agent, status) => {
    agentStatusBridge?.update({ agent_id: agent, connection_status: status.connection_status,
      worker_model_name: status.worker_model_name, keychain_configured: null });
  }, providers);
  knowledgeGraphService = new KnowledgeGraphService(shadowWorkspaceManager);
  disposePhase0 = registerPhase0Handlers(ipcMain, () => mainWindow?.webContents ?? null,
    { ...createWorkspaceHandlers(shadowWorkspaceManager, () => mainWindow?.webContents ?? null, async () => {
        const owner = mainWindow;
        if (!owner || owner.isDestroyed()) throw new Error('DIRECTORY_PICKER_UNAVAILABLE: Cửa sổ ứng dụng đã đóng');
        const result = await dialog.showOpenDialog(owner, { title: 'Mở thư mục dự án', properties: ['openDirectory'] });
        if (result.canceled || owner.isDestroyed()) return null;
        if (!result.filePaths[0]) throw new Error('DIRECTORY_NOT_SELECTED: Không nhận được đường dẫn thư mục');
        return result.filePaths[0];
      }),
      ...createSettingsHandlers(settingsService, new SystemSettingsService(app.getPath('userData'), app.getVersion())),
      ...createGraphHandlers(knowledgeGraphService, () => mainWindow?.webContents ?? null),
      ...createChatHandlers(providers),
      sendGeminiMessage: (message) => antigravity.sendMessage(message),
      sendCodexMessage: (message) => codexAuth.sendMessage(message),
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
