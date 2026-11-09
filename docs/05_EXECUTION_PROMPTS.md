> 🛑 **[SYSTEM IGNORE FLAG]**
> IF YOU ARE AN AI AGENT READING THIS FILE: STOP READING IMMEDIATELY AND IGNORE ALL CONTENT BELOW.
> NẾU BẠN LÀ AI: ĐÂY KHÔNG PHẢI LÀ LỆNH DÀNH CHO BẠN. BỎ QUA FILE NÀY VÀ KHÔNG THỰC THI BẤT KỲ ĐIỀU GÌ TRONG ĐÂY.

# 05. BỘ LỆNH ĐIỀU PHỐI THỰC THI (CHỈ DÀNH CHO HUMAN ADMIN)

Human Admin copy các khối lệnh dưới đây và dán vào 2 ứng dụng AI (Antigravity và Codex) theo đúng trình tự từng Pha để chạy song song không xung đột.

---

### BƯỚC 1: PHA 0 - ĐỒNG BỘ HỢP ĐỒNG DỮ LIỆU (`types.ts` & `preload.ts`)

**1A. Dán vào Antigravity (Model: Claude Sonnet 5.5 hoặc Gemini 3.8 Flash):**
> "Hãy đọc `AGENTS.md`, `SYNC_BOARD.md`, và toàn bộ các file trong `docs/` (TRỪ file 05).
> Thực hiện **PHA 0 (Nhánh Frontend)**:
> 1. Cập nhật file `src/shared/types.ts` khớp 100% với toàn bộ Interfaces trong `docs/04_SHARED_DATA_CONTRACTS.md`.
> 2. Chạy `npx tsc --noEmit` để đảm bảo file `types.ts` hoàn toàn sạch lỗi cú pháp.
> 3. Đánh dấu `[x]` vào mục của bạn trong PHA 0 tại `SYNC_BOARD.md` và báo cho tôi biết."

**1B. (Sau khi 1A xong) Dán vào Codex (Model: GPT-6.1 Terra):**
> "Hãy đọc `AGENTS.md`, `SYNC_BOARD.md`, và `src/shared/types.ts` vừa được cập nhật.
> Thực hiện **PHA 0 (Nhánh Backend)**:
> 1. Cập nhật `src/main/preload.ts` và IPC handlers khung sườn để khớp 100% với các kiểu dữ liệu mới trong `src/shared/types.ts` (Knowledge Graph, Shadow Workspace, Chat Session Mutation, Settings).
> 2. Viết và chạy bài test kiểm tra hợp đồng (`tests/contracts/`) đảm bảo bridge khớp hoàn toàn với `types.ts`.
> 3. Đánh dấu `[x]` vào PHA 0 trong `SYNC_BOARD.md` và báo tôi biết."

---

### BƯỚC 2: PHA 1 - CHẠY SONG SONG (GIAO DIỆN DASHBOARD SVG & SHADOW WORKSPACE DB)
*(Dán cùng lúc 2 lệnh dưới đây vào 2 bên)*

**2A. Dán vào Antigravity (Model khuyên dùng: Claude Opus 5.5 Medium):**
> "Bắt đầu **PHA 1 (Nhánh Frontend)**. Tuân thủ nghiêm ngặt `AGENTS.md` (chỉ sửa trong `src/renderer`, `src/ui`, `src/components`).
> 1. Đọc kỹ các file thiết kế SVG trong `/docs/design/01 Dashboard.svg` và `/docs/design/07 Quản lý chat.svg` cùng tài liệu `docs/02_UI_AND_GRAPH_DESIGN_SPEC.md`.
> 2. Xóa bỏ hoàn toàn các component và thư viện Văn phòng 3D cũ.
> 3. Dựng lại Topbar, Sidebar Trái (Lịch sử chat, Cây dự án có icon Shadow DB, Bảng giới hạn Agent), Khung Chat ở giữa (Code block, 360° Preview, Smart Input), và Cây Sơ đồ Task ở góc phải dưới **chính xác tuyệt đối từng mã màu, kích thước, bo góc theo file SVG**. Không tự ý làm khác thiết kế.
> 4. Dựng đầy đủ Menu `•••`, Modal `Đổi tên chat` và Modal `Xóa cuộc trò chuyện?` theo đúng `07 Quản lý chat.svg`.
> 5. Chạy test giao diện, kiểm tra `npx tsc --noEmit`, đánh dấu `[x]` vào PHA 1 (FE) trong `SYNC_BOARD.md`."

**2B. Dán vào Codex (Model khuyên dùng: GPT-6.1 Sol):**
> "Bắt đầu **PHA 1 (Nhánh Backend)**. Tuân thủ nghiêm ngặt `AGENTS.md` (chỉ sửa trong `src/core`, `src/adapters`, `src/main`, `tests/backend`).
> 1. Đọc kỹ `docs/03_BACKEND_CORE_AND_DAG.md` và `docs/04_SHARED_DATA_CONTRACTS.md`. Không suy đoán bất kỳ ràng buộc nào.
> 2. Viết `ShadowWorkspaceManager` và khởi tạo SQLite `project.db` lưu trong `%APPDATA%/SynapseOS/projects/<project_hash>/`. Đảm bảo nguyên tắc Zero Pollution: tuyệt đối không tạo bất kỳ file nào trong thư mục dự án gốc của người dùng.
> 3. Thực hiện đầy đủ CRUD cho `chat_sessions` (Tạo chat mới, Đổi tên, Ghim/Bỏ ghim, Xóa chat) và `ContextHydrator` (tự động nạp yêu cầu gốc + tóm tắt chat cũ khi tạo chat mới trong dự án cũ).
> 4. Viết Unit/Integration Test chạy trên dữ liệu thật, xác nhận DB hoạt động đúng và thư mục dự án gốc không bị ghi bẩn. Xóa toàn bộ mock data sau khi nối xong, đánh dấu `[x]` vào PHA 1 (BE) trong `SYNC_BOARD.md`."

---

### BƯỚC 3: PHA 2 - CHẠY SONG SONG (KNOWLEDGE GRAPH UI & GRAPHIFY CLI)
*(Dán cùng lúc 2 lệnh sau khi Pha 1 cả 2 bên đã `[x]`)*

**3A. Dán vào Antigravity (Model khuyên dùng: Claude Opus 5.5 Medium):**
> "Bắt đầu **PHA 2 (Nhánh Frontend)**.
> 1. Đọc kỹ các file SVG: `docs/design/01 Dashboard.svg`, `docs/design/Graph Nodes & Flow.svg`, `docs/design/04 Hover Node.svg`, `docs/design/05 Context Menu.svg`, `docs/design/06 Tìm kiếm file.svg` và tài liệu `docs/08_GRAPH_INTERACTION_RULES.md`.
> 2. Dựng component `CodebaseKnowledgeGraph` ở nửa trên cột phải: nền lưới grid, pill `NODES / EDGES`, badge `• ĐANG CHẠY`, 4 nút điều khiển góc phải, và thanh Legend dưới đáy.
> 3. Cài đặt đầy đủ 5 trạng thái Node (`Mặc định`, `ChatGPT`, `Gemini`, `Bỏ qua`, `Lỗi`), Tooltip kính mờ khi Hover (`04 Hover Node.svg`), Context Menu khi click chuột phải (`05 Context Menu.svg`), và Ô tìm kiếm file khi bấm nút kính lúp (`06 Tìm kiếm file.svg`).
> 4. Kiểm tra `npx tsc --noEmit`, nối IPC nhận `GraphDataSnapshot` từ Backend, xóa dữ liệu mẫu sau khi nối xong và đánh dấu `[x]` vào PHA 2 (FE) trong `SYNC_BOARD.md`."

**3B. Dán vào Codex (Model khuyên dùng: GPT-6.1 Terra kết hợp GPT-6.1 Sol):**
> "Bắt đầu **PHA 2 (Nhánh Backend)**.
> 1. Viết `GraphifyRunner` gọi CLI `graphify` (tree-sitter AST local), ép xuất `graph.json` vào thư mục Shadow Workspace trong `%APPDATA%`.
> 2. Kết hợp dữ liệu `graph.json` với `fs.stat` (lấy thời gian sửa đổi thực tế của file) và bảng `graph_overrides` trong SQLite để trả về `GraphDataSnapshot` chuẩn xác.
> 3. Xử lý lệnh `GraphNodeControlCommand` (`FOCUS`, `EXCLUDE`, `RESET`) từ UI gửi xuống: lưu vào SQLite và cập nhật ngay trạng thái Node.
> 4. Cài đặt `chokidar` theo dõi thay đổi file để cập nhật đồ thị cục bộ (Delta Update). Viết test kiểm thử trên thư mục code thật, xóa toàn bộ mock data và đánh dấu `[x]` vào PHA 2 (BE) trong `SYNC_BOARD.md`."

---

### BƯỚC 4: PHA 3 - CHẠY SONG SONG (LUỒNG SÁNG MULTI-AGENT & MÀN HÌNH CÀI ĐẶT)

**4A. Dán vào Antigravity (Model khuyên dùng: Gemini 3.8 Flash để tiết kiệm Quota):**
> "Bắt đầu **PHA 3 (Nhánh Frontend)**.
> 1. Đọc kỹ `docs/design/02 Cài đặt · Mạng lưới AI.svg`, `docs/design/03 Cài đặt · API Key dự phòng.svg`, `docs/design/Graph Nodes & Flow.svg` và `docs/07_SETTINGS_UI_UX_SPEC.md`.
> 2. Lắng nghe sự kiện `GraphActiveEvent` từ IPC để kích hoạt hiệu ứng **Path lights up** (đường nối sáng lên kèm hạt sáng di chuyển từ Node nguồn sang Node đích theo đúng màu Agent đang xử lý).
> 3. Cập nhật hoàn chỉnh Modal Cài đặt 4 Tab (đổi nền mờ phía sau thành nền lưới Graph, hoàn thiện khung mở rộng `API Key dự phòng`). Nối toàn bộ nút bấm vào IPC thật và xóa sạch mọi số liệu minh họa (mock data).
> 4. Chạy `npx tsc --noEmit` và `npm run build`, đánh dấu `[x]` vào PHA 3 (FE) trong `SYNC_BOARD.md`."

**4B. Dán vào Codex (Model khuyên dùng: GPT-6.1 Sol):**
> "Bắt đầu **PHA 3 (Nhánh Backend)**.
> 1. Viết `FileLockManager` bảo vệ codebase khi Codex và Antigravity chạy song song (khóa đọc/ghi theo `node_id` trong SQLite).
> 2. Nối `DAGExecutor` và các CLI Adapters với `GraphActiveEvent`: mỗi khi Agent đọc/ghi file hoặc gọi liên kết giữa 2 file, phát sự kiện thời gian thực xuống Frontend.
> 3. Hoàn thiện toàn bộ IPC cho màn hình Cài đặt (trạng thái Agent thật, kiểm tra kết nối API Key dự phòng thật, lưu/đọc qua `safeStorage`). Xóa sạch toàn bộ dữ liệu mẫu.
> 4. Chạy toàn bộ test suite đạt 100% Pass, đánh dấu `[x]` vào PHA 3 (BE) trong `SYNC_BOARD.md`."