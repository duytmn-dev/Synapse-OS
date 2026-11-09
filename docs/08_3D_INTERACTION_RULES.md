# 08. QUY TẮC HIỂN THỊ VÀ TƯƠNG TÁC ĐỒ THỊ TRI THỨC (GRAPH INTERACTION RULES)

> Tài liệu này thay thế hoàn toàn file `08_3D_INTERACTION_RULES.md` cũ và quy định chi tiết cách Frontend render các file SVG: `Graph Nodes & Flow.svg`, `04 Hover Node.svg`, `05 Context Menu.svg`, `06 Tìm kiếm file.svg`.

---

## 1. Quy tắc Hiển thị Điểm (Nodes) - Theo `Graph Nodes & Flow.svg`
Mỗi Node đại diện cho một file (`main.py`, `pipeline.py`, `config.yaml`) hoặc một hàm (`cut_highlights()`, `score_scene()`). Có 5 trạng thái chuẩn:
1. **Mặc định (`DEFAULT`):** Hình tròn nhỏ nền tối `#0B111B`, viền xám xanh `#64748B` (hoặc xanh cyan nhạt `#38BDF8` cho hàm), nhãn tên file màu trắng xám bên dưới.
2. **ChatGPT đang xử lý (`ACTIVE_CHATGPT`):** Tâm trắng sáng, quầng sáng (Glow) kép màu xanh lục bảo `#3CE38D` tỏa rộng, chữ tên file bên dưới đổi sang màu xanh `#3CE38D`.
3. **Gemini đang xử lý (`ACTIVE_GEMINI`):** Tâm trắng sáng, quầng sáng (Glow) kép màu tím `#A67CFF` tỏa rộng, chữ tên file đổi sang màu tím `#A67CFF`.
4. **Bỏ qua (`IGNORED` / `Excluded`):** Hình tròn nhỏ viền xám mờ `#475569`, độ trong suốt giảm xuống (opacity ~50%), nhãn tên file màu xám tối `#64748B`. AI bị cấm đọc/sửa Node này.
5. **Lỗi (`ERROR`):** Tâm trắng sáng, quầng sáng (Glow) kép màu đỏ cam `#FF7A59`, chữ tên file bên dưới đổi sang màu đỏ cam `#FF7A59`.

---

## 2. Quy tắc Đường nối (Edges) & Hiệu ứng Luồng sáng (`Path lights up`)
Theo thiết kế `Graph Nodes & Flow.svg`:
1. **Edge mặc định (Trạng thái tĩnh):**
   - Đường kẻ mảnh màu xám xanh tối `#26354D` (nét liền cho liên kết trực tiếp `IMPORTS`/`CALLS`, nét đứt cho liên kết kiểm thử/phụ thuộc phụ như `test_export.py` -> `export.py`).
2. **`Path lights up · ChatGPT` (Khi ChatGPT/Codex truyền luồng xử lý từ Node A sang Node B):**
   - Toàn bộ đường nối giữa 2 Node chuyển sang màu xanh lá `#3CE38D`.
   - Có một **đoạn tia sáng dày phát quang (glowing segment)** kèm hạt sáng trắng-xanh và mũi tên định hướng (`->`) chạy dọc từ Node nguồn sang Node đích.
3. **`Path lights up · Gemini` (Khi Gemini truyền luồng xử lý từ Node A sang Node B):**
   - Toàn bộ đường nối giữa 2 Node chuyển sang màu tím `#A67CFF`.
   - Đoạn tia sáng dày phát quang kèm hạt sáng trắng-tím và mũi tên định hướng (`->`) chạy dọc theo đường nối.

---

## 3. Tương tác Chuột & Bàn phím trên Đồ thị

### 3.1. Di chuột qua Node (Hover Tooltip - `04 Hover Node.svg`)
Khi người dùng di chuột (hover) lên một Node (VD: `pipeline.py`), hiển thị một khung Tooltip nổi ngay cạnh Node:
* **Style:** Bo góc `12px`, nền kính mờ `#101928` (opacity 95%, backdrop-blur), viền `#263852`.
* **Nội dung 3 dòng:**
  1. Icon file code màu xanh lá + Tên file in đậm (`pipeline.py`).
  2. Thống kê cấu trúc: `5 hàm · 5 liên kết` (lấy từ `function_count` và `link_count` thật).
  3. Thời gian cập nhật: `Thay đổi 2 phút trước` (tính từ `last_modified_ms` thật).

### 3.2. Click Chuột phải vào Node (Context Menu - `05 Context Menu.svg`)
Khi người dùng click chuột phải vào một Node (VD: `pipeline.py`), mở Context Menu:
* **Style:** Khung bo góc `12px`, nền `#0F1826`, **viền sáng màu xanh lá `#3CE38D`**.
* **Header:** Tên Node (`pipeline.py`) màu xám nhạt.
* **2 Nút hành động:**
  1. `[🎯 Tập trung (Focus)]`: Chữ và icon màu xanh lá `#3CE38D`. Khi bấm, gửi lệnh `FOCUS` xuống Backend để ưu tiên đưa file này và các Node lân cận bậc 1 vào ngữ cảnh của AI.
  2. `[👁️‍🗨️ Bỏ qua (Exclude)]`: Icon con mắt gạch chéo, chữ trắng xám. Khi bấm, gửi lệnh `EXCLUDE` xuống Backend, chuyển Node sang trạng thái `Bỏ qua` (màu xám mờ) và nối bằng đường nét đứt.

### 3.3. Tìm kiếm File trên Đồ thị (Search Overlay - `06 Tìm kiếm file.svg`)
Khi người dùng bấm vào nút Kính lúp `[🔍]` ở thanh công cụ góc trên phải của Đồ thị:
* Mở một khung Search Popover nằm ngay bên trái nút kính lúp.
* **Ô Input:** Có viền xanh lá `#3CE38D`, icon kính lúp bên trái, nội dung gõ tìm kiếm (VD: `pipeline`).
* **Danh sách Kết quả bên dưới:** Hiển thị các Node khớp tên kèm số lượng kết quả (VD: `[📄 pipeline.py · 1 kết quả]` với chữ màu xanh lá `#3CE38D`).
* **Hành vi:** Khi click vào kết quả hoặc nhấn Enter, camera của đồ thị tự động di chuyển (pan & zoom) đưa Node đó vào trung tâm và kích hoạt quầng sáng highlight.