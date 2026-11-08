# BẢNG ĐỒNG BỘ TIẾN ĐỘ SONG SONG (SYNAPSE OS)

## PHA 0: KHỞI TẠO HỢP ĐỒNG (GEMINI PRO)
- [x] GEMINI: Khởi tạo project (`package.json`, React, TypeScript, Tailwind/Vite).
- [x] GEMINI: Viết `src/shared/types.ts` khớp 100% với `docs/04_SHARED_DATA_CONTRACTS.md`.

## PHA 0.5: TÍCH HỢP ELECTRON (CODEX)
- [x] CODEX: Cài đặt Electron, electron-builder.
- [x] CODEX: Cấu hình `src/main/index.ts` (Main Process) và `preload.ts` (IPC Bridge theo types.ts).

## PHA 1: CHẠY SONG SONG (CODEX & GEMINI)
**Nhánh GEMINI (Antigravity):**
- [x] Dựng Layout 3 cột, Bảng Giới hạn Quota 5h/Tuần.
- [x] Khung Chat, Code Block, Video Preview.
- [x] Văn phòng 3D Isometric (Huy hiệu B1, B2) & Cây Sơ đồ Task.

**Nhánh CODEX (ChatGPT):**
- [x] Lõi Backend (Ca 1): DAGExecutor (task cha-con), UniversalTriageRouter.
- [x] Lõi Backend: Blackboard (adapter trạng thái trong bộ nhớ, kiểm soát revision).
- [x] CLI Adapters & QuotaTracker (CLI text/NDJSON; quota cửa sổ trượt 5h/7 ngày theo hạn mức và dữ liệu sử dụng đầu vào).
- [x] `LocalMediaTools`: Lazy-Load FFmpeg vào `.plugins/ffmpeg/` khi có yêu cầu xử lý media; xác minh SHA-256, tái sử dụng binary, không đóng gói cứng vào app. Chưa có tác vụ yêu cầu Python.
- [x] IPC Bridge bắn sự kiện `VisualOfficeEvent` qua Electron preload.

Ca 2 đã kiểm thử: 25/25 bài kiểm thử Ca 1-Ca 2 đạt (bao gồm tải FFmpeg thật, cắt/ghép audio); `npm run build` thành công. Pha 2 sẽ nối adapter CLI đã cấu hình, dữ liệu quota thực tế và media vào luồng ứng dụng.

## PHA 2: KHỚP NỐI & TINH CHỈNH GIAO DIỆN (ĐANG CHẠY)
**Nhánh CODEX (Backend):**
- [ ] CODEX: Viết hàm lấy trạng thái Agent, API Key, Dung lượng và gửi sự kiện IPC `active_rooms_update` theo `types.ts` mới.
- [ ] CODEX: Truyền tên model thực tế (`worker_model_name`) vào sự kiện `VisualOfficeEvent`.

**Nhánh GEMINI 3.8 FLASH (Frontend):**
- [ ] GEMINI: Code Màn hình Cài đặt 4 Tab (Có Agent chat mặc định và API Key dự phòng dưới từng Agent).
- [ ] GEMINI: Tinh chỉnh 3D - Chỉ hiện phòng ĐÃ KẾT NỐI (dựa vào `active_rooms_update`). Có hành lang trung tâm.
- [ ] GEMINI: Tinh chỉnh 3D - Tia sáng chạy dọc hành lang vào cửa phòng. Gắn tên Model lên đầu nhân vật.
- [ ] CHỜ KIỂM TRA: Chạy `npx tsc --noEmit` & Build Electron `.exe` thành công.