# BẢNG ĐỒNG BỘ TIẾN ĐỘ SONG SONG (SYNAPSE OS)

## PHA 0: KHỞI TẠO HỢP ĐỒNG (GEMINI PRO)
- [x] GEMINI: Khởi tạo project (`package.json`, React, TypeScript, Tailwind/Vite).
- [x] GEMINI: Viết `src/shared/types.ts` khớp 100% với `docs/04_SHARED_DATA_CONTRACTS.md`.

## PHA 0.5: TÍCH HỢP ELECTRON (CODEX)
- [ ] CODEX: Cài đặt Electron, electron-builder.
- [ ] CODEX: Cấu hình `src/main/index.ts` (Main Process) và `preload.ts` (IPC Bridge theo types.ts).

## PHA 1: CHẠY SONG SONG (CODEX & GEMINI)
**Nhánh GEMINI (Antigravity):**
- [ ] Dựng Layout 3 cột, Bảng Giới hạn Quota 5h/Tuần.
- [ ] Khung Chat, Code Block, Video Preview.
- [ ] Văn phòng 3D Isometric (Huy hiệu B1, B2) & Cây Sơ đồ Task.

**Nhánh CODEX (ChatGPT):**
- [ ] Lõi Backend: DAGExecutor, Triage Router, Blackboard.
- [ ] CLI Adapters & QuotaTracker.
- [ ] `LocalMediaTools`: Viết cơ chế Lazy-Load (Tự động tải FFmpeg/Python scripts vào `.plugins/` khi có yêu cầu xử lý media, không nạp cứng vào app).
- [ ] IPC Bridge bắn sự kiện `VisualOfficeEvent`.

## PHA 2: KHỚP NỐI TOÀN CỤC
- [ ] CHỜ KIỂM TRA: Chạy `npx tsc --noEmit` & Build thành công.