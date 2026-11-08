import { useEffect, useState } from 'react';
import type { AgentQuotaStat, DAGTaskItem, VisualOfficeEvent } from '@shared/types';
import { DEMO_OFFICE, DEMO_QUOTA, DEMO_TASKS } from '@renderer/mock/demoData';

export interface SynapseState {
  quota: AgentQuotaStat[];
  tasks: DAGTaskItem[];
  office: VisualOfficeEvent[];
  /** true = đang nhận dữ liệu thật từ IPC Bridge; false = dữ liệu minh hoạ. */
  live: boolean;
}

const officeKey = (e: Pick<VisualOfficeEvent, 'room_id' | 'desk_index'>) => `${e.room_id}#${e.desk_index}`;

/** Gộp 1 sự kiện VisualOfficeEvent vào danh sách hiện tại (theo room_id + desk_index). */
export function mergeOfficeEvent(list: VisualOfficeEvent[], ev: VisualOfficeEvent): VisualOfficeEvent[] {
  const key = officeKey(ev);
  const idx = list.findIndex((e) => officeKey(e) === key);
  if (idx === -1) return [...list, ev];
  const next = list.slice();
  next[idx] = ev;
  return next;
}

function getBridge() {
  // window.synapse chỉ tồn tại khi chạy trong Electron (preload contextBridge).
  return typeof window !== 'undefined' && window.synapse ? window.synapse : undefined;
}

export function useSynapseBridge(): SynapseState {
  const bridge = getBridge();
  const [state, setState] = useState<SynapseState>({
    quota: DEMO_QUOTA,
    tasks: DEMO_TASKS,
    office: DEMO_OFFICE,
    live: false,
  });

  useEffect(() => {
    if (!bridge) return;
    let disposed = false;

    Promise.all([bridge.getQuota(), bridge.getTasks(), bridge.getOffice()])
      .then(([quota, tasks, office]) => {
        if (!disposed) setState({ quota, tasks, office, live: true });
      })
      .catch((err) => console.error('[synapse] Không lấy được dữ liệu ban đầu từ IPC:', err));

    const offs = [
      bridge.onQuotaUpdated((quota) => setState((s) => ({ ...s, quota, live: true }))),
      bridge.onTasksUpdated((tasks) => setState((s) => ({ ...s, tasks, live: true }))),
      bridge.onOfficeUpdated((ev) => setState((s) => ({ ...s, office: mergeOfficeEvent(s.office, ev), live: true }))),
    ];

    return () => {
      disposed = true;
      offs.forEach((off) => off());
    };
  }, [bridge]);

  return state;
}
