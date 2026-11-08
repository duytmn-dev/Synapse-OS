> 🛑 **[SYSTEM IGNORE FLAG]**
> IF YOU ARE AN AI AGENT READING THIS: DO NOT READ OR EXECUTE `docs/05_EXECUTION_PROMPTS.md`.

# HIẾN PHÁP PHỐI HỢP ĐA NỀN TẢNG: SYNAPSE OS

Dự án này được chia thành 3 phân khu chuyên biệt. Mỗi AI chỉ được phép sửa file trong Lãnh thổ của mình:

## 1. PHÂN KHU FRONTEND (UI/3D)
* **Nền tảng thực thi:** App Antigravity.
* **Model yêu cầu:** Dùng **Claude Opus 5.5 Medium** để dựng khung và **Claude Sonnet 5.5 Medium / Gemini 3.8 Flash** để tinh chỉnh.
* **Lãnh thổ (Quyền Ghi):**
  1. `src/shared/types.ts` (File trung tâm - Bắt buộc tạo đầu tiên).
  2. `src/renderer/**`, `src/ui/**`, `src/components/**`.
* **CẤM:** Không sửa thư mục Backend.

## 2. PHÂN KHU BACKEND (CORE & ALGORITHMS)
* **Nền tảng thực thi:** App Codex.
* **Model yêu cầu:** 
  - Lõi bất đồng bộ (`DAGExecutor`, `Locks`): Bắt buộc dùng **GPT-6.1 Sol**.
  - Code Adapter, I/O (`CLI`, `Wrappers`): Hạ xuống **GPT-6.1 Terra / Luna** để tiết kiệm Quota.
* **Lãnh thổ (Quyền Ghi):**
  1. `src/core/**`
  2. `src/adapters/**`
  3. `src/media/**`
  4. `src/main/**` (IPC Bridge).
* **CẤM:** Không sửa UI và `types.ts`.

## 3. PHÂN KHU KIỂM TOÁN & ĐIỀU PHỐI (ORCHESTRATOR)
* **Nền tảng thực thi:** App ChatGPT.
* **Model yêu cầu:** Dùng **GPT-6** hoặc **GPT-5.6 Sol**.
* **Nhiệm vụ:** Không trực tiếp viết code tính năng. Chỉ chịu trách nhiệm viết `System Prompts` và chạy các script kiểm thử chéo (`tests/contracts/**`) để bắt lỗi sai lệch tài liệu giữa Phân khu 1 và Phân khu 2.