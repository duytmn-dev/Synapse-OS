import type { WebContents } from 'electron';
import type { GraphActivity } from '../core/GraphActivity.ts';
import { IPC } from './ipc.ts';

export class GraphEventBridge {
  private readonly unsubscribe: () => void;
  constructor(activity: GraphActivity, contents: () => WebContents | null) {
    this.unsubscribe = activity.subscribe((event) => {
      const target = contents();
      if (target && !target.isDestroyed()) target.send(IPC.graphActiveEvent, event);
    });
  }
  dispose(): void { this.unsubscribe(); }
}
