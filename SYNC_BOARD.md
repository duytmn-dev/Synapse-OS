# BẢNG ĐỒNG BỘ TIẾN ĐỘ SONG SONG (SYNAPSE OS - KNOWLEDGE GRAPH MIGRATION)

> **QUY TẮC CẬP NHẬT DÀNH CHO AI:**
> 1. Chỉ đánh dấu `[x]` sau khi tính năng đã code xong, chạy pass bài Test quy định và xóa sạch dữ liệu mẫu (mock data) nếu đã nối luồng thật.
> 2. Ghi rõ kết quả chạy lệnh kiểm tra (`npx tsc --noEmit`, `npm test`, `npm run build`) vào phần Ghi chú của từng Pha.

---

## NỀN TẢNG CŨ ĐÃ HOÀN TẤT (LEGACY BASELINE - GIỮ NGUYÊN)
- [x] Khởi tạo project React, TypeScript, Tailwind/Vite, Electron & `electron-builder`.
- [x] Lõi Backend Ca 1 & Ca 2: `DAGExecutor` (task cha-con), `UniversalTriageRouter`, `Blackboard`, `QuotaTracker` (cửa sổ trượt 5h/7 ngày).
- [x] `LocalMediaTools`: Lazy-Load FFmpeg vào `.plugins/ffmpeg/`, xác minh SHA-256.
- [x] Đo dung lượng User Data, App, Temp và mã hóa API Key dự phòng bằng Electron `safeStorage` (DPAPI).

---

## PHA 0: CẬP NHẬT HỢP ĐỒNG DỮ LIỆU GRAPH & SHADOW WORKSPACE (CHẠY TUẦN TỰ)
**Nhánh FRONTEND (Antigravity - Model: Claude Sonnet 5.5 / Gemini 3.8 Flash):**
- [ ] Cập nhật `src/shared/types.ts` khớp 100% với `docs/04_SHARED_DATA_CONTRACTS.md` (Bổ sung `GraphData`, `GraphNode`, `GraphEdge`, `GraphActiveEvent`, `ShadowProjectMeta`, `ChatSessionItem`, cập nhật `AppearanceSettings` sang Graph).
- [ ] **TEST PHA 0 (FE):** Chạy `npx tsc --noEmit` đảm bảo `types.ts` không có lỗi cú pháp.

**Nhánh BACKEND (Codex - Model: GPT-6.1 Terra):**
- [ ] Cập nhật `src/main/preload.ts` phơi bày đầy đủ các IPC channels mới cho Knowledge Graph, Shadow Workspace và Quản lý Chat theo đúng `src/shared/types.ts`.
- [ ] **TEST PHA 0 (BE):** Chạy contract test kiểm tra toàn bộ hàm trong `window.synapse` khớp kiểu với `types.ts`.

---

## PHA 1: HẠ TẦNG SHADOW WORKSPACE & ĐẬP BỎ 3D / DỰNG UI SVG TĨNH (CHẠY SONG SONG)
**Nhánh FRONTEND (Antigravity - Model: Claude Opus 5.5 Medium):**
- [ ] Gỡ bỏ hoàn toàn code và dependencies của Văn phòng 3D (`office_scene.glb`, Three.js components).
- [ ] Dựng lại Header và Layout 3 cột bám sát tuyệt đối `docs/design/01 Dashboard.svg`:
  - Topbar: Nút chuyển chế độ `[Chat]` / `[Chat + Graph]`, Badge trạng thái `[• SHADOW WORKSPACE]`, nút `[Cài đặt]`.
  - Sidebar Trái: Lịch sử chat, Cây Dự án (có icon ổ đĩa báo hiệu Shadow Workspace bên cạnh tên dự án), Bảng Giới hạn Agent (% 5h / Tuần với thanh progress bar phẳng theo đúng màu Agent).
  - Cột Giữa: Khung Chat, Badge tiến trình (`• Gemini đang chọn khoảnh khắc` + nút `Xem đồ thị ↗`), Code Block (`Copy`, `Run`, `Apply`), Khung `360° PREVIEW` và thanh Input dưới cùng.
- [ ] Dựng các Popover/Modal Quản lý cuộc trò chuyện theo đúng `docs/design/07 Quản lý chat.svg`: Menu `[Đổi tên / Bỏ ghim / Xóa]`, Modal `Đổi tên chat`, Modal `Xóa cuộc trò chuyện?`.
- [ ] **TEST PHA 1 (FE):** Render giao diện khớp từng pixel với file SVG; kiểm tra đóng/mở các modal Quản lý chat và chuyển đổi 2 chế độ `Chat` / `Chat + Graph` mượt mà, không lỗi console.

**Nhánh BACKEND (Codex - Model: GPT-6.1 Sol):**
- [ ] Viết `ShadowWorkspaceManager` (`src/core/workspace/ShadowWorkspaceManager.ts`): Nhận đường dẫn thư mục dự án thật, băm SHA-256 tạo `<project_hash>`, khởi tạo thư mục ẩn tại `%APPDATA%/SynapseOS/projects/<project_hash>/`.
- [ ] Khởi tạo SQLite Database (`project.db`) bên trong thư mục Shadow Workspace với 4 bảng: `project_metadata`, `chat_sessions`, `file_locks`, `graph_overrides`.
- [ ] Viết `ContextHydrator`: Khi tạo chat mới trong dự án cũ, tự động đọc `core_requirements` + `chat_summaries` + `graph.json` từ Shadow Workspace nạp vào System Prompt trong RAM.
- [ ] **TEST PHA 1 (BE):** Viết test truyền một thư mục dự án thật vào: (1) Xác nhận `project.db` được tạo trong `%APPDATA%`, (2) Xác nhận thư mục dự án gốc KHÔNG có bất kỳ file mới nào bị tạo ra, (3) Test CRUD đổi tên/ghim/xóa chat trong SQLite. Xóa dữ liệu test sau khi pass.

---

## PHA 2: TÍCH HỢP GRAPHIFY CLI & BẢN ĐỒ KNOWLEDGE GRAPH TƯƠNG TÁC (CHẠY SONG SONG)
**Nhánh FRONTEND (Antigravity - Model: Claude Opus 5.5 Medium):**
- [ ] Dựng khung `Codebase Knowledge Graph` ở nửa trên cột phải theo đúng `docs/design/01 Dashboard.svg` và `docs/design/Graph Nodes & Flow.svg`:
  - Nền lưới grid tối màu, badge góc trái `9 NODES / 10 EDGES`, badge góc phải `• ĐANG CHẠY`, cụm 4 nút điều khiển góc phải (`Tìm kiếm 🔍`, `Zoom In +`, `Zoom Out -`, `Fit View ⛶`), chú thích đáy (`• ChatGPT`, `• Gemini`, `• Bỏ qua`, `• Lỗi`, `Cuộn để zoom`).
- [ ] Dựng 3 thành phần tương tác trên Đồ thị bám sát thiết kế SVG:
  1. **Hover Tooltip (`docs/design/04 Hover Node.svg`):** Kính mờ hiển thị icon file, tên file (`pipeline.py`), số hàm & liên kết (`5 hàm · 5 liên kết`), thời gian sửa (`Thay đổi 2 phút trước`).
  2. **Context Menu (`docs/design/05 Context Menu.svg`):** Click chuột phải vào Node hiện popup viền xanh neon gồm 2 nút `[Tập trung (Focus)]` và `[Bỏ qua (Exclude)]`.
  3. **Search Overlay (`docs/design/06 Tìm kiếm file.svg`):** Bấm nút kính lúp hiện ô tìm kiếm (`pipeline`) và danh sách kết quả (`pipeline.py · 1 kết quả`), click vào tự động pan/zoom tới Node đó.
- [ ] **TEST PHA 2 (FE):** Test nạp dữ liệu đồ thị mẫu, kiểm tra đầy đủ các trạng thái Node (Mặc định, ChatGPT, Gemini, Bỏ qua, Lỗi), Hover, Right-click, Search và Zoom/Pan.

**Nhánh BACKEND (Codex - Model: GPT-6.1 Terra & Sol):**
- [ ] Viết `GraphifyRunner` (`src/adapters/graphify/GraphifyRunner.ts`): Gọi CLI `graphify` qua `child_process` (dùng `tree-sitter` AST local, $0 API). Ép toàn bộ output (`graph.json`) xuất thẳng vào thư mục Shadow Workspace trong `%APPDATA%`.
- [ ] Viết parser đọc `graph.json`, kết hợp với bảng `graph_overrides` (trạng thái Focus/Exclude, số hàm, mtime của file thật) để chuẩn hóa thành `GraphData` bắn xuống IPC.
- [ ] Cài đặt `FileWatcher` (chokidar) theo dõi thư mục dự án: Khi có file code thay đổi, chỉ quét cập nhật cục bộ (Delta Update) và phát sự kiện `graph_data_update` xuống Frontend.
- [ ] **TEST PHA 2 (BE):** Chạy `GraphifyRunner` trên chính thư mục mã nguồn của dự án: xác nhận xuất ra `GraphData` thật có đầy đủ Nodes/Edges, thời gian sửa file chính xác, và thư mục gốc hoàn toàn sạch sẽ.

---

## PHA 3: ĐỒNG BỘ MULTI-AGENT, LUỒNG SÁNG (PATH LIGHTS UP) & SETTINGS UI (CHẠY SONG SONG)
**Nhánh FRONTEND (Antigravity - Model: Gemini 3.8 Flash):**
- [ ] Lắng nghe sự kiện `graph_active_event` từ IPC Bridge: Kích hoạt hiệu ứng Node Glow và **Path lights up** (hạt sáng/luồng sáng chạy dọc theo Edge giữa 2 Node theo đúng `docs/design/Graph Nodes & Flow.svg`) với mã màu chuẩn của từng Agent.
- [ ] Cập nhật Modal Cài đặt theo đúng `docs/design/02 Cài đặt · Mạng lưới AI.svg` và `docs/design/03 Cài đặt · API Key dự phòng.svg`:
  - Đổi tên Tab 3 thành `Trải nghiệm & Đồ thị` (thay cho `Trải nghiệm & 3D`).
  - Nền phía sau Modal là hình nền lưới Đồ thị chìm (thay cho nền 3D mờ cũ).
  - Nối toàn bộ nút bấm (`Đăng xuất`, `Làm mới`, `Kiểm tra CLI`, `Kết nối`, `Kiểm tra kết nối`, `Lưu key`, Toggle `Dùng API khi phiên chính gặp lỗi`) vào IPC thật. Xóa sạch dữ liệu minh họa.
- [ ] **TEST PHA 3 (FE):** Nhận sự kiện thật từ Backend làm sáng đúng đường nối trên đồ thị; lưu/kiểm tra API key dự phòng và đổi trạng thái Focus/Exclude hoạt động xuyên suốt với SQLite.

**Nhánh BACKEND (Codex - Model: GPT-6.1 Sol):**
- [ ] Viết `FileLockManager` (`src/core/concurrency/FileLockManager.ts`): Quản lý khóa đọc/ghi file khi Codex và Antigravity chạy song song. Nếu File A đang bị khóa ghi bởi Codex, yêu cầu ghi của Antigravity phải được đưa vào hàng đợi hoặc từ chối rõ ràng.
- [ ] Nối `DAGExecutor` và `CLI Adapters` vào `GraphEventBridge`: Mỗi khi Agent bắt đầu đọc/sửa file hoặc gọi từ file A sang file B, bắn ngay sự kiện `GraphActiveEvent` (kèm `agent_id`, `node_id`, `source_node_id`, `worker_model_name`) xuống Frontend.
- [ ] Hoàn thiện toàn bộ IPC cho Settings: lấy trạng thái kết nối thực tế của CLI/OAuth, kiểm tra kết nối API Key dự phòng thật, lưu và đọc từ `safeStorage`.
- [ ] **TEST PHA 3 (BE):** Chạy bài test mô phỏng 2 tiến trình Codex và Gemini cùng truy cập codebase: xác nhận `FileLockManager` chặn xung đột 100%, sự kiện `GraphActiveEvent` bắn đúng trình tự, xóa bỏ hoàn toàn mọi mock/stub trong mã nguồn.

---

## PHA 4: KIỂM TOÁN TOÀN CỤC & ĐÓNG GÓI BẢN DỰNG (CODEX & GEMINI)
- [ ] Chạy toàn bộ test suite (`npm test`), kiểm tra kiểu (`npx tsc --noEmit`) đạt 0 lỗi.
- [ ] Rà soát đảm bảo 0% dữ liệu giả lập (mock/illustrative data) còn sót lại trong UI và Backend.
- [ ] Đóng gói `npm run build:win` xuất file cài đặt `.exe` thành công.