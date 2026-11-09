import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { App } from 'electron';
import { ShadowWorkspaceManager } from '../core/workspace/ShadowWorkspaceManager.ts';

/** Call after app.whenReady, before constructing workspace handlers. */
export function createWorkspaceRuntime(app: Pick<App, 'getPath' | 'setPath'>): ShadowWorkspaceManager {
  const userData = path.join(app.getPath('appData'), 'SynapseOS');
  mkdirSync(userData, { recursive: true });
  app.setPath('userData', userData);
  return new ShadowWorkspaceManager(app.getPath('userData'));
}
