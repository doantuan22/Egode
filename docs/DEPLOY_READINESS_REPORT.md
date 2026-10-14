# Báo cáo readiness trước deploy

**Ngày kiểm tra:** 2026-10-15 (Asia/Bangkok)  
**Phán quyết:** **NOT READY**

## Lý do

Các kiểm tra code, build và luồng tích hợp cục bộ đạt yêu cầu, nhưng chưa đủ bằng chứng để xác nhận một môi trường staging hoặc production cụ thể sẵn sàng. Bộ xác minh schema/constraint chưa kết nối được SQL Server do lỗi TLS của ODBC Driver 18 trên máy kiểm tra. Chưa có cấu hình domain, secrets và quyết định payment provider của môi trường đích để đối chiếu; các dịch vụ ngoài như VNPAY, SMTP và Cloudinary cũng chưa được smoke test trực tiếp. Vì vậy chưa thể xác nhận database thực tế, cấu hình ingress/cookie/CORS hay giao dịch ngoài hệ thống.

## Hạng mục đã khắc phục

- Frontend production yêu cầu `VITE_API_BASE_URL` là HTTPS, trỏ đúng hậu tố `/api`, và từ chối URL local, credentials, query hoặc fragment. Build fail-fast khi thiếu URL; CI quét bundle production để phát hiện URL API local và tên khóa bí mật.
- Backend tách liveness và readiness; readiness kiểm tra database với timeout hữu hạn và trả trạng thái không sẵn sàng khi DB lỗi. Lỗi DB công khai đã được làm sạch.
- Cấu hình production fail-fast cho HTTPS origins/payment endpoints, proxy, TLS và timeout SQL, secrets JWT riêng, payment provider và chính sách SameSite.
- Thêm shutdown có drain HTTP, đóng Prisma pool và deadline; log lỗi production không ghi nội dung exception nhạy cảm.
- Củng cố SQL verifier cho index/procedure mong đợi và script kiểm tra constraint có rollback, mã lỗi khác 0 khi assertion thất bại. Thêm PowerShell verifier chỉ nhận DB `test` hoặc `staging`, yêu cầu xác nhận tên DB, TLS và xác thực chứng thư.
- Cập nhật E2E theo hành vi hiện tại của ứng dụng và đóng browser contexts phụ sau test.
- Thêm runbook cho cấu hình Cloudflare Pages, Northflank, Azure SQL, Cloudinary, GitHub Actions, staging, rollback và giới hạn thanh toán tại [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md).

Không thay đổi migration/schema và không chạy migration. Không deploy hoặc thực hiện giao dịch thanh toán thật.

## Kết quả kiểm tra

| Hạng mục | Kết quả |
|---|---|
| Backend unit/integration | Đạt: 69 files, 858/858 tests |
| Frontend unit/component | Đạt: 84 files, 591/591 tests |
| E2E với frontend/backend và SQL test cục bộ | Đạt: 34/34; payment dùng chế độ simulated |
| Lint, typecheck, Prisma schema validation, backend build | Đạt |
| Frontend production build và kiểm tra bundle/config | Đạt; dùng URL CI giả lập, không phải domain đích |
| `git diff --check` | Đạt; Git có cảnh báo chuẩn hóa LF sang CRLF ở một số file |
| npm audit online | Chưa xác minh: registry không truy cập được trong sandbox |
| npm audit offline | Backend/frontend/E2E không thấy lỗ hổng trong dữ liệu cache; dữ liệu cache không đảm bảo cập nhật |
| E2E package install audit | `npm ci` được chạy sau khi quyền mạng được duyệt; 0 lỗ hổng trong các package của E2E lockfile |
| SQL schema/constraint trên DB mục tiêu | Bị chặn trước khi chạy SQL: ODBC Driver 18 báo không hỗ trợ encryption client / không có credentials cho SSL provider; không tắt xác thực chứng thư để vượt qua lỗi |

## Cổng cần đóng trước khi deploy

1. Cài hoặc sửa ODBC driver/TLS client trên máy chạy audit; sau đó chạy `database/scripts/verify-staging.ps1` với đúng database `test` hoặc `staging` và xác nhận kết quả schema/constraint. Chưa có bằng chứng kiểm tra trên Azure SQL staging.
2. Điền và rà soát các giá trị môi trường đích: domain frontend/API, origins CORS, proxy ingress, cookie `SameSite`/`Secure`, Azure SQL TLS/timeout, JWT secrets riêng, Cloudinary credentials và payment provider. Chạy lại production build với domain staging thực tế.
3. Chạy smoke test staging với các dịch vụ ngoài dự kiến sử dụng. Xác nhận payment provider; chế độ `simulated` chỉ ghi nhận trạng thái trong ứng dụng, không thu tiền. Không bật giao dịch thật trước khi hoàn tất xác nhận nghiệp vụ và cấu hình provider.
4. Chạy lại dependency audit online trên CI có quyền tới npm registry và xử lý kết quả mới nhất.

## Rủi ro còn lại cần chấp nhận hoặc xử lý

- Rate limiter hiện lưu trong bộ nhớ từng process; khi scale ngang, giới hạn không được chia sẻ giữa các instance.
- Logout không thu hồi refresh token phía server; token còn hiệu lực đến khi hết hạn (tối đa 7 ngày theo cấu hình hiện tại), trừ khi tài khoản/mật khẩu thay đổi.
- Nếu process dừng giữa quy trình hoàn tiền, bản ghi có thể giữ trạng thái `processing`; cần đối soát và xử lý thủ công.
- Chưa có smoke test cho VNPAY, SMTP hoặc Cloudinary trực tiếp trên staging.

## Phạm vi dữ liệu và tài liệu

E2E dùng database cục bộ chuyên dụng `HotelBooking_DB0_Test` và payment simulated. Không kết nối hoặc ghi vào production. Không chạy migration. Báo cáo audit cũ [PRE_DEPLOY_AUDIT_2026-10-14.md](PRE_DEPLOY_AUDIT_2026-10-14.md) được giữ nguyên.
