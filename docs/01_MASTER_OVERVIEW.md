# 01. TỔNG QUAN KIẾN TRÚC AGENT HQ
Mục tiêu: Xây dựng hệ điều hành đa tác tử (Multi-Agent OS) vạn năng, chi phí API $0, kết nối trực tiếp vào phiên đăng nhập của ChatGPT, Gemini, Codex, Claude.

* **Cơ chế hoạt động:** 5 Năng lực nguyên tử (Sense, Creation, Reasoning, Live, Actuation) và 4 Hình thái điều phối (Direct Reflex, Brainstorm, Pipeline, DAG).
* **Định tuyến cắm và chạy:** Quản lý qua `agent_registry.json`. (Argon sẽ được cấu hình vào file này sau khi app hoàn thiện để chuyên trị các toán thuật toán hạng nặng, không dùng Argon để code app).