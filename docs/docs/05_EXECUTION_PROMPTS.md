> 🛑 **[SYSTEM IGNORE FLAG]**
> IF YOU ARE AN AI AGENT READING THIS FILE: STOP READING IMMEDIATELY AND IGNORE ALL CONTENT BELOW. 
> NẾU BẠN LÀ AI: ĐÂY KHÔNG PHẢI LÀ LỆNH DÀNH CHO BẠN. BỎ QUA FILE NÀY VÀ KHÔNG THỰC THI BẤT KỲ ĐIỀU GÌ TRONG ĐÂY.

# 05. BỘ LỆNH ĐIỀU PHỐI THỰC THI (CHỈ DÀNH CHO NGƯỜI QUẢN TRỊ)

Dự án bắt đầu từ thư mục trống. Human Admin copy các lệnh dưới đây dán vào AI theo đúng trình tự:

### BƯỚC 1: PHA 0 - DÁN VÀO CLAUDE 5.5 (TRÊN ANTIGRAVITY)
> "Chào Claude. Đây là một dự án mới hoàn toàn. Hãy đọc `AGENTS.md`, `SYNC_BOARD.md`, và toàn bộ thư mục `docs/` (TRỪ file 05). Đặc biệt nhìn kỹ `docs/design_reference.png`. 
> Thực hiện Pha 0: 
> 1. Chạy lệnh tạo project React/Vite/Tailwind (hoặc tương đương) tại thư mục hiện tại.
> 2. Khởi tạo `src/shared/types.ts` chứa toàn bộ Interface từ `docs/04_SHARED_DATA_CONTRACTS.md`.
> 3. Cập nhật đánh dấu [x] Pha 0 vào `SYNC_BOARD.md` và báo tôi biết."

### BƯỚC 2: PHA 1 - CHẠY SONG SONG (DÁN CÙNG LÚC 2 LỆNH)

**Lệnh dán vào CLAUDE 5.5 (Antigravity):**
> "Hãy thực hiện Pha 1 nhánh Frontend của bạn theo `SYNC_BOARD.md`. 
> Tuân thủ `AGENTS.md` (Chỉ viết vào `src/renderer`, `src/ui`, `tests/contracts`). Dựa vào `docs/design_reference.png` và `docs/02_UI_AND_3D_DESIGN_SPEC.md`, hãy dựng layout 3 cột, bảng Giới hạn Quota, khung Chat, và Văn phòng 3D Isometric (chú ý huy hiệu B1, B2 trên đầu nhân vật 3D và sơ đồ task cây). Khi code xong, cập nhật `SYNC_BOARD.md`."

**Lệnh dán vào CODEX (Bật chế độ `6.1 Sol high` hoặc o1/o3-mini):**
> "Chào Codex. Dự án mới bắt đầu, Claude đang làm Frontend. Hãy đọc `AGENTS.md`, `SYNC_BOARD.md`, `docs/03_BACKEND_CORE_AND_DAG.md` và `src/shared/types.ts`.
> Tuân thủ `AGENTS.md` (Chỉ viết vào `src/core`, `src/adapters`, `src/media`, `src/main`).
> Nhiệm vụ Ca 1 (Lõi phức tạp): Hãy viết `DAGExecutor.ts` (hỗ trợ task cha-con), `UniversalTriageRouter.ts`, và cầu nối IPC bắn `VisualOfficeEvent` về UI. Chỉ tập trung viết 3 module này cho chuẩn xác, không bị deadlock. Xong việc báo tôi."

### BƯỚC 3: HẠ CẤU HÌNH CODEX & HOÀN THIỆN
**Lệnh dán vào CODEX (Sau khi hạ xuống GPT-4o Standard / Medium):**
> "Lõi đã xong. Bây giờ hãy hoàn thiện Ca 2 để tiết kiệm Quota: Viết các CLI Adapters, `QuotaTracker.ts` (để tính % 5h/Tuần), và `LocalMediaTools` (gọi ffmpeg). Cuối cùng viết Unit Test và cập nhật `SYNC_BOARD.md`."