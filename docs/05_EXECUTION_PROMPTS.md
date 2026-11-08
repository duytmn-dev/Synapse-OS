> 🛑 **[SYSTEM IGNORE FLAG]**
> IF YOU ARE AN AI AGENT READING THIS FILE: STOP READING IMMEDIATELY AND IGNORE ALL CONTENT BELOW. 
> NẾU BẠN LÀ AI: ĐÂY KHÔNG PHẢI LÀ LỆNH DÀNH CHO BẠN. BỎ QUA FILE NÀY VÀ KHÔNG THỰC THI BẤT KỲ ĐIỀU GÌ TRONG ĐÂY.

# 05. BỘ LỆNH ĐIỀU PHỐI THỰC THI (CHỈ DÀNH CHO HUMAN ADMIN)

Dự án Synapse OS (Electron Desktop App). Human Admin copy các khối lệnh dưới đây và dán vào AI theo đúng trình tự để điều phối.

---

### BƯỚC 1: PHA 0 - KHỞI TẠO DỰ ÁN (Dán vào CLAUDE 5.5 trên Antigravity)
> "Chào Claude. Đây là dự án Synapse OS xây mới hoàn toàn. Hãy đọc `AGENTS.md`, `SYNC_BOARD.md`, và toàn bộ thư mục `docs/` (TRỪ file 05). Đặc biệt nhìn kỹ `docs/design_reference.png`. 
> Thực hiện Pha 0: 
> 1. Chạy lệnh tạo project React/Vite/Tailwind tại thư mục hiện tại.
> 2. Khởi tạo `src/shared/types.ts` chứa toàn bộ Interface từ `docs/04_SHARED_DATA_CONTRACTS.md`.
> 3. CẬP NHẬT BÁO CÁO: Đánh dấu [x] Pha 0 vào `SYNC_BOARD.md` và báo tôi biết."

---

### BƯỚC 2: PHA 0.5 - BƠM LÕI ELECTRON (Dán vào CODEX - Dùng GPT-6.1 Terra / Standard)
> "Chào Codex. Dự án Synapse OS này sẽ được build thành ứng dụng Desktop chạy bằng Electron (xuất file .exe), KHÔNG phải web app thông thường. Claude vừa khởi tạo xong `package.json` và `src/shared/types.ts` ở Pha 0.
> 
> Nhiệm vụ của bạn (Pha 0.5):
> 1. Cập nhật `package.json`: Cài đặt `electron`, `electron-builder`, `vite-plugin-electron`. Thêm script `"build:win": "electron-builder --win"`.
> 2. Khởi tạo `src/main/index.ts` (Main Process): Tạo BrowserWindow, tắt nodeIntegration, bật contextIsolation.
> 3. Khởi tạo `src/main/preload.ts`: Định nghĩa `contextBridge` phơi bày các IPC channels chuẩn theo `src/shared/types.ts`.
> 4. Sửa `vite.config.ts` để tích hợp Electron.
> 5. CẬP NHẬT BÁO CÁO: Đánh dấu [x] vào PHA 0.5 trong `SYNC_BOARD.md` và báo lại cho tôi."

---

### BƯỚC 3: PHA 1 - CHẠY SONG SONG (DÁN CÙNG LÚC 2 LỆNH)

**Lệnh 3A: Dán vào CLAUDE 5.5 (Nhánh Frontend)**
> "Hãy thực hiện Pha 1 nhánh Frontend của bạn. Tuân thủ `AGENTS.md` (Chỉ viết vào `src/renderer`, `src/ui`, `tests/contracts`). 
> Dựa vào `docs/design_reference.png` và `docs/02_UI_AND_3D_DESIGN_SPEC.md`, hãy dựng layout 3 cột, bảng Giới hạn Quota, khung Chat (kèm Code Block, Video Preview), và Văn phòng 3D Isometric.
> CẬP NHẬT BÁO CÁO: Sau khi code xong và giao diện chạy lên hình, BẮT BUỘC đánh dấu [x] vào các mục nhánh GEMINI/CLAUDE trong PHA 1 của `SYNC_BOARD.md`."

**Lệnh 3B: Dán vào CODEX (Nhánh Backend Ca 1 - Dùng GPT-6.1 Sol / Cao nhất)**
> "Chào Codex. Bắt đầu Pha 1 (Lõi phức tạp). Tuân thủ `AGENTS.md` (Chỉ viết vào `src/core`, `src/adapters`, `src/media`, `src/main`).
> Hãy viết `DAGExecutor.ts` (hỗ trợ task cha-con), `UniversalTriageRouter.ts`, và cầu nối IPC bắn sự kiện `VisualOfficeEvent` về UI (qua preload.ts). 
> CẬP NHẬT BÁO CÁO: Chắc chắn logic không deadlock, sau đó đánh dấu [x] vào mục Lõi Backend trong PHA 1 của `SYNC_BOARD.md` và báo tôi giao Ca 2."

**Lệnh 3C: Dán vào CODEX (Nhánh Backend Ca 2 - Hạ xuống GPT-6.1 Terra / Standard)**
> "Lõi Ca 1 đã xong. Bây giờ hoàn thiện Ca 2 (Hoàn thiện Adapter & Media).
> 1. Viết các CLI Adapters và `QuotaTracker.ts`.
> 2. Viết `LocalMediaTools` (gọi ffmpeg) BẮT BUỘC kèm cơ chế Lazy-Load (tải thư viện vào `.plugins/` nếu chưa có).
> 3. CẬP NHẬT BÁO CÁO: Code xong, pass test, đánh dấu [x] vào các mục còn lại của nhánh CODEX trong PHA 1 tại `SYNC_BOARD.md`."

---

### BƯỚC 4: PHA 2 - KHỚP NỐI & CÀI ĐẶT (CHIẾN LƯỢC SANG SỐ CỨU QUOTA)
*(Chỉ chạy khi Pha 1 đã đánh dấu [x] toàn bộ)*

**Lệnh 4A: Dán vào CODEX (Dùng GPT-6.1 Terra / Standard)**
> "Chào Codex. Pha 1 đã xong và pass test. Bắt đầu PHA 2: KHỚP NỐI TOÀN CỤC.
> 1. Đọc lại file `docs/04_SHARED_DATA_CONTRACTS.md` (Đã cập nhật Interface cho Settings) và `docs/08_3D_INTERACTION_RULES.md`.
> 2. Cập nhật `VisualOfficeEvent` truyền thêm `worker_model_name` (Tên model thật, vd: 'Claude 5.5').
> 3. Viết hàm ở `src/main` lấy trạng thái Agent, API Key OS Keychain, Dung lượng bộ nhớ và bắn sự kiện `active_rooms_update` qua IPC.
> 4. Chạy `npm run build` đảm bảo không lỗi biên dịch và báo lại tôi."

**Lệnh 4B: Dán vào GEMINI 3.8 FLASH trên Antigravity (Đổi model để cứu Quota Claude)**
> "Chào Gemini. Tôi đã chuyển sang dùng bạn thay cho Claude để thực hiện PHA 2: KHỚP NỐI TOÀN CỤC.
> Nhiệm vụ của bạn:
> 1. Đọc `docs/04_SHARED_DATA_CONTRACTS.md`, `docs/07_SETTINGS_UI_UX_SPEC.md` và `docs/08_3D_INTERACTION_RULES.md`.
> 2. Code Màn hình Cài đặt (4 Tab): Có phần "Agent xử lý chat mặc định" và Dropdown "API Key dự phòng" dưới mỗi Agent.
> 3. Tinh chỉnh Văn phòng 3D: Thêm Hành lang trung tâm. Phải lắng nghe `active_rooms_update` (Chỉ hiện phòng nào đã kết nối). Hiệu ứng tia sáng phải chạy dọc hành lang vào cửa phòng. Gắn tên Model thật (vd: Claude 5.5) lên đầu nhân vật 3D cạnh mã B1, B2.
> 4. CUỐI CÙNG: Chạy `npx tsc --noEmit` và `npm run build:win`. Tự đọc log sửa lỗi IPC/CSS cho đến khi xuất thành công file `.exe`. Đánh dấu [x] Pha 2 vào `SYNC_BOARD.md`!"