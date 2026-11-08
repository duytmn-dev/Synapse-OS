# 01. TỔNG QUAN KIẾN TRÚC SYNAPSE OS

**Mục tiêu:** Xây dựng hệ điều hành đa tác tử (Multi-Agent OS) vạn năng, chi phí API $0, kết nối trực tiếp vào phiên đăng nhập của ChatGPT, Gemini, Codex, Claude. Hệ thống siêu nhẹ, phản hồi tức thì như một ứng dụng chat thông thường, nhưng có khả năng mở rộng xử lý đồ họa/lập trình phức tạp.

## 1. Cơ chế Hoạt động Lõi
* **5 Năng lực nguyên tử:** Sense, Creation, Reasoning, Live, Actuation.
* **4 Hình thái điều phối:** Direct Reflex, Brainstorm, Pipeline, DAG.
* **Định tuyến Plug & Play:** Quản lý qua `agent_registry.json`.

## 2. Kiến trúc Lõi Rỗng & Tải Lười (Hollow Core & Lazy-Loaded Tools) - [Áp dụng ngay]
Để Synapse OS duy trì dung lượng dưới 50MB, hệ thống KHÔNG gói kèm bất kỳ công cụ nặng nào (như FFmpeg, thư viện OpenCV, Python env cho Video 360).
* **Cơ chế hoạt động:** Khi người dùng gửi yêu cầu liên quan đến media/video, `UniversalTriageRouter` sẽ sinh ra một sub-task kiểm tra hệ thống (`CheckDependencies`). 
* Nếu thiếu, ứng dụng tự động kéo file nhị phân (binaries) của FFmpeg/thư viện cần thiết về lưu ẩn trong thư mục `.plugins/media-tools/` của người dùng cục bộ. Các lần sau gọi trực tiếp để xử lý tốc độ cao.

## 3. Cơ chế Tự Nâng cấp Bóng Ma (Blue-Green Self-Evolution) - [Dự kiến tương lai]
Nhằm đảm bảo Synapse OS có thể lấy chính nó để tự viết thêm tính năng sau này mà không bị rủi ro "sập nguồn" (Crash loop), hệ thống quy định:
* **Cấm sửa mã nguồn Production đang chạy.**
* Khi người dùng ra lệnh "Nâng cấp app", hệ thống phải tự clone mã nguồn ra thư mục `.workspace/synapse-os-dev/`.
* Mọi hành động gõ code, sửa lỗi, và chạy `npm test` đều thực hiện trên thư mục `dev`.
* Chỉ khi các bài Test hiển thị PASS 100%, hệ thống mới xuất thông báo yêu cầu người dùng khởi động lại ứng dụng từ bản build mới.