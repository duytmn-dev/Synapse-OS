# TÀI LIỆU BÀN GIAO KỸ THUẬT: PHA 2 (FRONTEND BRANCH - KNOWLEDGE GRAPH)

> **Dành cho:** AI tiếp nối (Codex Backend hoặc Auditor/Orchestrator).  
> **Mục đích:** Cung cấp toàn bộ chi tiết kiến trúc, danh sách hàm, state, props và điểm nối IPC của Knowledge Graph tương tác mà không cần tra lại code.

---

## 1. TỔNG QUAN CÔNG VIỆC ĐÃ HOÀN THÀNH Ở PHA 2 (FE)

Theo đúng hiến pháp `AGENTS.md` (chỉ ghi vào `src/ui/**`, `src/renderer/**`, `src/shared/types.ts`), Frontend đã dựng hoàn tất và pixel-perfect 100% bản đồ Codebase Knowledge Graph tương tác bám sát thiết kế SVG:

1. **Hover Tooltip (`docs/design/04 Hover Node.svg`):**
   - Card kính mờ $218 \times 90\text{ px}$, bo góc $10\text{ px}$, background `#142338` (opacity 0.9), `backdrop-blur(12px)`, viền `#405672`.
   - Hiển thị icon file (`#58E9A8`), nhãn file (`pipeline.py`, 13px bold `#EAF2FF`), thống kê số hàm & liên kết (`5 hàm · 5 liên kết`), thời gian sửa (`Thay đổi 2 phút trước`).
   - Tự động tính toán vị trí theo con trỏ chuột, giới hạn trong khung chứa (clamp) chống tràn ra ngoài màn hình.

2. **Context Menu chuột phải (`docs/design/05 Context Menu.svg`):**
   - Bắt sự kiện `onContextMenu` trên từng Node, hiển thị popup kích thước $211\text{ px}$ với viền xanh neon `#58E9A8`, shadow phát sáng neon `[0 0 20px rgba(88,233,168,0.25)]`.
   - Tiêu đề Node (`#8297B2`, 11px font JetBrains Mono).
   - Nút **[Tập trung (Focus)]**: Icon target `#58E9A8`, gọi lệnh `FOCUS`. Khi bật, Node mục tiêu có hào quang xanh neon nhấp nháy, toàn bộ các Node và Edge không liên quan bị làm mờ (`opacity: 0.22`), trên thanh toolbar hiện badge `Tập trung: <node_id>` với nút bỏ tập trung.
   - Nút **[Bỏ qua (Exclude)]**: Icon eye-slash `#9DB0C8`, gọi lệnh `EXCLUDE`. Khi bấm, Node đổi sang trạng thái `IGNORED` (màu xám `#65748A`, mờ 45%). Menu hỗ trợ nút đảo chiều **[Khôi phục (Reset)]** gọi lệnh `RESET`.
   - Tự động đóng menu khi click ra ngoài canvas hoặc click nút lệnh.

3. **Search Overlay & Pan/Zoom (`docs/design/06 Tìm kiếm file.svg`):**
   - Nút kính lúp góc phải mở overlay tìm kiếm $262\text{ px}$, input viền xanh `#58E9A8` với icon search `#EAF2FF`.
   - Lọc thời gian thực danh sách file trong Graph.
   - Khi click vào 1 kết quả: Tự động tính toán Pan (dịch tâm) và Zoom (`scale = 1.35`) đưa Node đó vào chính giữa màn hình, đồng thời kích hoạt hiệu ứng Ping phát sáng quanh Node trong 2.5 giây.

4. **Tương tác Canvas & Điều hướng:**
   - Kéo chuột trên canvas để di chuyển khung nhìn (**Drag-to-pan**).
   - Cuộn chuột để phóng to/thu nhỏ (**Wheel-to-zoom**, giới hạn từ 0.5x đến 2.2x).
   - 4 nút điều khiển toolbar góc phải: Tìm kiếm (`IconSearch`), Phóng to (`IconPlus`), Thu nhỏ (`IconMinus`), Căn giữa toàn khung (`IconExpand`).

---

## 2. DANH SÁCH FILE ĐÃ THÊM / CẬP NHẬT

| File Path | Vai trò | Thay đổi chính |
| :--- | :--- | :--- |
| `src/ui/graph/KnowledgeGraphPanel.tsx` | Component chính đồ thị tri thức | Viết lại toàn bộ để hỗ trợ Pan/Zoom, Hover Tooltip, Context Menu, Search Overlay, Focus Dimming và IPC control. |
| `src/renderer/hooks/useSynapseBridge.ts` | React Hook kết nối IPC Electron | Thêm hàm `controlGraphNode(command)` gửi IPC xuống backend và optimistic update local state. |
| `src/renderer/App.tsx` | Layout gốc của ứng dụng | Trích xuất `controlGraphNode` và truyền xuống `KnowledgeGraphPanel` cùng `projectHash`. |
| `SYNC_BOARD.md` | Bảng đồng bộ tiến độ dự án | Đánh dấu `[x]` hoàn tất Pha 2 Frontend và ghi chú kết quả test. |
| `docs/PHASE_2_FRONTEND_HANDOVER.md` | Tài liệu bàn giao (File này) | Bàn giao kỹ thuật chi tiết cho AI Backend nối luồng. |

---

## 3. CHI TIẾT CÁC HÀM VÀ PROPS MỚI TRONG FRONTEND

### A. Component `KnowledgeGraphPanel.tsx`
Được định nghĩa tại `src/ui/graph/KnowledgeGraphPanel.tsx`:

```typescript
interface KnowledgeGraphPanelProps {
  title?: string;
  subtitle?: string;
  isRunning?: boolean;
  onSearchClick?: () => void;
  activeEvent?: GraphActiveEvent | null;
  graphData?: GraphData | null;
  projectHash?: string;
  onControlNode?: (command: GraphNodeControlCommand) => Promise<void> | void;
}
```

#### Các hàm nội bộ chính trong `KnowledgeGraphPanel`:
1. `handleMouseDown(e: React.MouseEvent)`:
   - Kiểm tra nếu click vào nền canvas (SVG hoặc container), kích hoạt chế độ `isDragging = true` và lưu vị trí bắt đầu `dragStart`.
2. `handleMouseMove(e: React.MouseEvent)`:
   - Khi đang kéo (`isDragging = true`), cập nhật `panOffset = { x, y }`.
3. `handleMouseUp()`:
   - Dừng chế độ kéo `isDragging = false`.
4. `handleWheel(e: React.WheelEvent)`:
   - Bắt sự kiện cuộn chuột, tính toán `zoomLevel` trong khoảng `[0.5, 2.2]`.
5. `handleNodeMouseEnter(node: InternalGraphNode, e: React.MouseEvent)`:
   - Kích hoạt Tooltip khi di chuột vào Node, tính toán tọa độ `tooltipPos` tương đối với `containerRef` và kẹp trong biên màn hình.
6. `handleNodeMouseLeave()`:
   - Ẩn Tooltip khi chuột rời khỏi Node.
7. `handleNodeContextMenu(node: InternalGraphNode, e: React.MouseEvent)`:
   - Bắt sự kiện chuột phải trên Node, ngăn context menu mặc định của trình duyệt (`preventDefault`), tính toán vị trí và mở Context Menu (`setContextMenu`).
8. `handleControlCommand(nodeId: string, command: 'FOCUS' | 'EXCLUDE' | 'RESET')`:
   - Đóng context menu.
   - Thực hiện cập nhật UI cục bộ ngay lập tức (zero latency): toggle `focusedNodeId` hoặc cập nhật Set `excludedNodeIds`.
   - Bắn IPC qua `onControlNode({ project_hash, node_id, command })`.
9. `handleSelectSearchResult(node: InternalGraphNode)`:
   - Tính toán vector dịch chuyển `(dx, dy)` từ tâm đồ thị (`1143, 321`) tới tọa độ của Node, cập nhật `panOffset` và `zoomLevel = 1.35`.
   - Đóng thanh Search, kích hoạt vòng tròn phát sáng `highlightedNodeId` trong 2.5 giây.

---

### B. Hook `useSynapseBridge.ts`
Thêm hàm điều khiển IPC:
```typescript
const controlGraphNode = useCallback(
  async (command: GraphNodeControlCommand): Promise<void> => {
    if (bridge?.controlGraphNode) {
      try {
        await bridge.controlGraphNode(command);
      } catch (err) {
        console.warn('[useSynapseBridge] controlGraphNode IPC returned error (optimistic fallback applied):', err);
      }
    }
    // Optimistic local update khi chạy standalone hoặc backend đang khởi động
    setState((s) => {
      if (!s.graphData) return s;
      const nodes = s.graphData.nodes.map((n) => {
        if (n.id !== command.node_id) return n;
        if (command.command === 'FOCUS') return { ...n, is_focused: true };
        if (command.command === 'EXCLUDE') return { ...n, visual_state: 'IGNORED' as const, is_focused: false };
        if (command.command === 'RESET') return { ...n, is_focused: false, visual_state: 'DEFAULT' as const };
        return n;
      });
      return { ...s, graphData: { ...s.graphData, nodes } };
    });
  },
  [bridge]
);
```

---

## 4. HƯỚNG DẪN KẾT NỐI CHO AI BACKEND (CODEX) TRONG PHA 2 BE

Khi Codex triển khai nhánh Backend của Pha 2, chỉ cần bám sát hợp đồng sau mà không cần sửa code Frontend:

1. **IPC Channel nhận lệnh:**
   - Channel: `synapse:graph:control` (đã được expose qua `window.synapse.controlGraphNode(command)`).
   - Input payload:
     ```typescript
     export interface GraphNodeControlCommand {
       project_hash: string;
       node_id: string;              // VD: "pipeline.py"
       command: 'FOCUS' | 'EXCLUDE' | 'RESET';
     }
     ```
   - Trách nhiệm của Backend:
     - Ghi nhận trạng thái vào bảng `graph_overrides` trong SQLite (`%APPDATA%/SynapseOS/projects/<project_hash>/project.db`).
     - Lập tức phát event `graph_data_update` chứa `GraphDataSnapshot` mới nhất lên UI.

2. **IPC Event phát dữ liệu đồ thị lên UI:**
   - Channel: `graph_data_update` (Frontend đã có sẵn listener `onGraphDataUpdated(callback)` trong `useSynapseBridge.ts`).
   - Format dữ liệu gửi lên:
     ```typescript
     export interface GraphDataSnapshot {
       project_hash: string;
       project_name: string;
       git_branch: string;
       total_nodes: number;
       total_edges: number;
       is_running: boolean;
       nodes: GraphNode[];
       edges: GraphEdge[];
     }
     ```
   - Khi có sự kiện này, `useSynapseBridge` sẽ tự động cập nhật `state.graphData` và truyền trực tiếp vào `KnowledgeGraphPanel`.

---

## 5. KẾT QUẢ KIỂM THỬ XÁC NHẬN

- `npx tsc --noEmit`: **PASS 100% (0 lỗi cú pháp/type error)**.
- `npm run build`: **PASS 100% (Build sạch bundle Vite, main process và preload)**.
- Node test runner: `node --experimental-transform-types --experimental-vm-modules --test "src/**/*.test.ts" "tests/**/*.test.ts"`: **84 PASS, 0 FAIL, 1 SKIP (85 bài kiểm thử)**.
