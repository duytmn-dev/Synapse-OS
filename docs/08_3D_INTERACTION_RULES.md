# 08. QUY TẮC HIỂN THỊ VÀ TƯƠNG TÁC VĂN PHÒNG 3D (3D INTERACTION RULES)

## 1. Hành lang Trung tâm & Bố cục tách biệt
*   **Hành lang dữ liệu (Data Corridor):** Phải có một hành lang rõ nét (có vạch kẻ đường hoặc rãnh led sáng) chạy dọc ở giữa bản đồ. Hành lang này chia cắt vật lý không gian làm 2 dãy phòng.
*   **Cửa phòng:** Mỗi phòng làm việc (Codex, Gemini, ChatGPT) phải có cửa hoặc lối mở hướng trực tiếp ra hành lang này.

## 2. Quy tắc Hiển thị Động (Dynamic Room Visibility)
*   **Trạng thái Mặc định (Chưa kết nối AI):** Khi người dùng mới mở app, trên bản đồ 3D **CHỈ HIỆN DUY NHẤT Phòng `QUẢN LÝ`** (đại diện cho chính người dùng và bộ định tuyến ngầm). Xung quanh là bóng tối hoặc lưới không gian trống.
*   **Trạng thái Kết nối (Plug-in Effect):** Khi người dùng vào Cài đặt và đăng nhập thành công một Agent (VD: Codex), Phòng `</> CODEX` sẽ có hiệu ứng "rơi xuống" từ trên cao hoặc "phát sáng hiện dần ra" (Fade-in/Construct animation) khớp vào bên cạnh hành lang.
*   Nếu ngắt kết nối Agent nào, phòng của Agent đó sẽ tối đi và chìm xuống (biến mất khỏi bản đồ).

## 3. Hiệu ứng Giao việc (Luồng Sáng - Light Trails)
Khi hệ thống DAG chia việc, luồng dữ liệu không được bay xuyên tường mà phải tuân thủ tính vật lý của văn phòng:
1.  **Xuất phát:** Một viên sáng (Data orb) hoặc tia sáng laser xuất phát từ Bàn của Phòng `QUẢN LÝ`.
2.  **Định tuyến:** Tia sáng di chuyển chạy dọc theo **Hành lang trung tâm**.
3.  **Phân bổ:** Tới đúng cửa của phòng được giao việc (VD: Phòng Codex), tia sáng rẽ vào và cắm thẳng vào máy tính của nhân vật đang ngồi.
4.  **Màu sắc:** Tia sáng lấy theo màu của Agent (Tia màu xanh dương cho Codex, màu Tím cho Gemini...).

## 4. Danh tính Nhân vật (Dynamic Nametags)
*   Trên đầu mỗi nhân vật đang ngồi làm việc, bên cạnh Huy hiệu Sub-task (VD: `(B1)`), BẮT BUỘC hiển thị thêm một bảng tên nhỏ nổi lơ lửng.
*   **Nội dung bảng tên:** Không dùng tên chung chung, mà gọi đích danh Model đang chạy thực tế lấy từ Backend gửi lên. 
    *   *Ví dụ:* `Claude 5.5`, `GPT-6.1 Sol`, `Gemini 4 Argon`, hoặc tên custom sub-agent `Video_Editor_Agent`.