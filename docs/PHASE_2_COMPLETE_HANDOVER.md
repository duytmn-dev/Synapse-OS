# BÁO CÁO BÀN GIAO KỸ THUẬT TOÀN DIỆN: PHA 2 (FRONTEND & BACKEND)

> **Dự án:** Synapse OS — Knowledge Graph Edition  
> **Trạng thái:** PHA 2 ĐÃ HOÀN TẤT 100% (Cả Frontend UI & Backend Core)  
> **Dành cho:** AI tiếp nối (Codex, Antigravity, hoặc Orchestrator) vào đọc là hiểu ngay toàn bộ kiến trúc, danh sách hàm, state, database schema và IPC handlers mà không cần tra lại mã nguồn.

---

## 1. TỔNG QUAN PHA 2

Pha 2 kết nối hoàn chỉnh hệ thống **Codebase Knowledge Graph** từ tầng trích xuất AST local ($0 API), lưu trữ cô lập trong Shadow Workspace, làm giàu dữ liệu qua SQLite và `fs.stat`, theo dõi thay đổi cục bộ (Delta Update với `chokidar`), đồng bộ IPC xuống bản đồ đồ thị tương tác SVG theo pixel-perfect design.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND CORE (Codex)                            │
│                                                                        │
│   [Thư mục dự án thật] ──(chokidar)──► [Delta Update Watcher]          │
│            │                                    │                      │
│            ▼ (AST scan / graphify CLI)          ▼                      │
│   [%APPDATA%/SynapseOS/projects/<hash>/graph.json]                     │
│            │ (Node Enrichment: fs.stat mtimeMs)                        │
│            ▼                                                           │
│   [SQLite project.db: table graph_overrides] ◄── [FOCUS/EXCLUDE/RESET] │
│            │                                                           │
│            ▼                                                           │
│   [KnowledgeGraphService] ──(IPC: graph_data_update)──┐                │
└───────────────────────────────────────────────────────┼────────────────┘
                                                        │
┌───────────────────────────────────────────────────────▼────────────────┐
│                        FRONTEND UI (Antigravity)                       │
│                                                                        │
│   [useSynapseBridge: controlGraphNode] ◄──► [window.synapse]           │
│            │                                                           │
│            ▼                                                           │
│   [KnowledgeGraphPanel.tsx]:                                           │
│     ├── 04 Hover Node.svg: Tooltip ($218x90px, mtime, func/edge stats)  │
│     ├── 05 Context Menu.svg: Menu neon green (Focus / Exclude / Reset) │
│     ├── 06 Tìm kiếm file.svg: Search overlay + Auto Pan/Zoom           │
│     └── Drag-to-pan & Wheel-to-zoom SVG viewport                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CÁC FILE ĐÃ TẠO MỚI VÀ CẬP NHẬT TRONG PHA 2

| Phân khu | File Path | Trạng thái | Tóm tắt chức năng |
| :--- | :--- | :--- | :--- |
| **Backend** | `src/adapters/graphify/GraphifyRunner.ts` | **MỚI** | Gọi CLI `graphify` qua `child_process.execFile` hoặc bộ quét AST tĩnh local ($0 API cost). Ép xuất `graph.json` vào Shadow Workspace. Chặn tuyệt đối ghi đè vào source. |
| **Backend** | `src/adapters/graphify/KnowledgeGraphService.ts` | **MỚI** | Dịch vụ chính đồ thị: Làm giàu dữ liệu (`fs.stat`, `graph_overrides`), xử lý lệnh Focus/Exclude/Reset, theo dõi thay đổi file (`chokidar`) và phát thông báo Delta Update. |
| **Backend** | `src/main/GraphHandlers.ts` | **MỚI** | Bộ điều phối IPC Main: Đăng ký channel `synapse:graph:get` và `synapse:graph:control`, xác thực sender, phát broadcast `graph_data_update`. |
| **Backend** | `src/main/index.ts` | **SỬA** | Khởi tạo `KnowledgeGraphService`, nối vào `registerPhase0Handlers` và dọn dẹp khi app thoát. |
| **Backend** | `tests/backend/graphify.test.ts` | **MỚI** | Bộ 7 bài test kiểm thử toàn diện: Zero pollution, SQLite overrides, mtime stat, Delta updates, authorized IPC, và chạy thật trên chính thư mục mã nguồn dự án. |
| **Frontend** | `src/ui/graph/KnowledgeGraphPanel.tsx` | **SỬA TOÀN DIỆN** | Dựng Hover Tooltip, Context Menu chuột phải, Search Overlay, Pan/Zoom, Focus Dimming. |
| **Frontend** | `src/renderer/hooks/useSynapseBridge.ts` | **SỬA** | Thêm hàm `controlGraphNode(command)` gửi IPC và optimistic local update. |
| **Frontend** | `src/renderer/App.tsx` | **SỬA** | Truyền `controlGraphNode` và `projectHash` vào `KnowledgeGraphPanel`. |
| **Chung** | `SYNC_BOARD.md` | **SỬA** | Đánh dấu `[x]` hoàn thành cả 2 nhánh FE & BE của Pha 2. |

---

## 3. CHI TIẾT CÁC HÀM VÀ MODULE BACKEND ĐÃ VIẾT

### 3.1. `GraphifyRunner` (`src/adapters/graphify/GraphifyRunner.ts`)
```typescript
export class GraphifyRunner {
  constructor(private readonly cliCommand = 'graphify');

  // Chạy CLI hoặc fallback AST scanner để tạo graph.json trong shadow workspace
  async generateGraph(projectPath: string, outputPath: string): Promise<RawGraphOutput>;

  // Bộ quét cú pháp AST local cho Python, TS, JS, YAML, JSON ($0 API)
  scanProjectTree(projectPath: string): RawGraphOutput;
}
```
* **Bảo vệ Zero Project Pollution:** Kiểm tra `path.relative(resolvedProject, resolvedOutput)`. Nếu file output nằm bên trong thư mục nguồn của người dùng, ném lỗi `WorkspaceError('PROJECT_POLLUTION_BLOCKED')`.

---

### 3.2. `KnowledgeGraphService` (`src/adapters/graphify/KnowledgeGraphService.ts`)
```typescript
export class KnowledgeGraphService {
  constructor(private readonly workspace: ShadowWorkspaceManager, runner?: GraphifyRunner);

  // Đăng ký nhận snapshot đồ thị khi có thay đổi
  subscribe(listener: (snapshot: GraphDataSnapshot) => void): () => void;

  // Lấy snapshot đồ thị đầy đủ đã làm giàu (mtimeMs, link_count, function_count, overrides)
  async getGraphData(projectHash: string): Promise<GraphDataSnapshot>;

  // Xử lý lệnh Focus / Exclude / Reset từ Context Menu
  async controlGraphNode(command: GraphNodeControlCommand): Promise<GraphDataSnapshot>;

  // Khởi động chokidar watcher theo dõi file trong dự án (Delta Update)
  startWatching(projectHash: string, projectPath: string): FSWatcher;

  // Dừng watcher
  stopWatching(projectHash?: string): void;

  // Giải phóng tài nguyên
  dispose(): void;
}
```
* **Quy tắc làm giàu dữ liệu (Node Enrichment):**
  - `last_modified_ms`: Đọc trực tiếp từ `statSync(filePath).mtimeMs` trên file thật.
  - `function_count`: Đếm danh sách hàm trích xuất từ AST.
  - `link_count`: Đếm tổng số cạnh vào/ra của Node trên đồ thị.
  - `graph_overrides`: Đọc bảng `graph_overrides` trong SQLite `project.db`:
    - `state = 'FOCUSED'` $\rightarrow$ `is_focused = true`
    - `state = 'EXCLUDED'` $\rightarrow$ `visual_state = 'IGNORED'`
    - `state = 'ERROR'` $\rightarrow$ `visual_state = 'ERROR'` kèm `error_details`
* **Quy tắc xử lý lệnh `controlGraphNode`:**
  - `FOCUS`: Xóa cờ `FOCUSED` cũ, gán `FOCUSED` cho Node chỉ định trong transaction SQLite.
  - `EXCLUDE`: Ghi `state = 'EXCLUDED'` vào bảng `graph_overrides`.
  - `RESET`: Xóa bản ghi trong `graph_overrides` (`DELETE FROM graph_overrides WHERE node_id = ?`).
  - Sau mỗi thao tác, tự động sinh lại snapshot mới và phát thông báo `graph_data_update`.

---

### 3.3. `createGraphHandlers` (`src/main/GraphHandlers.ts`)
```typescript
export function createGraphHandlers(service: KnowledgeGraphService, getContents: () => WebContents | null) {
  // Trả về handlers khớp với SynapseRequests cho getGraphData và controlGraphNode
  return {
    getGraphData: async (projectHash) => service.getGraphData(projectHash),
    controlGraphNode: async (command) => { await service.controlGraphNode(command); },
  };
}
```
* Tự động đăng ký `service.subscribe` để phát event `contents.send('graph_data_update', snapshot)` xuống renderer bất cứ khi nào có thay đổi file hoặc lệnh điều khiển.

---

## 4. CHI TIẾT CÁC HÀM VÀ MODULE FRONTEND ĐÃ VIẾT

### 4.1. `KnowledgeGraphPanel.tsx` (`src/ui/graph/KnowledgeGraphPanel.tsx`)
* **State chính:**
  - `zoomLevel`, `panOffset`, `isDragging`, `dragStart`: Quản lý thu phóng và di chuyển canvas.
  - `hoveredNodeId`, `tooltipPos`: Quản lý hiển thị card Tooltip Hover.
  - `contextMenu`: Quản lý tọa độ `{ x, y, nodeId }` hiển thị popup chuột phải.
  - `isSearchOpen`, `searchQuery`, `highlightedNodeId`: Quản lý overlay tìm kiếm file và hiệu ứng highlight sau khi chọn.
  - `focusedNodeId`, `excludedNodeIds`: Lưu trạng thái điều khiển cục bộ để render ngay lập tức (zero latency).
* **Các hàm xử lý:**
  - `handleMouseDown`, `handleMouseMove`, `handleMouseUp`: Kéo để di chuyển (Drag-to-pan).
  - `handleWheel`: Cuộn để zoom mượt mà (Wheel-to-zoom).
  - `handleNodeMouseEnter`, `handleNodeMouseLeave`: Hover node mở Tooltip theo `04 Hover Node.svg`.
  - `handleNodeContextMenu`: Chuột phải mở menu `05 Context Menu.svg`.
  - `handleControlCommand(nodeId, 'FOCUS' | 'EXCLUDE' | 'RESET')`: Bắn IPC và cập nhật local state.
  - `handleSelectSearchResult(node)`: Pan/Zoom đưa node vào tâm và kích hoạt hiệu ứng Ping.

### 4.2. `useSynapseBridge.ts` (`src/renderer/hooks/useSynapseBridge.ts`)
* Thêm hàm `controlGraphNode(command: GraphNodeControlCommand): Promise<void>`.
* Gửi IPC `window.synapse.controlGraphNode(command)` và cập nhật optimistic vào `state.graphData`.

---

## 5. KẾT QUẢ KIỂM THỬ XÁC NHẬN

Toàn bộ hệ thống đã chạy qua các bài test nghiêm ngặt:

1. **Test Suite Backend (`tests/backend/graphify.test.ts`):** **7/7 PASS**
   - `GraphifyRunner` xuất `graph.json` vào shadow workspace, 0 file lạ trong source.
   - Chặn đứng đường dẫn output trùng lặp với project (`PROJECT_POLLUTION_BLOCKED`).
   - `KnowledgeGraphService` làm giàu dữ liệu với `mtimeMs` thật và bậc liên kết.
   - Thao tác `FOCUS`, `EXCLUDE`, `RESET` lưu bền vững vào bảng SQLite `graph_overrides`.
   - `chokidar` phát hiện file mới và phát `graph_data_update`.
   - IPC handler xác thực `UNTRUSTED_SENDER`.
   - Chạy `GraphifyRunner` trên chính mã nguồn hiện tại của dự án: trích xuất chính xác cấu trúc file và dependencies, thư mục gốc hoàn toàn sạch sẽ.

2. **Kiểm tra TypeScript:** `npx tsc --noEmit` $\rightarrow$ **PASS 0 lỗi**.
3. **Kiểm tra Bundle:** `npm run build` $\rightarrow$ **PASS 0 lỗi** (Tạo sạch bundle renderer, preload, main).
4. **Toàn bộ Test Suite Dự án:** `node --test` $\rightarrow$ **91 PASS, 0 FAIL, 1 SKIP** (trên tổng số 92 bài test).
