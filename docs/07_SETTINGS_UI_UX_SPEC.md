# 07. ĐẶC TẢ UI/UX MÀN HÌNH CÀI ĐẶT (`02` & `03 Cài đặt.svg`)

> **RÀNG BUỘC THIẾT KẾ:** Bám sát tuyệt đối 2 file `docs/design/02 Cài đặt · Mạng lưới AI.svg` và `docs/design/03 Cài đặt · API Key dự phòng.svg`.

---

## 1. Khung Modal & Background
* **Hình nền phía sau Modal:** Là nền lưới tối màu có các chùm Node và đường nối Đồ thị mờ chìm phía dưới (thay thế hoàn toàn nền Văn phòng 3D cũ).
* **Header Modal:** Icon bánh răng xanh lá `#3CE38D` + Tiêu đề `Cài đặt` + `/ Synapse OS` màu xám + Nút đóng `[✕]` góc phải.
* **Cột Menu Trái (4 Tab):**
  1. `Mạng lưới AI` (Đang chọn: viền xanh `#3CE38D`, chữ xanh lá).
  2. `Hệ thống & Công cụ`
  3. `Trải nghiệm & Đồ thị` *(Lưu ý: Đã đổi tên từ "Trải nghiệm & 3D")*
  4. `Bản dựng & Cập nhật`
* **Footer Modal:** Nút `[Hủy]` và nút `[Lưu thay đổi]` (Nền xanh lá `#3CE38D`, chữ đen đậm).

---

## 2. Chi tiết Tab 1: Mạng lưới AI (`02 Cài đặt · Mạng lưới AI.svg`)

### 2.1. Khu vực Cấu hình Chung
* Tiêu đề: `Quản lý nền tảng & hạn mức`
* Mô tả phụ: `Kết nối agent, chọn cấu hình mặc định và đặt phương án dự phòng.`
* **Khối `Agent xử lý chat mặc định`:**
  - Bên trái: Icon khung chat + `Agent xử lý chat mặc định` + dòng mô tả `Áp dụng khi ở chế độ Chỉ chat.`
  - Bên phải: Dropdown đang chọn `[Gemini · Antigravity ▾]`.
* **Hàng Chú thích Trạng thái:** `• Kết nối` (Xanh lá) — `• Ngắt kết nối` (Đỏ cam) — `• Hết quota` (Vàng cam).

### 2.2. Danh sách 4 Thẻ Agent (Agent Cards)
1. **Thẻ `ChatGPT` (`Điều phối & suy luận`):**
   - Trạng thái: `• OAuth · OS Keychain` (Xanh lá).
   - Chỉ số: `5h 40% · Tuần 28%`.
   - Cụm nút bên phải: `[Đăng xuất]`, `[Làm mới]`, và nút `[•••]`.
   - Hàng dưới (Khi chưa mở API Key dự phòng): Thanh trượt `Ngưỡng cảnh báo` màu xanh lá đang ở mức `80%`.
2. **Thẻ `Antigravity · Gemini` (`UI & Vision`):**
   - Trạng thái: `• Đang chạy qua CLI` (Xanh lá).
   - Chỉ số: `5h 25% · Tuần 18%`.
   - Nút bên phải: `[Kiểm tra CLI]`.
3. **Thẻ `Codex` (`Backend Builder`):**
   - Trạng thái: `• Đã kết nối` (Xanh lá).
   - Chỉ số: `5h 70% · Tuần 45%`.
   - Nút bên phải: `[Đăng xuất]`.
4. **Thẻ `Claude` (`Agent công ty`):**
   - Trạng thái: `• Chưa kết nối` (Xám).
   - Chỉ số: `5h 90% · Tuần 65%`.
   - Nút bên phải: `[Kết nối]`.
5. **Nút dưới cùng:** `[+ Thêm AI mở rộng]` (Viền nét đứt/mờ, chữ xanh lá `#3CE38D`).

---

## 3. Khối Mở rộng `API Key dự phòng` (`03 Cài đặt · API Key dự phòng.svg`)
Khi người dùng bấm vào nút `[•••]` hoặc nút `[🔑 API Key dự phòng]` ở góc phải thẻ Agent (VD: thẻ ChatGPT), phần bên dưới thẻ sẽ mở rộng ra khung `API Key dự phòng`:
* **Hàng 1:** Tiêu đề `API Key dự phòng` (trái) và trạng thái `✓ Kết nối hợp lệ` màu xanh lá (phải).
* **Hàng 2:** Dòng chữ `Dùng API khi phiên chính gặp lỗi` (trái) và công tắc gạt (Toggle Switch) màu xanh lá `#3CE38D` đang bật (phải).
* **Hàng 3 (`API Key`):** Ô input mật khẩu hiển thị chuỗi dấu chấm tròn `••••••••••••••••••••••••••••••••` kèm nút icon Con mắt `[👁️]` ở góc phải để ẩn/hiện tạm thời.
* **Hàng 4 (Cảnh báo & Hành động):**
  - Bên trái: Icon tam giác cảnh báo màu cam + chữ màu cam `⚠️ Lưu trong kho bảo mật OS. API có chi phí riêng.`
  - Bên phải: Nút `[Kiểm tra kết nối]` và nút `[Lưu key]` (Nền xanh lá `#3CE38D`).