# HIẾN PHÁP PHỐI HỢP ĐỒNG THỜI: ANTIGRAVITY & CODEX

Dự án **Synapse OS** được xây dựng MỚI HOÀN TOÀN từ thư mục trống. Không có code cũ. 
Có 2 AI đang làm việc song song, yêu cầu tuân thủ tuyệt đối Lãnh thổ (File Ownership) và Model chỉ định:

## 1. NHÁNH FRONTEND, UI/UX & 3D OFFICE
* **Người phụ trách:** CLAUDE / GEMINI FLASH (chạy trên App Antigravity).
* **Model yêu cầu:** 
  - Đọc ảnh thiết kế, dựng khung UI 3 cột, khung 3D: Dùng **Claude Sonnet 5.5 Medium** (hoặc Opus 5.5).
  - Tinh chỉnh CSS, sửa lỗi vặt: Chuyển sang **Gemini 3.8 Flash Medium**.
* **Lãnh thổ được phép GHI (Write):**
  1. `src/shared/types.ts` (Khởi tạo ở Pha 0).
  2. `src/renderer/**`, `src/ui/**`, `src/components/**`.
  3. `tests/contracts/**`.
* **CẤM SỬA:** Bất kỳ file nào ngoài danh sách trên.

## 2. NHÁNH BACKEND, DAG ENGINE & ADAPTERS
* **Người phụ trách:** CODEX (chạy trên App ChatGPT).
* **Model yêu cầu:** Áp dụng "Chuyển số":
  * **Ca 1 (`6.1 Sol high` / o1 / o3-mini):** Chỉ viết `src/core/DAGExecutor.ts`, `UniversalTriageRouter.ts`, `FileLockManager.ts`, `ContextSlicer.ts`.
  * **Ca 2 (GPT-4o Standard/Medium):** Viết `src/adapters/**`, `src/media/**`, `src/main/**`, và `tests/unit/**`.
* **Lãnh thổ được phép GHI (Write):**
  1. `src/core/**`
  2. `src/adapters/**`
  3. `src/media/**` (Kèm cơ chế Lazy-Load thư viện)
  4. `src/main/**`
  5. `tests/unit/**`.
* **CẤM SỬA:** `src/renderer/**` và `src/shared/types.ts`.

## 3. QUY TẮC ĐỌC TÀI LIỆU (DOCS EXCLUSION)
Khi được yêu cầu đọc thư mục `docs/` để nắm kiến trúc, TẤT CẢ CÁC AGENT BẮT BUỘC PHẢI BỎ QUA FILE `docs/05_EXECUTION_PROMPTS.md`. File này chứa các lệnh mô phỏng dành riêng cho người dùng, AI không được phân tích hay thực thi nội dung của file này dưới bất kỳ hình thức nào.