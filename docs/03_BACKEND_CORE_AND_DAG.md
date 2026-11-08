# 03. ĐẶC TẢ BACKEND & DAG ENGINE
* **Universal Triage Router:** Phân loại lệnh thành Fast-Path (Chat đơn giản) hoặc DAG-Path (Chat + 3D).
* **DAGExecutor:** Hỗ trợ thực thi cây tác vụ phân cấp. Phải có khả năng bắn sự kiện `VisualOfficeEvent` thời gian thực chứa `active_task_code` (vd: "B1") qua IPC/WebSocket để Frontend vẽ huy hiệu lên đầu nhân vật 3D.
* **QuotaTracker:** Đọc file lịch sử SQLite/JSON nội bộ để tính ra chính xác % 5h và % Tuần đẩy lên bảng Giới hạn UI.
* **LocalMediaTools:** Viết wrapper cho `ffmpeg` để xử lý video/audio cục bộ.