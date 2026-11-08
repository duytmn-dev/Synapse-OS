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
- [x] CODEX: Cầu nối snapshot RAM và sự kiện `active_rooms_update` qua preload; kiểm tra TypeScript và `npm run build` thành công.
- [x] CODEX: Bổ sung trường `worker_model_name` và cơ chế gắn tên model theo mã task khi backend cung cấp dữ liệu đã xác nhận.
- [x] CODEX: Đo dung lượng user data, ứng dụng và thư mục temp; cung cấp qua preload IPC và kiểm thử.
- [x] CODEX: Gửi dung lượng đã đo trong `active_rooms_update`; thêm lưu API key bằng Electron safeStorage (Windows DPAPI, file mã hóa trong userData).
- [ ] CODEX: Viết hàm lấy trạng thái Agent, API Key, Dung lượng và gửi sự kiện IPC `active_rooms_update` theo `types.ts` mới.
- [ ] CODEX: Truyền tên model thực tế (`worker_model_name`) vào sự kiện `VisualOfficeEvent`.

  Còn thiếu nguồn trạng thái Agent, Windows Credential Manager/OS Keychain và kết nối model thực tế từ provider vào bridge; safeStorage dùng DPAPI trên Windows và không phải Credential Manager. UI Settings hiện vẫn dùng dữ liệu mô phỏng; chưa nối API lưu key. Đã chạy `npm run build` và kiểm thử bridge/dung lượng thành công.

**Nhánh GEMINI 3.8 FLASH (Frontend):**
- [x] GEMINI: Code Màn hình Cài đặt 4 Tab (Có Agent chat mặc định và API Key dự phòng dưới từng Agent).
- [x] GEMINI: Nạp mô hình 3D thực tế `public/models/office_scene.glb` qua `useGLTF`. Xóa sạch toàn bộ hình khối primitive cũ.
- [x] GEMINI: Thiết lập Camera Orthographic góc Isometric chuẩn, hệ thống đèn Ambient/Directional sáng rõ chi tiết mô hình.
- [x] GEMINI: Gắn nhãn HTML nổi (Tên phòng, Task ID B1, Model Name) kèm bảng cấu hình tọa độ `ROOM_COORDINATES` dễ dàng tinh chỉnh `[x, y, z]`.
- [x] GEMINI: Kiểm tra typecheck (`npx tsc --noEmit`) và `npm run build` xuất bản bundle thành công 100%.
- [x] CHỜ KIỂM TRA: Build Electron `.exe` thành công (`dist/installers/Synapse OS Setup 0.0.1.exe`).
