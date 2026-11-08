### TAB 1: MẠNG LƯỚI AI (AI NETWORK)
**1. Khu vực Cấu hình Chung (Top Section):**
*   **Tiêu đề:** Quản lý Nền tảng & Hạn mức.
*   **Cấu hình Chat Mặc định:** Có một khối riêng biệt chọn `Agent xử lý Chat mặc định` kèm dropdown (VD: Đang chọn `Gemini 3.8 Flash`)[cite: 9]. Phần mô tả ghi rõ: *"Dùng cho câu hỏi thông thường ở chế độ Chỉ chat"* đính kèm badge nhỏ báo trạng thái[cite: 9].

**2. Danh sách Agent (Agent Cards):**
Mỗi Card (như ChatGPT, Codex, Antigravity) có cấu trúc chuẩn như sau:
*   Bên trái: Logo Agent + Tên hiển thị + Vai trò (VD: `ChatGPT` - `Điều phối & Suy luận`)[cite: 9].
*   Chính giữa: Dấu chấm trạng thái (`🟢 OAuth - OS Keychain`) + Nút `[Đăng xuất]` & `[Làm mới phiên]`[cite: 9].
*   Bên phải: Chỉ số Quota (`5h 40% · Tuần 28%`) + **Nút Menu `[...]`**[cite: 9].
*   Thanh trượt: `Ngưỡng cảnh báo` (Kéo slider từ 0% đến 100%, có mốc báo 80%)[cite: 9].

**3. Tương tác Bảng API Key Dự Phòng (Khối Mở rộng):**
*   **Trigger:** Khi bấm vào nút `[...]` ở thẻ Agent, một menu thả xuống xuất hiện với lựa chọn `[🔑 API Key dự phòng]`[cite: 9].
*   **Expand Panel (Panel trượt xuống dưới thẻ Agent):**
    *   Tiêu đề: `API Key dự phòng` kèm text giải thích và trạng thái kết nối (`✓ Kết nối hợp lệ`)[cite: 9].
    *   Công tắc gạt (Toggle): `Dùng API khi phiên chính lỗi`[cite: 9].
    *   Input nhập Key: Ô mật khẩu ẩn bằng dấu `*`, có icon Con mắt (`👁️`) để xem tạm thời[cite: 9].
    *   Cảnh báo bảo mật: Icon ổ khóa + *"Lưu trong kho bảo mật hệ điều hành"* + Icon cảnh báo vàng *"API có chi phí riêng"* (nhắc nhở người dùng vì đây không phải luồng $0)[cite: 9].
    *   Nút hành động: `[Kiểm tra kết nối]` (Gửi lệnh ping API) và `[Lưu key]` (Ghi vào OS Keychain)[cite: 9].