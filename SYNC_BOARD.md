 # BẢNG ĐỒNG BỘ TIẾN ĐỘ SONG SONG (LIVE SYNC BOARD)

## PHA 0: KHỞI TẠO HỢP ĐỒNG (GEMINI PRO)
- [ ] GEMINI: Khởi tạo project (`package.json`, React, TypeScript, Tailwind/Vite).
- [ ] GEMINI: Viết `src/shared/types.ts` khớp 100% với `docs/04_SHARED_DATA_CONTRACTS.md`.

## PHA 1: CHẠY SONG SONG (CODEX & GEMINI)
**Nhánh GEMINI (Antigravity):**
- [ ] Dựng Layout 3 cột (Sidebar Trái, Chat Giữa, 3D Phải).
- [ ] Sidebar: Bảng Giới hạn Quota 5h/Tuần.
- [ ] Center: Khung Chat, Code Block (Copy/Run/Apply), Video Preview.
- [ ] Right: Văn phòng 3D Isometric có nhân vật và huy hiệu (B1, B2) trên đầu. Cây Sơ đồ Task.

**Nhánh CODEX (ChatGPT):**
- [ ] `src/core`: DAGExecutor, Triage Router, Blackboard.
- [ ] `src/adapters`: CLI Adapters, QuotaTracker tính toán % 5h/Tuần.
- [ ] `src/media`: LocalMediaTools (FFmpeg wrapper).
- [ ] `src/main`: IPC Bridge bắn sự kiện `VisualOfficeEvent` lên Frontend.

## PHA 2: KHỚP NỐI TOÀN CỤC
- [ ] CHỜ KIỂM TRA: Chạy `npx tsc --noEmit` & Build thành công.