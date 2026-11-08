# 03. ĐẶC TẢ BACKEND & DAG ENGINE (SYNAPSE OS)

* **Universal Triage Router:** Phân loại lệnh thành Fast-Path (Chat) hoặc DAG-Path (Chat + 3D).
* **DAGExecutor:** Thực thi cây tác vụ phân cấp. Bắn sự kiện `VisualOfficeEvent` thời gian thực (chứa `active_task_code`) qua IPC/WebSocket để Frontend vẽ huy hiệu lên đầu nhân vật 3D.
* **QuotaTracker:** Tính toán % 5h và % Tuần đẩy lên bảng Giới hạn UI.
* **LocalMediaTools (Quản lý Thư viện Động):**
  * Chịu trách nhiệm xử lý các tác vụ đa phương tiện (Video 360, Audio).
  * **Bắt buộc triển khai hàm `ensureToolDependencies()`:** Hàm này kiểm tra xem thư mục cục bộ `.plugins/ffmpeg` đã có file thực thi chưa. Nếu chưa có, tự động tải xuống qua HTTP tĩnh hoặc npm binaries ẩn trước khi chạy luồng cắt ghép video. Đảm bảo ứng dụng chính không bị phình to.