import { useEffect, useState } from 'react';
import type { AgentQuotaStat, DAGTaskItem, VisualOfficeEvent } from '@shared/types';
import { DEMO_ACTIVE_ROOMS, DEMO_OFFICE, DEMO_QUOTA, DEMO_TASKS } from '@renderer/mock/demoData';

export interface SynapseState {
  quota: AgentQuotaStat[];
  tasks: DAGTaskItem[];
  office: VisualOfficeEvent[];
  activeRooms: VisualOfficeEvent['room_id'][];
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
    activeRooms: DEMO_ACTIVE_ROOMS,
    live: false,
  });

  useEffect(() => {
    if (!bridge) return;
    let disposed = false;

    // Lấy dữ liệu ban đầu từ IPC
    Promise.all([
      bridge.getQuota().catch(() => DEMO_QUOTA),
      bridge.getTasks().catch(() => DEMO_TASKS),
      bridge.getOffice().catch(() => DEMO_OFFICE),
      bridge.getActiveRooms ? bridge.getActiveRooms().catch(() => null) : Promise.resolve(null),
    ])
      .then(([quota, tasks, office, activeRoomsSnap]) => {
        if (!disposed) {
          setState((prev) => ({
            ...prev,
            quota: quota && quota.length > 0 ? quota : prev.quota,
            tasks: tasks && tasks.length > 0 ? tasks : prev.tasks,
            office: office && office.length > 0 ? office : prev.office,
            activeRooms:
              activeRoomsSnap && activeRoomsSnap.active_rooms && activeRoomsSnap.active_rooms.length > 0
                ? activeRoomsSnap.active_rooms
                : prev.activeRooms,
            live: true,
          }));
        }
      })
      .catch((err) => console.error('[synapse] Không lấy được dữ liệu ban đầu từ IPC:', err));

    const offs: (() => void)[] = [];

    if (bridge.onQuotaUpdated) {
      offs.push(bridge.onQuotaUpdated((quota) => setState((s) => ({ ...s, quota, live: true }))));
    }
    if (bridge.onTasksUpdated) {
      offs.push(bridge.onTasksUpdated((tasks) => setState((s) => ({ ...s, tasks, live: true }))));
    }
    if (bridge.onOfficeUpdated) {
      offs.push(
        bridge.onOfficeUpdated((ev) =>
          setState((s) => ({ ...s, office: mergeOfficeEvent(s.office, ev), live: true }))
        )
      );
    }
    if (bridge.onActiveRoomsUpdated) {
      offs.push(
        bridge.onActiveRoomsUpdated((snapshot) =>
          setState((s) => ({
            ...s,
            activeRooms: snapshot?.active_rooms ?? s.activeRooms,
            live: true,
          }))
        )
      );
    }

    return () => {
      disposed = true;
      offs.forEach((off) => off());
    };
  }, [bridge]);

  return state;
}
