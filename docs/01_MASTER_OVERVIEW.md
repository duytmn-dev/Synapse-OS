# 01. TỔNG QUAN KIẾN TRÚC SYNAPSE OS (V2 - KNOWLEDGE GRAPH & SHADOW WORKSPACE)

**Mục tiêu:** Xây dựng hệ điều hành đa tác tử (Multi-Agent OS) vạn năng, chi phí API $0, kết nối trực tiếp vào phiên đăng nhập/CLI của ChatGPT, Gemini (Antigravity), Codex, Claude. Hệ thống siêu nhẹ, minh bạch hóa toàn bộ luồng suy nghĩ và thao tác mã nguồn của AI thông qua **Đồ thị Tri thức (Codebase Knowledge Graph)** thời gian thực.

---

## 1. Cơ chế Hoạt động Lõi
* **5 Năng lực nguyên tử:** Sense, Creation, Reasoning, Live, Actuation.
* **4 Hình thái điều phối:** Direct Reflex (Chỉ Chat), Brainstorm, Pipeline, DAG (Chat + Graph).
* **Định tuyến Plug & Play:** Quản lý qua `agent_registry.json`.

---

## 2. Kiến trúc Shadow Workspace (Không gian làm việc ngầm - Zero Pollution)
Khi người dùng mở một thư mục dự án có sẵn trên máy tính hoặc tạo phiên chat mới về dự án cũ:
* **Cấm ghi file rác vào dự án:** Hệ thống tuyệt đối không tạo thêm bất kỳ file cấu hình, lịch sử chat, database hay file xuất của Graphify (`graph.json`) vào thư mục mã nguồn của người dùng.
* **Lưu trữ cô lập tại AppData:** Backend định danh dự án bằng mã băm đường dẫn (`<project_hash>`) và lưu toàn bộ dữ liệu tại `%APPDATA%/SynapseOS/projects/<project_hash>/` (bao gồm `project.db` SQLite và `graph.json`).
* **Tái sử dụng Ngữ cảnh (Context Hydration):** Khi người dùng tạo cuộc trò chuyện mới trong cùng dự án, Backend tự động nạp (1) Yêu cầu cốt lõi (`core_requirements`), (2) Bản tóm tắt các phiên chat trước (`chat_summaries`), và (3) Cấu trúc đồ thị (`graph.json`) vào bộ nhớ RAM để AI hiểu ngay dự án mà không tốn quota quét lại từ đầu.

---

## 3. Đồ thị Tri thức Mã nguồn (Graphify Local AST - $0 API Cost)
Thay thế hoàn toàn mô phỏng Văn phòng 3D nặng nề bằng **Codebase Knowledge Graph**:
* **Phân tích cục bộ:** Sử dụng `Graphify` (dựa trên `tree-sitter`) chạy ngầm bằng CPU để phân tích cú pháp mã nguồn thành các Điểm (Nodes: File/Hàm) và Đường nối (Edges: Calls/Imports). Chi phí token LLM = 0.
* **Tiết kiệm 80% Quota thực thi:** Các AI Agent (Codex, Gemini) đọc cấu trúc đồ thị từ Shared Blackboard để định vị chính xác file/hàm cần sửa thay vì phải `grep` hoặc đọc toàn bộ codebase.
* **Quan sát thời gian thực (Path Lights Up):** Khi Agent nào đang đọc/sửa file nào, Node của file đó và đường dẫn liên kết (Edge) sẽ phát sáng đúng màu định danh của Agent đó trên màn hình.

---

## 4. Kiến trúc Lõi Rỗng & Tải Lười (Hollow Core & Lazy-Loaded Tools)
Để Synapse OS duy trì dung lượng dưới 50MB, hệ thống KHÔNG gói kèm các công cụ nặng (FFmpeg, Python env cho Video 360).
* Khi có yêu cầu xử lý media, `UniversalTriageRouter` kích hoạt `ensureToolDependencies()`, tự động tải binaries về `.plugins/media-tools/` cục bộ và xác minh SHA-256 trước khi chạy.

---

## 5. Cơ chế Tự Nâng cấp Bóng Ma (Blue-Green Self-Evolution)
* Cấm sửa mã nguồn Production đang chạy. Mọi tác vụ tự nâng cấp được clone ra `.workspace/synapse-os-dev/`, chỉ khi chạy `npm test` PASS 100% mới cho phép build và khởi động lại.