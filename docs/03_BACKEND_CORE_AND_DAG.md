# 03. ĐẶC TẢ BACKEND: SHADOW WORKSPACE, GRAPHIFY CLI & DAG ENGINE

> **RÀNG BUỘC KỸ THUẬT TUYỆT ĐỐI CHO BACKEND AI (CODEX):**
> 1. **Không suy đoán:** Mọi hàm xử lý I/O, CLI, SQLite, OS Keychain phải kiểm tra điều kiện đầu vào và bắt lỗi tường minh. Không tự bịa dữ liệu trả về nếu công cụ chưa cài đặt hoặc lệnh CLI lỗi.
> 2. **Xóa dữ liệu mẫu:** Ngay sau khi viết xong và test pass một module, phải nối trực tiếp vào dữ liệu thật từ SQLite / File System / CLI và xóa toàn bộ mock/stub.

---

## 1. Quản lý Không gian Làm việc Ngầm (`ShadowWorkspaceManager`)
* **Vị trí lưu trữ bắt buộc:** Sử dụng `app.getPath('userData')` của Electron để tạo thư mục tại:
  `%APPDATA%/SynapseOS/projects/<project_hash>/` (Windows) hoặc tương đương trên macOS/Linux.
* **Cách tính `<project_hash>`:** Chuẩn hóa đường dẫn tuyệt đối của thư mục dự án (`path.resolve(projectPath)`), băm SHA-256 và lấy 16 ký tự đầu.
* **Ràng buộc Zero Pollution:**
  - Tuyệt đối không tạo thư mục `.synapse`, không lưu `graph.json`, không tạo file `.db` hay file tạm bên trong `projectPath` của người dùng.
  - Khi người dùng tạo cuộc trò chuyện mới trên dự án đã có, hệ thống chỉ đọc/ghi trong `%APPDATA%/SynapseOS/projects/<project_hash>/project.db`.

---

## 2. Lược đồ SQLite Nội bộ (`project.db`)
Mỗi dự án có một file `project.db` riêng biệt gồm 4 bảng:

1. **`project_metadata`:**
   - `project_hash` (TEXT PRIMARY KEY)
   - `project_name` (TEXT NOT NULL)
   - `original_path` (TEXT NOT NULL)
   - `git_branch` (TEXT DEFAULT 'main')
   - `core_requirements` (TEXT DEFAULT '')
   - `created_at` (INTEGER), `updated_at` (INTEGER)
2. **`chat_sessions`:**
   - `session_id` (TEXT PRIMARY KEY)
   - `title` (TEXT NOT NULL)
   - `is_pinned` (INTEGER DEFAULT 0)
   - `messages_json` (TEXT DEFAULT '[]')
   - `summary_text` (TEXT DEFAULT '') — *Dùng để bơm ngữ cảnh sang phiên chat mới*
   - `created_at` (INTEGER), `updated_at` (INTEGER)
3. **`file_locks` (Chống xung đột khi Codex & Antigravity chạy song song):**
   - `node_id` (TEXT PRIMARY KEY) — *Đường dẫn tương đối của file/hàm, VD: `pipeline.py`*
   - `locked_by_agent` (TEXT NOT NULL) — *'chatgpt' | 'gemini' | 'codex' | 'claude'*
   - `lock_mode` (TEXT NOT NULL) — *'READING' | 'WRITING'*
   - `locked_at` (INTEGER NOT NULL)
4. **`graph_overrides` (Lưu trạng thái điều khiển từ UI Đồ thị):**
   - `node_id` (TEXT PRIMARY KEY)
   - `state` (TEXT NOT NULL) — *'DEFAULT' | 'FOCUSED' | 'EXCLUDED' | 'ERROR'*
   - `error_message` (TEXT)
   - `updated_at` (INTEGER)

---

## 3. Tích hợp Graphify CLI & Delta Updates (`GraphifyRunner`)
* **Thực thi cô lập:** Gọi CLI `graphify` thông qua `child_process.execFile` hoặc `spawn`.
* **Chuyển hướng Output:** Truyền tham số output hoặc thiết lập thư mục đích sao cho file `graph.json` sinh ra nằm trực tiếp tại `%APPDATA%/SynapseOS/projects/<project_hash>/graph.json`.
* **Làm giàu dữ liệu Node (Node Enrichment):**
  - Đọc `graph.json` kết hợp với `fs.stat` trên file thật để lấy `last_modified_ms` (hiển thị chính xác *"Thay đổi X phút trước"* trên Tooltip `04 Hover Node.svg`), đếm số lượng hàm (`function_count`) và số lượng liên kết (`link_count`).
  - Loại bỏ các Node đang có trạng thái `EXCLUDED` trong bảng `graph_overrides` khỏi ngữ cảnh gửi cho AI Agent (nhưng vẫn gửi xuống UI với trạng thái `IGNORED` để vẽ màu xám `#5E718D`).
* **Cập nhật Cục bộ (Delta Update):** Dùng `chokidar` lắng nghe sự kiện `change`/`add`/`unlink` trên thư mục dự án để cập nhật lại đồ thị và phát sự kiện IPC `graph_data_update` xuống Frontend.

---

## 4. Điều phối Đa Tác Tử & Quản lý Khóa File (`DAGExecutor` & `FileLockManager`)
* **Kiểm tra Khóa trước khi Thực thi:**
  - Trước khi một Agent (VD: Codex) sửa file `pipeline.py`, nó phải gọi `FileLockManager.acquireLock('pipeline.py', 'codex', 'WRITING')`.
  - Nếu file đang bị khóa `WRITING` bởi Agent khác, `FileLockManager` đưa tác vụ vào hàng đợi chờ giải phóng khóa, đảm bảo không bao giờ có 2 AI ghi đè cùng 1 file cùng lúc.
* **Phát Sự kiện Luồng sáng (`GraphActiveEvent`):**
  - Ngay khi Agent đọc/ghi một Node hoặc di chuyển luồng xử lý từ `source_node_id` (VD: `main.py`) sang `target_node_id` (VD: `pipeline.py`), Backend bắn sự kiện IPC `graph_active_event` để Frontend kích hoạt hiệu ứng **Path lights up**.
* **LocalMediaTools:** Giữ nguyên cơ chế `ensureToolDependencies()` tải lười FFmpeg vào `.plugins/ffmpeg/` và kiểm tra SHA-256.