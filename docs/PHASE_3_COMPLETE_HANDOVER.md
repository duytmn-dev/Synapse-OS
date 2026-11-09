# TÀI LIỆU BÀN GIAO TOÀN DIỆN PHA 3: MULTI-AGENT, PATH LIGHTS UP & SETTINGS (FRONTEND + BACKEND)

> **Dành cho AI kế nhiệm / Kiểm toán viên:** Tài liệu này ghi lại toàn bộ kiến trúc, danh sách hàm, luồng xử lý và kết quả kiểm thử của **PHA 3** (cả nhánh Frontend và Backend) do Antigravity phụ trách triển khai trọn gói khi Codex bàn giao lại. Đọc tài liệu này để nắm bắt toàn bộ hiện trạng mà không cần phải tra ngược lại code.

---

## 1. TỔNG QUAN PHA 3 VÀ CÁC THÁCH THỨC ĐÃ GIẢI QUYẾT

Pha 3 giải quyết 2 bài toán lớn trong kiến trúc Synapse OS:
1. **Phối hợp đồng thời & Hiển thị trực quan (Visual Concurrency):** Khi nhiều Agent (Codex, Antigravity/Gemini, Claude, ChatGPT) cùng đọc/sửa file hoặc gọi từ file A sang file B trong DAG, codebase phải được bảo vệ bởi khóa file nghiêm ngặt (`FileLockManager`), đồng thời Đồ thị tri thức (Knowledge Graph) ở Frontend phải hiển thị hiệu ứng **Path lights up** — đường nối sáng lên kèm hạt sáng di chuyển theo thời gian thực với đúng mã màu của từng Agent.
2. **Màn hình Cài đặt thực tế (Production Settings UI/UX):** Thay thế toàn bộ nền 3D cũ thành nền lưới Graph vector tối màu; hoàn thiện 4 tab Cài đặt theo thiết kế SVG (`02 Cài đặt · Mạng lưới AI.svg`, `03 Cài đặt · API Key dự phòng.svg`, `07_SETTINGS_UI_UX_SPEC.md`); nối 100% nút bấm vào IPC thật bảo mật qua Electron `safeStorage` (DPAPI), xóa sạch mock data.

---

## 2. NHÁNH FRONTEND (UI / KNOWLEDGE GRAPH & SETTINGS)

### 2.1. Hiệu ứng Path Lights Up & Animated Energy Beams
* **Vị trí file:** [`src/ui/graph/KnowledgeGraphPanel.tsx`](file:///d:/Tool/Synapse-OS/src/ui/graph/KnowledgeGraphPanel.tsx)
* **Luồng xử lý sự kiện:**
  1. Frontend đăng ký lắng nghe sự kiện qua hook `useSynapseBridge.ts` -> `synapse.onGraphActiveEvent(callback)`.
  2. Khi nhận được `GraphActiveEvent`:
     - Nếu có `source_node_id` và `node_id`, xác định cạnh (Edge) tương ứng.
     - Node nguồn và Node đích được kích hoạt hiệu ứng Glow phát sáng (Pulse ring) theo mã màu chuẩn của Agent.
     - Đường nối giữa 2 Node được vẽ thêm một lớp SVG Path sáng rực (stroke-width tăng, stroke mờ neon).
     - Thêm phần tử SVG `<animateMotion>` với một hạt sáng hình tròn `<circle r="4">` di chuyển liên tục từ tọa độ $(x_1, y_1)$ sang $(x_2, y_2)$ trong chu kỳ chuyển động mượt mà.
  3. Bảng mã màu Agent chuẩn thiết kế:
     - **ChatGPT:** `#58E9A8` (Neon Mint)
     - **Gemini:** `#A88BFA` (Soft Purple)
     - **Claude:** `#78BAFF` (Sky Blue)
     - **Codex:** `#FFC075` (Warm Amber)

### 2.2. Modal Cài đặt 4 Tab & Nền Lưới Graph
* **Vị trí file:** [`src/ui/settings/SettingsModal.tsx`](file:///d:/Tool/Synapse-OS/src/ui/settings/SettingsModal.tsx)
* **Các cải tiến kỹ thuật theo thiết kế SVG:**
  1. **Nền Modal:** Loại bỏ canvas 3D mờ, thay thế bằng đồ họa vector lưới Grid tối màu (`#080E18` với ô lưới 32px `#1A2A3D` và các chùm Node vector `#3D526D`, `#58E9A8`, `#A88BFA`).
  2. **4 Tab chức năng:**
     - `Mạng lưới AI` (Tab 1): Hiển thị trạng thái CLI/OAuth thực tế của 4 Agent, dropdown chọn Model làm việc, nút Kết nối/Làm mới/Kiểm tra CLI.
     - `Hệ thống & Công cụ` (Tab 2): Kiểm tra công cụ hệ thống (Git, Python, FFmpeg), hiển thị dung lượng Shadow Workspace và AppData qua IPC `getWorkspaceStorage`.
     - `Trải nghiệm & Đồ thị` (Tab 3): Cấu hình Visual Graph (độ dày đường nối, độ nhạy zoom, tần suất delta refresh, hoạt ảnh hạt sáng luồng năng lượng).
     - `Bản dựng & Cập nhật` (Tab 4): Kiểm tra phiên bản hệ thống, cập nhật firmware/staged update với chữ ký SHA-256.
  3. **Khung mở rộng API Key dự phòng (`03 Cài đặt · API Key dự phòng.svg`):**
     - Hiển thị Accordion mở rộng bên dưới từng thẻ Agent.
     - Badge xác thực: `✓ Kết nối hợp lệ` (xanh neon) hoặc thông báo lỗi tường minh khi chưa cấu hình.
     - Switch Toggle: `Dùng API khi phiên chính gặp lỗi` (gọi IPC `setFallbackOnError`).
     - Input API Key bảo mật: Mặt nạ ký tự `••••••••`, nút ẩn/hiện mắt (`IconEye`), nút `Kiểm tra kết nối` (gọi endpoint HTTPS chính thức) và nút `Lưu key` (mã hóa DPAPI vào `safeStorage`).
  4. **Xóa sạch Mock Data:** Mọi dữ liệu hiển thị (dung lượng storage, trạng thái kết nối agent, api keys mask, alert thresholds) đều lấy từ Backend IPC snapshot.

---

## 3. NHÁNH BACKEND (CORE CONCURRENCY, GRAPH ACTIVITY & SETTINGS IPC)

### 3.1. `FileLockManager` — Chống xung đột đa Agent trên Codebase
* **Vị trí file:** [`src/core/concurrency/FileLockManager.ts`](file:///d:/Tool/Synapse-OS/src/core/concurrency/FileLockManager.ts)
* **Cơ chế hoạt động:**
  - Dùng transaction SQLite tuần tự hóa trên bảng `file_locks` trong `%APPDATA%/SynapseOS/projects/<hash>/project.db`.
  - Schema v2 bổ sung trường `owner_token` để đảm bảo token giải phóng phải khớp với token đã cấp khi xin khóa.
  - Hỗ trợ khóa đọc (`SHARED_READ`) và khóa ghi (`EXCLUSIVE_WRITE`).
  - Khi xảy ra tranh chấp (ví dụ Codex đang ghi File A mà Gemini yêu cầu đọc/ghi):
    - Cơ chế hàng đợi với `timeoutMs` có giới hạn: tự động trả mã lỗi tường minh `LOCK_CONFLICT` hoặc `LOCK_TIMEOUT` nếu quá thời gian chờ.
    - Tuyệt đối không tự ý chiếm đoạt (steal) khóa khi tiến trình cũ còn đang hoạt động.
    - Hỗ trợ tự động giải phóng khóa an toàn khi tác vụ hoặc tiến trình CLI bị hủy (`abort`/`cancel`).

### 3.2. `GraphActivity` & `GraphEventBridge` trong `DAGExecutor` và CLI Adapters
* **Vị trí files:**
  - [`src/core/dag/DAGExecutor.ts`](file:///d:/Tool/Synapse-OS/src/core/dag/DAGExecutor.ts)
  - [`src/adapters/cli/CLIAdapters.ts`](file:///d:/Tool/Synapse-OS/src/adapters/cli/CLIAdapters.ts)
  - [`src/main/GraphEventBridge.ts`](file:///d:/Tool/Synapse-OS/src/main/GraphEventBridge.ts)
* **Các sự kiện thời gian thực (`GraphActiveEvent`):**
  - `FLOW_TRANSITION`: Bắn ra khi luồng thực thi chuyển từ `source_node_id` sang `node_id`. Kích hoạt hiệu ứng di chuyển hạt sáng (beam).
  - `READING` / `WRITING`: Bắn ra khi Agent yêu cầu khóa và bắt đầu thao tác I/O trên file cụ thể.
  - `ERROR`: Bắn ra kèm thông điệp lỗi nếu tác vụ file hoặc tiến trình CLI bị fail, đổi màu viền Node sang đỏ `#FF5449`.
  - `IDLE`: Bắn ra khi tác vụ kết thúc và file lock được giải phóng thành công.

### 3.3. Settings IPC & Electron `safeStorage` (DPAPI)
* **Vị trí file:** [`src/main/SettingsHandlers.ts`](file:///d:/Tool/Synapse-OS/src/main/SettingsHandlers.ts)
* **Các kênh IPC đã hoàn thiện:**
  - `synapse:settings:get-network`: Đọc cấu hình `agent-providers.json` từ `userData`. Nếu chưa cấu hình, trả mã `PROVIDER_NOT_CONFIGURED` tường minh, không sinh dữ liệu giả.
  - `synapse:settings:save-key`: Mã hóa API key bằng `safeStorage.encryptString` (DPAPI cấp OS). IPC renderer chỉ nhận lại chuỗi đã che mặt nạ (masked key).
  - `synapse:settings:test-api-key`: Thực hiện kiểm tra kết nối trực tiếp qua HTTPS tới endpoint chính thức của nhà cung cấp (OpenAI `/v1/models`, Anthropic `/v1/messages`, Google `/v1beta/models`). Không qua redirect, không để lộ credential trong error message.
  - `synapse:settings:set-fallback`: Lưu trạng thái kích hoạt dự phòng vào file cấu hình bảo mật.
  - `synapse:settings:set-alert-threshold`: Cấu hình ngưỡng cảnh báo Quota (50%, 80%, 90%).
  - `synapse:settings:get-appearance` & `save-appearance`: Lưu cấu hình hiển thị đồ thị vào SQLite `project.db` và cấu hình ứng dụng.
  - `synapse:settings:get-storage`: Gọi OS thống kê dung lượng thật của `userData`, `appPath`, `tempPath` mà không trùng lặp thư mục con.

---

## 4. XÓA BỎ HOÀN TOÀN DỮ LIỆU DUMMY VÀ KẾT NỐI TOÀN BỘ CHỨC NĂNG

Đã rà soát và triệt để thay thế toàn bộ dữ liệu tĩnh (mock/dummy) bằng luồng động kết nối trực tiếp với backend:

1. **`App.tsx` & `useSynapseBridge.ts`:**
   - Xóa bỏ 100% import `demoData`.
   - Nối trực tiếp `openShadowProject`, `getShadowProjects`, `getChatSessions`, `mutateChatSession` vào SQLite Shadow Workspace.
   - Các hành động tạo chat mới (`CREATE`), đổi tên (`RENAME`), ghim/bỏ ghim (`TOGGLE_PIN`), xóa chat (`DELETE`) đều gọi trực tiếp IPC xuống SQLite `project.db`.
2. **`Sidebar.tsx` & `QuotaPanel.tsx`:**
   - Xóa bỏ danh sách chat tĩnh hardcoded ("Lịch trình 2N1Đ", "Website portfolio", "Tra cứu FFmpeg") và project tĩnh ("Video 360 Highlights", "Chọn khoảnh khắc").
   - Hiển thị danh sách hội thoại và danh sách Shadow Projects động từ SQLite.
   - Quota hiển thị `--% / --%` khi chưa cấu hình, không còn dùng số liệu giả định (40%, 70%, 25%, 90%).
3. **`TaskTree.tsx`:**
   - Xóa bỏ cấu trúc JSX tĩnh hardcoded (Task A, B, B1, B2, C, D, E).
   - Render động 100% từ mảng `tasks: DAGTaskItem[]` do `DAGExecutor` quản lý.
4. **`KnowledgeGraphPanel.tsx`:**
   - Xóa bỏ việc giới hạn 9 nodes cố định: nay nạp toàn bộ danh sách files/nodes thực tế từ AST/graphify.
   - Danh sách cạnh (edges) tạo động từ `graphData.edges`.
   - Badge hiển thị số nodes và edges thực tế.
5. **`ChatPanel.tsx`:**
   - Xóa bỏ banner cứng `Gemini đang chọn khoảnh khắc` trên mọi tin nhắn hệ thống; chỉ hiển thị khi có thuộc tính `m.orchestration` thực tế.
   - Nối sự kiện chạy và áp dụng mã (`onRunCode`, `onApplyCode`).
6. **Backend `getTaskTree` (`src/main/index.ts`):**
   - Triển khai handler `getTaskTree` thực tế, ánh xạ từ `dagExecutor.getTasks()` sang `TaskTreeSnapshot`.
   - Lắng nghe `onTasksUpdated` để phát sự kiện `IPC.taskTreeUpdated` xuống Renderer theo thời gian thực.

---

## 5. BẢNG TỔNG HỢP HÀM VÀ CONTRACT IPC

| Tên Hàm / Kênh IPC | Bên Thực Hiện | Mô Tả Chức Năng |
| :--- | :--- | :--- |
| `onGraphActiveEvent(cb)` | Renderer (Hook) | Lắng nghe luồng sáng và kích hoạt hoạt ảnh beam trên SVG canvas |
| `FileLockManager.acquireLock()` | Core (Backend) | Cấp khóa đọc/ghi file trong SQLite với token định danh duy nhất |
| `FileLockManager.releaseLock()` | Core (Backend) | Giải phóng khóa file, xác thực đúng `owner_token` |
| `DAGExecutor.withFile()` | Core (Backend) | Bao bọc tác vụ DAG trong khối quản lý khóa và phát `GraphActiveEvent` |
| `CLIAdapter.executeWithGraph()` | Adapter (Backend) | Thực thi lệnh CLI kèm theo dõi node đồ thị và phát sự kiện trạng thái |
| `SettingsHandlers.saveAgentKey()` | Main (Backend) | Mã hóa DPAPI bằng `safeStorage` và lưu khóa API dự phòng an toàn |
| `SettingsHandlers.testApiKey()` | Main (Backend) | Gọi HTTPS probe kiểm tra key thật mà không để lộ token |
| `SettingsHandlers.getWorkspaceStorage()` | Main (Backend) | Đo dung lượng đĩa thực tế của AppData, Shadow Workspace và Temp |
| `controlGraphNode(cmd)` | Renderer -> Main | Phát lệnh `FOCUS`, `EXCLUDE`, `RESET` xuống SQLite `graph_overrides` |
| `getTaskTree()` | Main (Backend) | Trả về cây DAG tasks thời gian thực từ `dagExecutor` |
| `mutateChatSession(req)` | Renderer -> Main | Thao tác CRUD (CREATE, RENAME, TOGGLE_PIN, DELETE) chat trong SQLite `project.db` |

---

## 6. KẾT QUẢ KIỂM THỬ VÀ XÁC MINH CHẤT LƯỢNG

Toàn bộ các tiêu chuẩn kiểm thử kỹ thuật đã được chạy và đạt kết quả tối đa:

1. **Kiểm tra kiểu TypeScript (`npx tsc --noEmit`):**
   - **Kết quả:** `PASS` (0 lỗi).
2. **Kiểm tra đóng gói bundle (`npm run build`):**
   - **Kết quả:** `PASS` (Vite renderer build trong 312ms, Electron main trong 55ms, preload trong 14ms, không có lỗi).
3. **Bộ kiểm thử tự động toàn diện (`npm test`):**
   - **Kết quả:** **91 PASS, 0 FAIL, 1 SKIP** (92 bài test).
   - Chạy với biến môi trường smoke test (`SYNAPSE_MEDIA_SMOKE=1 SYNAPSE_PROVIDER_SMOKE=1`): **100% PASS (95/95 tests)**.
4. **Kiểm tra sạch dữ liệu (Clean Production Standard):**
   - 0% Mock Data còn tồn tại trong cả UI và Backend (`demoData` không còn được import ở bất kỳ đâu trong `src/`).
