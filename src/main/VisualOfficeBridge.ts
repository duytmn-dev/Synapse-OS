import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import type { VisualOfficeEvent } from '../shared/types';
import { DAGExecutor } from '../core/DAGExecutor.ts';
import { IPC } from './ipc.ts';

/** Owns only task/office channels. No arbitrary renderer-supplied channel or code. */
export class VisualOfficeBridge {
  private readonly office = new Map<string, VisualOfficeEvent>();
  private readonly subscriptions: (() => void)[];
  private disposed = false;
  private readonly ipc: Pick<IpcMain, 'handle' | 'removeHandler'>;

  constructor(executor: DAGExecutor, ipc: Pick<IpcMain, 'handle' | 'removeHandler'>,
    getContents: () => WebContents | null) {
    this.ipc = ipc;
    const authorize = (event: IpcMainInvokeEvent): void => {
      const contents = getContents();
      if (!contents || contents.isDestroyed() || event.sender !== contents || event.senderFrame !== contents.mainFrame) {
        throw new Error('Untrusted IPC sender');
      }
    };
    const send = (channel: string, payload: unknown): void => {
      const contents = getContents();
      if (contents && !contents.isDestroyed()) {
        try { contents.send(channel, payload); } catch { /* Window may close during delivery. */ }
      }
    };
    ipc.handle(IPC.getTasks, (event) => { authorize(event); return executor.getTasks(); });
    try {
      ipc.handle(IPC.getOffice, (event) => { authorize(event); return this.getOffice(); });
    } catch (error) {
      ipc.removeHandler(IPC.getTasks);
      throw error;
    }
    this.subscriptions = [
      executor.onTasksUpdated((tasks) => send(IPC.tasksUpdated, tasks)),
      executor.onOfficeUpdated((event) => {
        this.office.set(`${event.room_id}:${event.desk_index}`, { ...event });
        send(IPC.officeUpdated, event);
      }),
    ];
  }

  getOffice(): VisualOfficeEvent[] {
    return [...this.office.values()].map((event) => ({ ...event }));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.ipc.removeHandler(IPC.getTasks);
    this.ipc.removeHandler(IPC.getOffice);
  }
}
