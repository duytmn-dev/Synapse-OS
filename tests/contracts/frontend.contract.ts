/**
 * Hợp đồng Frontend ↔ src/shared/types.ts (kiểm tra ở mức kiểu, chạy bằng `npx tsc --noEmit`).
 * Nếu Backend/Orchestrator đổi hợp đồng mà UI chưa cập nhật, file này sẽ làm build FAIL.
 */
import type { AgentQuotaStat, DAGTaskItem, VisualOfficeEvent } from '../../src/shared/types';
import { ROOMS, type RoomId } from '../../src/ui/agents';
import { DEMO_OFFICE, DEMO_QUOTA, DEMO_TASKS } from '../../src/renderer/mock/demoData';
import { normalizeStatus } from '../../src/ui/tasks/TaskTree';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <T extends true>(_: T) => _;

// 1. Mọi room_id của VisualOfficeEvent đều có phòng 3D tương ứng (và ngược lại).
assertType<Equals<RoomId, VisualOfficeEvent['room_id']>>(true);
assertType<Equals<keyof typeof ROOMS, VisualOfficeEvent['room_id']>>(true);

// 2. Bàn làm việc: UI vẽ đúng 3 bàn/phòng (desk_index 0|1|2).
assertType<Equals<VisualOfficeEvent['desk_index'], 0 | 1 | 2>>(true);

// 3. Trạng thái task mà TaskTree xử lý khớp hợp đồng.
assertType<Equals<ReturnType<typeof normalizeStatus>, DAGTaskItem['status']>>(true);

// 4. Animation state mà Văn phòng 3D hỗ trợ.
assertType<Equals<VisualOfficeEvent['animation_state'], 'IDLE' | 'TYPING' | 'THINKING' | 'DONE'>>(true);

// 5. Dữ liệu minh hoạ tuân thủ hợp đồng.
export const _contractFixtures = {
  quota: DEMO_QUOTA satisfies AgentQuotaStat[],
  tasks: DEMO_TASKS satisfies DAGTaskItem[],
  office: DEMO_OFFICE satisfies VisualOfficeEvent[],
};
