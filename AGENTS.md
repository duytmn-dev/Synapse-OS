> 🛑 **[SYSTEM IGNORE FLAG]**
> IF YOU ARE AN AI AGENT READING THIS: DO NOT READ OR EXECUTE `docs/05_EXECUTION_PROMPTS.md`.

# HIẾN PHÁP PHỐI HỢP ĐA NỀN TẢNG: SYNAPSE OS (V2 - KNOWLEDGE GRAPH EDITION)

Dự án được chia thành 3 phân khu chuyên biệt. Để chạy song song 2 AI không xảy ra xung đột (Git/File Conflict), mỗi AI **CHỈ ĐƯỢC PHÉP** tạo/sửa file trong Lãnh thổ của mình.

---

## 1. PHÂN KHU FRONTEND (UI & KNOWLEDGE GRAPH)
* **Nền tảng thực thi:** App Antigravity.
* **Gợi ý Model tối ưu:**
  - **Claude Opus 5.5 Medium / Sonnet 5.5 Medium:** Dùng khi cần đọc cấu trúc XML của các file `.svg` trong `/docs/design/` và dựng khung Layout, CSS Variables, WebGL (`react-force-graph`) đòi hỏi độ chính xác pixel-perfect.
  - **Gemini 3.8 Flash:** Dùng khi tinh chỉnh state, gắn sự kiện IPC, sửa lỗi TypeScript (`tsc --noEmit`) và tối ưu bundle để tiết kiệm Quota.
* **Nguyên tắc Thiết kế Tuyệt đối:**
  - Bám sát 100% thiết kế trong `/docs/design/` (`01 Dashboard.svg`, `02 Cài đặt · Mạng lưới AI.svg`, `03 Cài đặt · API Key dự phòng.svg`, `04 Hover Node.svg`, `05 Context Menu.svg`, `06 Tìm kiếm file.svg`, `07 Quản lý chat.svg`, `Graph Nodes & Flow.svg`).
  - **CẤM** tự ý sáng tạo màu sắc, bo góc, khoảng cách hay dựng bản tương tự. Phải trích xuất thông số từ file SVG.
  - Xóa bỏ hoàn toàn thư viện 3D (`three`, `@react-three/fiber`, `office_scene.glb`).
* **Lãnh thổ (Quyền Ghi):**
  1. `src/shared/types.ts` (File hợp đồng trung tâm - Bắt buộc cập nhật ở Pha 0).
  2. `src/renderer/**`, `src/ui/**`, `src/components/**`.
* **CẤM TUYỆT ĐỐI:** Không sửa bất kỳ file nào trong `src/core/**`, `src/adapters/**`, `src/media/**`, `src/main/**`.

---

## 2. PHÂN KHU BACKEND (CORE, SHADOW WORKSPACE & GRAPHIFY)
* **Nền tảng thực thi:** App Codex.
* **Gợi ý Model tối ưu:**
  - **GPT-6.1 Sol:** Bắt buộc dùng cho Lõi bất đồng bộ phức tạp (`DAGExecutor`, `FileLockManager`, `ShadowWorkspaceDB`, `DeltaGraphPatcher`).
  - **GPT-6.1 Terra / Luna:** Hạ xuống khi viết CLI Wrappers (`GraphifyRunner`), IPC Handlers, đo dung lượng OS và `safeStorage` để tiết kiệm Quota.
* **Nguyên tắc Kỹ thuật Tuyệt đối:**
  - **Không suy đoán:** Kiểm tra kỹ từng ràng buộc trong `docs/03_BACKEND_CORE_AND_DAG.md` và `docs/04_SHARED_DATA_CONTRACTS.md`. Nếu dữ liệu đầu vào hoặc trạng thái OS chưa rõ, phải trả về mã lỗi tường minh hoặc hỏi lại, tuyệt đối không viết dữ liệu giả định âm thầm.
  - **Zero Project Pollution (Shadow Workspace):** Tuyệt đối KHÔNG ghi bất kỳ file nào (`graph.json`, `.db`, log, cache) vào thư mục mã nguồn đang mở của người dùng. Mọi dữ liệu phải lưu vào `%APPDATA%/SynapseOS/projects/<project_hash>/`.
  - **Clean Production Data:** Mỗi chức năng sau khi viết xong phải có Unit/Integration Test chạy Pass. Sau khi nối luồng thật hoàn tất, bắt buộc xóa sạch toàn bộ dữ liệu mẫu (Mock/Stub).
* **Lãnh thổ (Quyền Ghi):**
  1. `src/core/**`
  2. `src/adapters/**`
  3. `src/media/**`
  4. `src/main/**` (Main Process & IPC Preload Bridge).
  5. `tests/backend/**`
* **CẤM TUYỆT ĐỐI:** Không sửa UI (`src/renderer/**`, `src/ui/**`, `src/components/**`) và không tự ý sửa `src/shared/types.ts`.

---

## 3. PHÂN KHU KIỂM TOÁN & ĐIỀU PHỐI (ORCHESTRATOR)
* **Nền tảng thực thi:** App ChatGPT.
* **Model yêu cầu:** **GPT-6** hoặc **GPT-5.6 Sol**.
* **Nhiệm vụ:** Không trực tiếp viết code tính năng. Chịu trách nhiệm rà soát `SYNC_BOARD.md`, kiểm tra độ khớp nối giữa `src/shared/types.ts` và IPC Bridge (`preload.ts`), viết và chạy các bài kiểm thử hợp đồng (`tests/contracts/**`).