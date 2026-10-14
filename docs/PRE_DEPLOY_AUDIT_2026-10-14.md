# Báo cáo audit trước deploy

**Ngày:** 14/10/2026  
**Phạm vi:** database/Prisma, logic đặt phòng và thanh toán, backend, frontend, cấu hình chạy và CI.  
**Kết luận:** **Chưa nên deploy artifact hiện tại.** Có một lỗi cấu hình frontend đã xác nhận, health check có thể báo khỏe giả khi database lỗi, và chưa xác minh được schema/dữ liệu trên database đích.

## Các mục cần xử lý trước deploy

### P1 — Frontend build hiện tại gọi API ở localhost

`frontend/.env` đang có `VITE_API_BASE_URL` trỏ tới localhost. Sau `npm run build`, bundle trong `frontend/dist` vẫn chứa origin này. Khi người dùng mở website đã deploy, trình duyệt sẽ gọi API trên máy của chính người dùng; artifact này không dùng được với API production.

**Cần làm:** build lại với `VITE_API_BASE_URL` là API origin thật, hoặc để biến trống nếu frontend và API cùng origin sau reverse proxy `/api`. Xác nhận bundle phát hành không chứa localhost.

### P1 — Health check không phản ánh lỗi database

`GET /api/health?db=true` có gọi kiểm tra DB, nhưng `HealthService` luôn đặt `status: 'ok'`, kể cả khi repository trả `connected: false`. Controller gửi payload thành công với HTTP 200. Orchestrator có thể tiếp tục gửi traffic vào instance không truy cập được database. `HealthRepository` còn đưa nguyên `error.message` vào phản hồi health công khai.

**Cần làm:** tính `status` theo kết quả DB cho readiness check, trả trạng thái HTTP phù hợp khi degraded/unavailable, và chỉ trả chi tiết lỗi chung cho client; giữ thông tin kỹ thuật trong log nội bộ đã lọc bí mật.

### P1 — Chưa xác nhận được database đích

Đã thử chạy `database/scripts/verify-schema.sql` trên cấu hình SQL Server cục bộ. `sqlcmd` dừng ở bước thiết lập TLS/mã hóa và không trả kết quả kiểm tra schema; do đó `test-constraints.sql` và E2E cần SQL Server đã không chạy. Không có kết luận về schema hoặc dữ liệu thực tế của database đích.

**Cần làm:** dùng kết nối SQL Server phù hợp với driver/môi trường, rồi chạy kiểm tra schema và constraints trên database staging/test đã xác nhận. Chạy E2E trên đúng database test riêng trước khi duyệt phát hành. Không suy rộng kết quả Prisma validation thành xác nhận schema live.

### P1 — Chưa có cấu hình production để đối chiếu

Các `.env` đang đọc là môi trường development; domain production/topology chưa được cung cấp. Backend yêu cầu production chọn tường minh `PAYMENT_PROVIDER` và `REFRESH_COOKIE_SAMESITE`; đồng thời buộc DB dùng `encrypt=true`, frontend/CORS dùng HTTPS, và yêu cầu đủ secret cho dịch vụ được bật. Những quy tắc này được kiểm tra lúc khởi động backend, nhưng cấu hình triển khai thực tế chưa được kiểm chứng.

**Cần làm:** xác nhận cấu hình trên secret manager của môi trường đích: domain SPA/API, CORS, SameSite cookie, API base URL, payment mode/endpoint, SMTP, Cloudinary và kết nối DB mã hóa. Chạy smoke test đăng nhập, refresh sau reload, đổi mật khẩu, thanh toán/hoàn tiền theo mode đã chọn.

## Kết quả kiểm tra

| Khu vực | Kết quả |
|---|---|
| Backend unit tests | 68 file, **845/845 pass** khi chạy độc lập. Lượt chạy đồng thời ban đầu có 3 timeout; file lỗi chạy riêng 12/12 pass, sau đó toàn suite chạy lại độc lập và pass. |
| Backend lint | Exit 0; 1 warning: import `sendPaginated` không dùng trong `owner-reviews.controller.ts`. |
| Backend typecheck/build | Pass. |
| Prisma schema validation | Pass; xác nhận schema Prisma hợp lệ, không xác nhận database live. |
| Node runtime | Node 24.21.0; `.nvmrc` và CI đều chọn Node 24. |
| Frontend unit tests | 83 file, **583/583 pass**; có React `act(...)` warnings trong test DateRangePicker và NavigationEffects. |
| Frontend lint/typecheck/build | Pass. Build thành công nhưng artifact dùng API localhost như mô tả ở trên. |
| SQL schema/constraints | Chưa chạy được trên SQL Server; chưa xác nhận live schema/data. |
| Browser E2E | Chưa chạy vì chưa thực hiện được kiểm tra kết nối/schema database. |
| Dependency audit | `npm audit --offline --audit-level=high` báo 0 lỗ hổng trong backend, frontend và E2E lockfiles; advisory cache offline chưa được đối chiếu độ mới với registry. |
| Secrets trong Git | `backend/.env` và `frontend/.env` được `.gitignore` loại trừ. Không đưa giá trị bí mật vào báo cáo. |

## Rủi ro vận hành cần chấp nhận hoặc xử lý

- Workflow CI hiện chỉ lint/typecheck/build/unit test frontend và backend; không có job E2E hoặc SQL schema/constraint gate.
- Rate limiter lưu trong bộ nhớ từng tiến trình; khi chạy nhiều instance, giới hạn bị tách theo instance và không phải quota dùng chung.
- SIGTERM chỉ đóng HTTP server, chưa gọi `disconnectPrisma()` để đóng connection pool tường minh.
- Refund đang ở trạng thái “đang xử lý” có thể cần can thiệp thủ công nếu tiến trình chết giữa lúc ghi nhận và chốt kết quả; cần quy trình đối soát nếu bật thu tiền thật.
- Unit tests kiểm tra VNPAY/SMTP/Cloudinary qua giả lập; chưa có smoke test với tài khoản dịch vụ production.

## Các gate đã chạy

Các lệnh dùng `npm.cmd` do PowerShell chặn `npm.ps1` theo execution policy. Không thay đổi policy hệ thống. Backend build cập nhật line ending của Prisma generated client; các file đó đã được đưa về line ending làm việc chuẩn, và trạng thái mã nguồn còn sạch trước khi thêm báo cáo audit này.
