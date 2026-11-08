# HIẾN PHÁP PHỐI HỢP ĐỒNG THỜI: ANTIGRAVITY & CODEX

Dự án này được xây dựng MỚI HOÀN TOÀN từ thư mục trống. Không có code cũ. 
Có 2 AI đang làm việc song song, yêu cầu tuân thủ tuyệt đối Lãnh thổ (File Ownership) và Model chỉ định:

## 1. NHÁNH FRONTEND, UI/UX & 3D OFFICE
* **Người phụ trách:** GEMINI (chạy trên App Antigravity).
* **Model yêu cầu:** BẮT BUỘC dùng **Gemini Pro (Advanced)** để có khả năng nhìn ảnh thiết kế (`docs/design_reference.png`) và giữ ngữ cảnh lớn. Khi tinh chỉnh CSS/UI nhỏ giọt, có thể hạ xuống **Gemini Flash**.
* **Lãnh thổ được phép GHI (Write):**
  1. `src/shared/types.ts` (Khởi tạo ở Pha 0).
  2. `src/renderer/**`, `src/ui/**`, `src/components/**` (Toàn bộ UI React/CSS).
  3. `tests/contracts/**` (Code test UI).
* **CẤM SỬA:** Bất kỳ file nào ngoài danh sách trên.

## 2. NHÁNH BACKEND, DAG ENGINE & ADAPTERS
* **Người phụ trách:** CODEX (chạy trên App ChatGPT).
* **Model yêu cầu:** Bắt buộc áp dụng chiến thuật "Chuyển số":
  * **Ca 1 (Dùng `6.1 Sol high` hoặc o1/o3-mini):** CHỈ dùng để viết lõi bất đồng bộ `src/core/DAGExecutor.ts`, `UniversalTriageRouter.ts`, `FileLockManager.ts` và `ContextSlicer.ts`.
  * **Ca 2 (Hạ xuống GPT-4o Standard/Medium):** Dùng để viết các Adapter `src/adapters/**`, `src/media/**` và các Unit Test `tests/unit/**` nhằm tiết kiệm Quota.
* **Lãnh thổ được phép GHI (Write):**
  1. `src/core/**`
  2. `src/adapters/**`
  3. `src/media/**`
  4. `src/main/**` (Tầng IPC Bridge).
  5. `tests/unit/**`.
* **CẤM SỬA:** `src/renderer/**` và `src/shared/types.ts`.