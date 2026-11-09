# 02. ĐẶC TẢ GIAO DIỆN & ĐỒ THỊ TRI THỨC (THEO THIẾT KẾ FIGMA SVG)

> **RÀNG BUỘC TUYỆT ĐỐI CHO FRONTEND AI:**
> Toàn bộ giao diện phải được dựng chính xác 100% theo các file SVG trong thư mục `/docs/design/`. Không tự ý thay đổi bố cục, màu sắc, nội dung text hay khoảng cách.

---

## 1. Bảng màu & Hệ thống Định danh (Design Tokens trích xuất từ SVG)
* **Màu nền (Backgrounds):**
  - Nền tổng thể App: `#070B12`
  - Nền các Panel chính (Sidebar, Chat, Graph, Task): `#0B111B` / `#0D1522`
  - Nền Card / Khung trong (Code block, Input, Graph canvas): `#080D16` / `#101928`
  - Viền (Border mặc định): `#1B283B` / `#223249`
* **Màu Định danh Agent & Trạng thái Đồ thị:**
  - **ChatGPT / Nút Hành động chính (Gửi, Lưu, Apply):** Xanh lục bảo `#3CE38D` (Glow: `rgba(60, 227, 141, 0.35)`).
  - **Gemini (Antigravity):** Tím `#A67CFF` (Glow: `rgba(166, 124, 255, 0.35)`).
  - **Codex:** Xanh dương `#4FA8FF`.
  - **Claude / Cảnh báo:** Cam vàng `#F5A54A`.
  - **Lỗi (Error Node / Nút Xóa chat):** Đỏ cam `#FF7A59` (Glow: `rgba(255, 122, 89, 0.35)`).
  - **Bỏ qua (Ignored/Excluded Node):** Xám đá `#5E718D`.

---

## 2. Thanh Điều hướng Trên cùng (Top Navigation Bar)
Tham chiếu: `docs/design/01 Dashboard.svg`
* **Góc trái:** Logo khối lục giác xanh lá `Synapse OS` + dấu phân cách `|` + Dropdown chọn Dự án hiện tại (`📁 Video 360 Highlights ⌄`).
* **Chính giữa:** Cụm nút chuyển đổi 2 chế độ:
  1. `[💬 Chat]` (Chế độ chỉ chat).
  2. `[🕸️ Chat + Graph]` (Trạng thái đang chọn có viền xanh `#3CE38D` và nền tối ánh xanh).
* **Góc phải:**
  - Badge trạng thái `[• SHADOW WORKSPACE]` (chấm tròn xanh dương + chữ in hoa monospace báo hiệu chế độ không lưu file rác vào dự án).
  - Nút `[⚙️ Cài đặt]` mở Modal Cài đặt.

---

## 3. Bố cục 3 Cột Màn hình Chính (`01 Dashboard.svg`)

### 3.1. Cột Trái (Sidebar - Quản lý Chat, Dự án & Giới hạn Agent)
1. **Nút trên cùng:** `[+ Cuộc trò chuyện mới]` (Viền xanh lá `#3CE38D`, chữ xanh lá).
2. **Mục `LỊCH SỬ CHAT`:**
   - Danh sách các cuộc trò chuyện độc lập (`Lịch trình 2N1Đ`, `Website portfolio`, `Tra cứu FFmpeg`).
   - Hỗ trợ icon Ghim xanh lá (`📌`) và nút menu `•••` khi hover.
3. **Mục `DỰ ÁN` (Có nút `+` để thêm dự án):**
   - Thư mục dự án (VD: `📁 Video 360 Highlights`) có **icon Database/Shadow** màu xanh dương nhỏ bên cạnh và nút `•••`.
   - Cây danh sách các cuộc trò chuyện con bên trong dự án (`Chọn khoảnh khắc`, `Viết pipeline`, `Kiểm thử bản xuất`). Mục đang chọn có viền trái/khung sáng nhẹ và icon ghim.
4. **Mục `GIỚI HẠN AGENT` (Dưới cùng):**
   - Header: `% đã dùng` (trái) và `5 giờ / Tuần` (phải).
   - 4 hàng tương ứng 4 Agent (`• ChatGPT`, `• Gemini`, `• Codex`, `• Claude`) với chỉ số `% 5h / % Tuần` và thanh tiến trình ngang (Progress Bar) mang đúng màu của từng Agent.

### 3.2. Cột Giữa (Khung Chat & Không gian Làm việc Đa phương tiện)
1. **Header Khung Chat:** Tiêu đề cuộc trò chuyện (`Chọn khoảnh khắc`), đường dẫn phụ (`Video 360 Highlights / Chat dự án`), và badge góc phải `[• Tự động điều phối]`.
2. **Luồng Tin nhắn:**
   - Tin nhắn người dùng (bên phải) kèm thẻ file đính kèm (`trip_360.mp4 · 128 MB`).
   - Phản hồi của `Synapse OS` (bên trái):
     - **Thanh Trạng thái Tác tử:** Khung viền tím hiển thị `• Gemini đang chọn khoảnh khắc` và nút điều hướng nhanh `Xem đồ thị ↗` ở góc phải.
     - **Khối Code (`pipeline.py`):** Header có tên file và 3 nút `[Copy]`, `[Run]`, `[Apply]` (nút Apply màu xanh lá). Nội dung code có đánh số dòng và tô màu cú pháp (Syntax Highlighting).
     - **Khối Media (`360° PREVIEW`):** Khung xem trước video có nhãn `360° PREVIEW` ở góc trái trên, nút Play ở giữa, thanh điều khiển thời gian (`00:12 / 00:30`), dòng chữ `Bản xem trước · highlight_01.mp4` và nút `[↓ Tải bản xem trước]`.
3. **Thanh Nhập liệu Thông minh (Bottom Input Bar):**
   - Ô nhập text `Nhập yêu cầu cho dự án...`
   - Hàng công cụ dưới: 3 nút pill bên trái (`[📎 Đính kèm]`, `[@Agent]`, `[Tự động ▾]`) và nút `[✈️ Gửi]` màu xanh lá `#3CE38D` bên phải.

### 3.3. Cột Phải (Codebase Knowledge Graph & Sơ đồ Task)
1. **Nửa trên: Khung `Codebase Knowledge Graph`**
   - Header: Tiêu đề `Codebase Knowledge Graph`, phụ đề `Video 360 Highlights / main`, và badge góc phải `[• ĐANG CHẠY]` màu xanh lá.
   - Canvas Đồ thị: Nền kẻ ô lưới (grid), góc trên trái có pill `9 NODES / 10 EDGES`, góc trên phải có 4 nút vuông xếp dọc: `[🔍]` (Tìm kiếm), `[+]` (Phóng to), `[-]` (Thu nhỏ), `[⛶]` (Căn giữa/Toàn khung).
   - Chú thích dưới đáy (Legend): `• ChatGPT`, `• Gemini`, `• Bỏ qua`, `• Lỗi` ở bên trái; chữ `Cuộn để zoom` ở bên phải.
2. **Nửa dưới: Khung `Sơ đồ task`**
   - Header: Icon phân lớp + `Sơ đồ task` (trái) và tiến độ `1/5 hoàn tất` kèm thanh progress xanh lá (phải).
   - Cây phân cấp tác vụ (`Tool cắt video 360`):
     - `[A] Phân tích yêu cầu` — Badge `ChatGPT` — `✓ Hoàn tất` (Xanh lá).
     - `[B] Chọn khoảnh khắc` — Badge `Gemini` — `62% · Đang chạy` (Tím), mở rộng ra 2 sub-task con:
       - `└ [B1] Phát hiện cảnh` — Badge `Gemini` — `Đang chạy`.
       - `└ [B2] Chấm điểm cảnh` — Badge `Gemini` — `Đang chạy`.
     - `[C] Viết pipeline` — Badge `Codex` — `Đang chạy` (Xanh dương).
     - `[D] Kiểm thử` — Badge `Codex` — `Chờ`.
     - `[E] Tổng hợp` — Badge `Claude` — `Chờ`.

---

## 4. Đặc tả Các Màn hình Phụ & Popover (`04`, `05`, `06`, `07`)
* **`07 Quản lý chat.svg`:**
  1. **Menu cuộc trò chuyện:** Khi bấm `•••` trên một cuộc trò chuyện, mở menu gồm 3 mục: `[✏️ Đổi tên]`, `[📌 Bỏ ghim / Ghim]`, `[🗑️ Xóa]` (chữ đỏ cam).
  2. **Modal `Đổi tên chat`:** Input có viền xanh lá `#3CE38D` chứa tên chat hiện tại, nút `[Hủy]` và `[Lưu]` (xanh lá).
  3. **Modal `Xóa cuộc trò chuyện?`:** Nội dung cảnh báo rõ tên chat và tên dự án, nút `[Hủy]` và `[Xóa chat]` (màu cam đỏ `#FF8563`).