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
- [x] Cập nhật `src/shared/types.ts` khớp 100% với `docs/04_SHARED_DATA_CONTRACTS.md` (Bổ sung `GraphData`, `GraphNode`, `GraphEdge`, `GraphActiveEvent`, `ShadowProjectMeta`, `ChatSessionItem`, cập nhật `AppearanceSettings` sang Graph).
- [x] **TEST PHA 0 (FE):** Chạy `npx tsc --noEmit` đảm bảo `types.ts` không có lỗi cú pháp. *(Ghi chú: `npx tsc --noEmit` và `npm run build` đều PASS 100%, 0 lỗi cú pháp / type error).*

**Nhánh BACKEND (Codex - Model: GPT-6.1 Terra):**
- [x] Cập nhật `src/main/preload.ts` phơi bày đầy đủ các IPC channels mới cho Knowledge Graph, Shadow Workspace và Quản lý Chat theo đúng `src/shared/types.ts`.
- [x] **TEST PHA 0 (BE):** Chạy contract test kiểm tra toàn bộ hàm trong `window.synapse` khớp kiểu với `types.ts`.

**Ghi chú PHA 0 (BE — 09/11/2026):**
- Bridge gồm 23 hàm gọi IPC và 9 subscription, dùng trực tiếp kiểu chung cho Graph, Shadow Workspace, Chat Session Mutation, Task Tree và Settings. Các kênh legacy tiếp tục hoạt động. `Phase0Handlers` được đăng ký trong main process, kiểm tra sender/main frame và dọn handler khi thoát.
- Khung sườn của 17 thao tác thuộc pha sau trả lỗi tường minh `NOT_IMPLEMENTED` (mã nằm trong message để đi qua Electron IPC); không giả lập dữ liệu, không báo ghi thành công và không tạo file trong thư mục dự án. SQLite/Graphify/Settings service thật được triển khai ở các pha tương ứng.
- `npx tsc --noEmit`: **PASS**, bao gồm `tests/contracts/backend.contract.ts` kiểm tra chính xác kiểu của toàn bộ API, preload và tham số handler.
- `node --experimental-transform-types --experimental-vm-modules --test tests/contracts/backend.test.ts`: **PASS 35/35**, kiểm tra preload expose, channel/arguments/results/errors, event/unsubscribe, phân quyền sender và rollback đăng ký handler.
- `npm test`: **chưa chạy được vì package.json chưa có script test**. Chạy trực tiếp toàn bộ test hiện có bằng `node --experimental-transform-types --experimental-vm-modules --test "src/**/*.test.ts" "tests/**/*.test.ts"`: **60 PASS, 0 FAIL, 1 SKIP** (bài tải FFmpeg thật được opt-in riêng).
- `npm run build`: **PASS** (renderer, Electron main và preload); Vite còn cảnh báo bundle renderer lớn hơn 500 kB.

---

## PHA 1: HẠ TẦNG SHADOW WORKSPACE & ĐẬP BỎ 3D / DỰNG UI SVG TĨNH (CHẠY SONG SONG)
**Nhánh FRONTEND (Antigravity - Model: Claude Opus 5.5 Medium):**
- [x] Gỡ bỏ hoàn toàn code và dependencies của Văn phòng 3D (`office_scene.glb`, Three.js components).
- [x] Dựng lại Header và Layout 3 cột bám sát tuyệt đối `docs/design/01 Dashboard.svg`:
  - Topbar: Nút chuyển chế độ `[Chat]` / `[Chat + Graph]`, Badge trạng thái `[• SHADOW WORKSPACE]`, nút `[Cài đặt]`.
  - Sidebar Trái: Lịch sử chat, Cây Dự án (có icon ổ đĩa báo hiệu Shadow Workspace bên cạnh tên dự án), Bảng Giới hạn Agent (% 5h / Tuần với thanh progress bar phẳng theo đúng màu Agent).
  - Cột Giữa: Khung Chat, Badge tiến trình (`• Gemini đang chọn khoảnh khắc` + nút `Xem đồ thị ↗`), Code Block (`Copy`, `Run`, `Apply`), Khung `360° PREVIEW` và thanh Input dưới cùng.
- [x] Dựng các Popover/Modal Quản lý cuộc trò chuyện theo đúng `docs/design/07 Quản lý chat.svg`: Menu `[Đổi tên / Bỏ ghim / Xóa]`, Modal `Đổi tên chat`, Modal `Xóa cuộc trò chuyện?`.
- [x] **TEST PHA 1 (FE):** Render giao diện khớp từng pixel với file SVG; kiểm tra đóng/mở các modal Quản lý chat và chuyển đổi 2 chế độ `Chat` / `Chat + Graph` mượt mà, không lỗi console. *(Ghi chú: `npx tsc --noEmit` và `npm run build` PASS 100%, 0 lỗi. Toàn bộ test suite 73 PASS, 0 FAIL, 1 SKIP).*

**Ghi chú PHA 1 (FE — 09/11/2026):**
- Đã gỡ bỏ toàn bộ thư viện 3D (`three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`) và file `office_scene.glb`.
- Đã cài đặt và nạp Typography chuẩn: `@fontsource-variable/inter` và `@fontsource/jetbrains-mono`.
- Dựng lại toàn bộ giao diện theo chuẩn màu & kích thước trích xuất từ SVG (`01 Dashboard.svg`, `07 Quản lý chat.svg`):
  - Topbar với Logo Synapse OS Hexagon, Switcher `[💬 Chat]` / `[🕸️ Chat + Graph]`, Badge `[• SHADOW WORKSPACE]`, Nút `[⚙️ Cài đặt]`.
  - Sidebar với nút `+ Cuộc trò chuyện mới`, `LỊCH SỬ CHAT` (ghim/bỏ ghim, menu •••), Cây `DỰ ÁN` với icon `IconShadowDb`, và Bảng Quota 4 Agent (`ChatGPT #58E9A8`, `Gemini #A88BFA`, `Claude #78BAFF`, `Codex #FFC075`).
  - ChatPanel trung tâm với Header `Chọn khoảnh khắc`, Subtitle `Video 360 Highlights / Chat dự án`, User message kèm attachment pill, Assistant response kèm banner `Gemini đang chọn khoảnh khắc` + `Xem đồ thị ↗`, `MediaPreview` 360 horizon canvas, `CodeBlock` `pipeline.py` với nút Run/Copy/Apply và syntax highlighting, `SmartInputBar` kèm dropdown Agent & icon Send xanh `#58E9A8`.
  - Cột phải hiển thị `KnowledgeGraphPanel` và `TaskTree` khi ở chế độ `[Chat + Graph]`, tự động ẩn khi ở chế độ `[Chat]`.
  - Dựng đầy đủ Menu popover `•••`, Modal `Đổi tên chat` (với viền glow `#58E9A8`) và Modal `Xóa cuộc trò chuyện?` (với nút xác nhận đỏ `#FF5449`).
- `npx tsc --noEmit`: **PASS 0 lỗi**.
- `npm run build`: **PASS 0 lỗi** (Tạo sạch bundle renderer, preload, main).
- Backend & Contract tests: **73 PASS, 0 FAIL, 1 SKIP**.

**Nhánh BACKEND (Codex - Model: GPT-6.1 Sol):**
- [x] Viết `ShadowWorkspaceManager` (`src/core/workspace/ShadowWorkspaceManager.ts`): Nhận đường dẫn thư mục dự án thật, băm SHA-256 tạo `<project_hash>`, khởi tạo thư mục ẩn tại `%APPDATA%/SynapseOS/projects/<project_hash>/`.
- [x] Khởi tạo SQLite Database (`project.db`) bên trong thư mục Shadow Workspace với 4 bảng: `project_metadata`, `chat_sessions`, `file_locks`, `graph_overrides`.
- [x] Viết `ContextHydrator`: Khi tạo chat mới trong dự án cũ, tự động đọc `core_requirements` + `chat_summaries` + `graph.json` từ Shadow Workspace nạp vào System Prompt trong RAM.
- [x] **TEST PHA 1 (BE):** Viết test truyền một thư mục dự án thật vào: (1) Xác nhận `project.db` được tạo trong `%APPDATA%`, (2) Xác nhận thư mục dự án gốc KHÔNG có bất kỳ file mới nào bị tạo ra, (3) Test CRUD đổi tên/ghim/xóa chat trong SQLite. Xóa dữ liệu test sau khi pass.

**Ghi chú PHA 1 (BE — 09/11/2026):**
- `WorkspaceRuntime` cấu hình Electron `userData` thành `app.getPath('appData')/SynapseOS`. SQLite thật (`node:sqlite`) dùng transaction, prepared statement, schema version và đóng connection sau mỗi thao tác. Chặn đường dẫn chồng lấn, junction/symlink và hard link tới DB/sidecar.
- Đã nối bốn IPC `openShadowProject`, `getShadowProjects`, `getChatSessions`, `mutateChatSession` vào dịch vụ thật; phát `shadow_projects_update`/`chat_sessions_update` sau thành công. CRUD hỗ trợ tạo, đổi tên, ghim/bỏ ghim, xóa và lưu bền qua khởi động lại; kiểm tra scope và sender trước thao tác.
- `setCoreRequirements` và `saveSessionContent` lưu nội dung thật. CREATE đọc yêu cầu + tóm tắt cũ + graph trong transaction, rồi giữ system prompt trong RAM sau commit; backend lấy bằng `getSessionContext`. Graph chưa tồn tại được biểu diễn bằng `null`; graph hỏng gây lỗi và rollback CREATE.
- Thư mục không có Git có `git_branch = ''` sau khi kiểm chứng; Git không cài/lỗi trạng thái trả mã lỗi, không tự gán `main`. Mutation yêu cầu `project_hash` rõ ràng và title cho CREATE/RENAME. Chat độc lập (`project_hash: null`) trả `UNSUPPORTED_SCOPE` vì đặc tả PHA 1 chưa quy định nơi lưu ngoài dự án.
- `node --experimental-transform-types --test "tests/backend/*.test.ts"`: **13 PASS, 0 FAIL**. Bao gồm SQLite/file system thật và Electron thật với preload đã bundle, appData cô lập, renderer sandbox, CRUD IPC, hydration, notification và lỗi đi qua IPC. Kiểm tra snapshot thư mục nguồn không đổi; fixture/DB/cache của test được xóa trong cleanup. Test junction cần quyền tạo junction trên Windows.
- `npx tsc --noEmit -p tests/backend/tsconfig.json`: **PASS**. `node --experimental-transform-types --experimental-vm-modules --test "src/**/*.test.ts" "tests/**/*.test.ts"`: **73 PASS, 0 FAIL, 1 SKIP** (test tải FFmpeg thật opt-in).
- `npm test`: **chưa có script test**; dùng lệnh Node ở trên. `npx tsc --noEmit` / `npm run build` toàn dự án **chưa PASS do frontend đang chuyển đổi 3D**; lần build cuối báo `src/renderer/App.tsx` còn import `../ui/office/OfficePanel` đã bị xóa và callback `c` thiếu kiểu. Backend không sửa các file frontend.

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
- [x] Lắng nghe sự kiện `graph_active_event` từ IPC Bridge: Kích hoạt hiệu ứng Node Glow và **Path lights up** (hạt sáng/luồng sáng chạy dọc theo Edge giữa 2 Node theo đúng `docs/design/Graph Nodes & Flow.svg`) với mã màu chuẩn của từng Agent.
- [x] Cập nhật Modal Cài đặt theo đúng `docs/design/02 Cài đặt · Mạng lưới AI.svg` và `docs/design/03 Cài đặt · API Key dự phòng.svg`:
  - Đổi tên Tab 3 thành `Trải nghiệm & Đồ thị` (thay cho `Trải nghiệm & 3D`).
  - Nền phía sau Modal là hình nền lưới Đồ thị chìm (thay cho nền 3D mờ cũ).
  - Nối toàn bộ nút bấm (`Đăng xuất`, `Làm mới`, `Kiểm tra CLI`, `Kết nối`, `Kiểm tra kết nối`, `Lưu key`, Toggle `Dùng API khi phiên chính gặp lỗi`) vào IPC thật. Xóa sạch dữ liệu minh họa.
- [x] **TEST PHA 3 (FE):** Nhận sự kiện thật từ Backend làm sáng đúng đường nối trên đồ thị; lưu/kiểm tra API key dự phòng và đổi trạng thái Focus/Exclude hoạt động xuyên suốt với SQLite. *(Ghi chú: `npx tsc --noEmit` và `npm run build` PASS 100%, 0 lỗi. Toàn bộ 35/35 contract tests PASS).*

**Ghi chú PHA 3 (FE — 09/11/2026):**
- Đã hoàn thiện đăng ký và lắng nghe `onGraphActiveEvent` từ IPC Bridge qua `useSynapseBridge`.
- `KnowledgeGraphPanel` kích hoạt hiệu ứng **Path lights up**: đường nối SVG phát sáng với glow filter, kèm hạt sáng SVG `<animateMotion>` di chuyển liên tục từ Node nguồn sang Node đích theo mã màu đặc trưng của từng Agent (`ChatGPT #58E9A8`, `Gemini #A88BFA`, `Claude #78BAFF`, `Codex #FFC075`).
- Nâng cấp Modal Cài đặt 4 Tab (`Mạng lưới AI`, `Hệ thống & Công cụ`, `Trải nghiệm & Đồ thị`, `Bản dựng & Cập nhật`):
  - Phía sau Modal render nền lưới graph vector tối (`#080E18`, lưới 32px `#1A2A3D`, cụm chùm node `#3D526D`, `#58E9A8`, `#A88BFA`).
  - Khung mở rộng `API Key dự phòng` theo `03 Cài đặt · API Key dự phòng.svg`: badge `✓ Kết nối hợp lệ`, switch `Dùng API khi phiên chính gặp lỗi`, input ẩn key có toggle mắt, nút `Kiểm tra kết nối` và `Lưu key` gọi IPC bridge thật.
  - Xóa sạch mock data, toàn bộ thao tác kết nối, lưu key, ngưỡng cảnh báo, cài đặt trải nghiệm đồ thị và công cụ đều gọi trực tiếp IPC methods (`agentConnectionAction`, `saveAgentKey`, `setFallbackOnError`, `setAgentAlertThreshold`, `saveAppearanceSettings`, `ensureToolDependency`).
- Kiểm tra mã nguồn:
  - `npx tsc --noEmit`: **PASS (0 lỗi)**.
  - `npm run build`: **PASS (0 lỗi, hoàn thành trong 413ms)**.
  - `node --experimental-transform-types --experimental-vm-modules --test tests/contracts/backend.test.ts`: **PASS 35/35**.

**Nhánh BACKEND (Codex - Model: GPT-6.1 Sol):**
- [x] Viết `FileLockManager` (`src/core/concurrency/FileLockManager.ts`): Quản lý khóa đọc/ghi file khi Codex và Antigravity chạy song song. Nếu File A đang bị khóa ghi bởi Codex, yêu cầu ghi của Antigravity phải được đưa vào hàng đợi hoặc từ chối rõ ràng.
- [x] Nối `DAGExecutor` và `CLI Adapters` vào `GraphEventBridge`: Mỗi khi Agent bắt đầu đọc/sửa file hoặc gọi từ file A sang file B, bắn ngay sự kiện `GraphActiveEvent` (kèm `agent_id`, `node_id`, `source_node_id`, `worker_model_name`) xuống Frontend.
- [x] Hoàn thiện toàn bộ IPC cho Settings: lấy trạng thái kết nối thực tế của CLI/OAuth, kiểm tra kết nối API Key dự phòng thật, lưu và đọc từ `safeStorage`.
- [x] **TEST PHA 3 (BE):** Chạy bài test mô phỏng 2 tiến trình Codex và Gemini cùng truy cập codebase: xác nhận `FileLockManager` chặn xung đột 100%, sự kiện `GraphActiveEvent` bắn đúng trình tự, xóa bỏ hoàn toàn mọi mock/stub trong mã nguồn.

**Ghi chú PHA 3 (BE — 09/11/2026):**
- `FileLockManager` dùng transaction SQLite và migration schema v2 thêm `owner_token`, giữ nguyên 4 bảng. Do schema quy định một khóa chính `node_id`, cả đọc và ghi được tuần tự hóa theo file. Có chờ giới hạn, hủy và lỗi `LOCK_CONFLICT`/`LOCK_TIMEOUT`; không tự cướp khóa hoặc giải phóng khi tiến trình còn chạy. Đây là khóa phối hợp giữa các adapter tham gia, không phải chặn ghi ở cấp OS đối với editor/CLI ngoài luồng tích hợp.
- `DAGExecutor` hỗ trợ `TaskContext.withFile` / `task.graph`; CLI adapters hỗ trợ `options.graph`. `GraphActivity` bảo vệ thao tác thật và phát `FLOW_TRANSITION`, `READING`/`WRITING`, `ERROR`, `IDLE` qua `GraphEventBridge`/`graph_active_event`; không suy đoán file/model từ log tùy ý. Test cả timeout DAG, hủy tiến trình CLI và dòng JSON cuối bị lỗi.
- Settings đã nối toàn bộ phương thức theo hợp đồng hiện tại: agent/default/quota, hành động CLI/OAuth, kiểm tra API, fallback/threshold, appearance, công cụ/storage và trạng thái bản dựng. `safeStorage` lưu ciphertext; IPC chỉ trả mask. Kiểm tra key dùng endpoint HTTPS chính thức, không chuyển tiếp credential qua redirect, không tạo nội dung model và không đưa response chứa secret vào lỗi.
- Người dùng xác nhận **chưa có cấu hình CLI/quota**. Backend đọc `agent-providers.json` trong userData; khi thiếu cấu hình/quota trả `PROVIDER_NOT_CONFIGURED`/`QUOTA_UNAVAILABLE`, không bịa trạng thái đăng nhập hay phần trăm. Không tự cấu hình tài khoản người dùng. Hướng dẫn schema cấu hình và cách nối adapter: `src/adapters/README.md`. Graphify/Python installer ngoài PHA 3 cần cấu hình riêng; thiếu installer trả lỗi rõ ràng.
- Kiểm thử bằng hai tiến trình Node độc lập đại diện Codex/Gemini trên cùng DB/file thật; test Electron ẩn dùng preload đã bundle, kiểm tra thứ tự sự kiện, CRUD Settings và DPAPI/safeStorage thật. Dữ liệu thử chỉ nằm trong fixture tạm và được dọn sau chạy; không có dữ liệu mẫu trong dịch vụ backend mới.
- Toàn bộ suite: đặt `SYNAPSE_MEDIA_SMOKE=1`, `SYNAPSE_PROVIDER_SMOKE=1`, chạy `node --experimental-transform-types --experimental-vm-modules --test "src/**/*.test.ts" "tests/**/*.test.ts"`: **88 PASS, 0 FAIL, 0 SKIP**. Bao gồm tải/chạy FFmpeg thật và ba endpoint API thật từ chối key cố ý không hợp lệ. Chưa kiểm thử đăng nhập thành công bằng tài khoản/key của người dùng vì chưa có cấu hình.
- `npx tsc --noEmit -p tests/backend/tsconfig.json`: **PASS**. `npm run build` (bao gồm `tsc --noEmit` toàn dự án, renderer, Electron main/preload): **PASS** tại lần kiểm tra cuối. `npm test` vẫn thiếu script; lệnh Node ở trên đã chạy đầy đủ suite. `git diff --check`: **PASS**.

---

## PHA 4: KIỂM TOÁN TOÀN CỤC & ĐÓNG GÓI BẢN DỰNG (CODEX & GEMINI)
- [ ] Chạy toàn bộ test suite (`npm test`), kiểm tra kiểu (`npx tsc --noEmit`) đạt 0 lỗi.
- [ ] Rà soát đảm bảo 0% dữ liệu giả lập (mock/illustrative data) còn sót lại trong UI và Backend.
- [ ] Đóng gói `npm run build:win` xuất file cài đặt `.exe` thành công.
