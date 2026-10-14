# Deployment runbook

Phạm vi: Cloudflare Pages (React/Vite), Northflank (Node/TypeScript), Azure SQL, Cloudinary và GitHub Actions. Đây là hướng dẫn staging/production; chưa cấu hình domain, credentials, provider thanh toán hoặc áp dụng SQL lên database đích.

## 1. Các giá trị phải quyết định trước khi tạo môi trường

| Quyết định | Giá trị cần chốt |
|---|---|
| SPA | Domain HTTPS chính thức, ví dụ `https://<spa-domain>` |
| API | Domain HTTPS chính thức, base URL kết thúc bằng `/api`, ví dụ `https://<api-domain>/api` |
| Cookie | `REFRESH_COOKIE_SAMESITE=lax` khi SPA/API cùng site; `none` khi khác site. Dùng domain tùy chỉnh cùng registrable domain nếu có thể. |
| Thanh toán | Chọn rõ `vnpay` (tiền thật) hoặc `simulated` (không thu tiền nhưng hệ thống vẫn ghi nhận đơn đã thanh toán). Không mặc định chọn `simulated` cho production. |
| Azure SQL | Tên database, principal runtime tối thiểu quyền, principal riêng để audit metadata, phương thức mạng/private endpoint hoặc egress IP cố định. |
| Dịch vụ ngoài | SMTP sender/credentials, Cloudinary account và VNPAY merchant/callback nếu đã quyết định dùng. |

Không dùng URL ví dụ hay `.invalid` từ CI trong Pages production. Không đặt secrets trong `VITE_*`; các biến Vite được đóng gói công khai vào JavaScript.

## 2. Cloudflare Pages — frontend

- Kết nối repository và đặt root directory/build context là `frontend`.
- Dùng Node.js 24 (`frontend/.nvmrc`); build command `npm ci && npm run build`; output directory `dist`.
- Khai báo `VITE_API_BASE_URL=https://<api-domain>/api` ở Pages production environment. Mỗi preview environment phải dùng API staging và database staging riêng.
- Build production sẽ dừng nếu thiếu API URL, URL không HTTPS, không kết thúc ở `/api`, hoặc chứa localhost/credentials/query/fragment.
- Giữ `frontend/public/_redirects` để các route SPA trả về `index.html` khi refresh hoặc mở deep link.
- Sau deploy, kiểm tra một deep link, tải lại trang, đăng nhập và refresh session trên browser thật.

## 3. Northflank — backend

- Tạo service từ cùng repository, build context/root directory `backend`, Node.js 24.
- Cài dependencies bằng `npm ci`; build bằng `npm run build`; start bằng `npm start` (`node dist/server.js`). Không chạy seed demo trong bước build/start.
- Mở HTTP container port `5000` (hoặc đặt `PORT` tương ứng). Server bind `0.0.0.0`.
- Cấu hình liveness probe `GET /api/health/live` và readiness probe `GET /api/health/ready`; readiness phải nhận HTTP 200 trước khi instance được đưa vào phục vụ. Liveness không phụ thuộc DB, readiness kiểm tra SQL với deadline hữu hạn.
- Set `TRUST_PROXY=true` khi chỉ nhận traffic qua Northflank ingress. Không để lộ đường truy cập trực tiếp bỏ qua ingress; rate limiting dùng IP do ingress forward.
- Dùng secret variables của Northflank, không commit giá trị secret. Cấu hình graceful shutdown timeout đủ để thoát request đang chạy (server đóng HTTP rồi ngắt Prisma pool, deadline 20 giây).

### Backend environment variables

| Biến | Production requirement |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Port backend service; mặc định `5000` |
| `DATABASE_URL` | Azure SQL connection string có `encrypt=true`, `trustServerCertificate=false`, `connectionTimeout` 1000–60000 ms, `socketTimeout` 1000–60000 ms, `poolTimeout` 1–60 giây, `connectionLimit` 1–50. Dùng principal runtime riêng. |
| `FRONTEND_URL` | HTTPS origin chính xác của SPA, không path/query |
| `CORS_ORIGIN` | HTTPS origin chính xác của SPA, không wildcard; có thể là danh sách exact origins nếu thật sự cần |
| `TRUST_PROXY` | `true` sau khi xác nhận traffic chỉ đi qua ingress tin cậy |
| `REFRESH_COOKIE_SAMESITE` | `lax` cùng site; `none` khác site. Cookie production luôn Secure và HttpOnly. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Hai secret ngẫu nhiên riêng biệt, tối thiểu 32 ký tự; không tái sử dụng secret development |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Thông tin account Cloudinary; API secret chỉ ở backend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Cấu hình đầy đủ để gửi email reset mật khẩu; `SMTP_FROM` phải là email hợp lệ |
| `PAYMENT_PROVIDER` | Phải chọn tường minh: `vnpay` hoặc `simulated`; đây là quyết định nghiệp vụ, không phải cấu hình kỹ thuật tự suy ra |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_REFUND_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL` | Bắt buộc nếu chọn `vnpay`; URL production HTTPS, endpoint thanh toán/hoàn tiền không phải sandbox, callback trỏ tới `/api/payments/vnpay-return` và `/api/payments/vnpay-ipn` trên API domain |
| `PAYMENT_TIMEOUT_MINUTES` | Mặc định 15; xác nhận với quy tắc nghiệp vụ trước khi thay đổi |

## 4. Azure SQL

1. Tạo database và thiết lập backup/restore point trước mọi thay đổi schema. Cấp runtime principal chỉ các quyền ứng dụng cần; dùng principal riêng có `VIEW DEFINITION` để kiểm tra schema.
2. Cho phép kết nối từ private network hoặc egress IP cố định đã xác nhận của service. Không mở firewall rộng bằng tùy chọn “Allow Azure services”.
3. Repository dùng SQL-first migrations 001–008; không dùng `prisma migrate deploy`. `database/migrations/create_database.sql` chỉ dành cho SQL Server local.
4. Chỉ khi database đích đã được định danh là test/staging và có phê duyệt change tương ứng: trên database rỗng chạy migrations 001–008 theo thứ tự, seed `database/seed/001_roles.sql` nếu cần, rồi chạy verifier. Không chạy seed demo trong production.
5. Để chỉ audit database test/staging hiện có, chạy `database/scripts/verify-staging.ps1` theo `database/README.md`. Script yêu cầu xác nhận đúng tên database, nhập password dạng secure prompt, dùng TLS có xác thực chứng chỉ và dừng ở lỗi đầu tiên. `test-constraints.sql` rollback dữ liệu kiểm thử.
6. Ghi nhận log kết quả `verify-schema.sql` và `test-constraints.sql` cùng commit release. Không xem `prisma validate` là bằng chứng schema live khớp.

## 5. Domain, CORS và refresh cookie

Ưu tiên custom domains cùng site, ví dụ `app.<domain>` và `api.<domain>`, để dùng `REFRESH_COOKIE_SAMESITE=lax`. Vẫn cần `CORS_ORIGIN` chính xác và frontend gọi API bằng HTTPS. Nếu dùng hai site khác nhau, cấu hình `REFRESH_COOKIE_SAMESITE=none`, `Secure`, credentialed CORS với origin SPA chính xác và xác minh luồng cookie trên browser mục tiêu; chính sách third-party cookie của browser có thể ảnh hưởng.

## 6. GitHub Actions và release gate

Workflow `.github/workflows/ci.yml` hiện chạy backend/frontend lint, typecheck, build, Prisma generate/validate, unit tests và `npm audit --audit-level=high` cho cả backend/frontend/E2E lockfiles. Frontend CI build dùng URL thử nghiệm và kiểm tra artifact không chứa API localhost. E2E browser và SQL verifier chưa tự chạy trong CI vì cần SQL Server test được cô lập; chạy trước release theo mục 7.

Chỉ promote artifact sau khi CI xanh, backend/frontend build cùng commit, database verifier và browser E2E trên test/staging đều đạt, cấu hình cookie/CORS được smoke test, và lựa chọn payment/refund đã được chủ nghiệp vụ xác nhận.

## 7. Staging smoke/E2E

- Dùng một SQL Server database test riêng có thể seed/cleanup; Playwright fixture tạo và xóa rows. Không trỏ E2E vào production hay database dùng chung.
- Chạy `npm ci` trong `backend`, `frontend`, `e2e`; cài Chrome theo cấu hình Playwright (`npx playwright install chrome`) trong môi trường runner.
- Xác nhận `backend/.env` trỏ đúng `HotelBooking_DB0_Test` hoặc database test đã được phê duyệt, rồi từ `e2e` chạy `npm test`.
- Kiểm tra liveness/readiness, đăng nhập → tải lại/refresh session → đăng xuất, tìm phòng/quote, tạo booking, thanh toán mô phỏng và hủy/refund mô phỏng. Xác minh tồn kho, promotion, quyền customer/owner/admin và callback idempotency.
- Chỉ kiểm tra VNPAY sandbox/live với merchant credentials được cấp cho đúng môi trường và người phụ trách nghiệp vụ. Không dùng giao dịch thật nếu chưa có phê duyệt riêng.

## 8. Rollback

- Giữ deployment frontend/API trước đó để khôi phục nhanh và ghi lại image/commit SHA đã chạy.
- Rollback ứng dụng bằng artifact/image trước đó; theo dõi `/api/health/ready`, lỗi 5xx, đăng nhập và callback thanh toán.
- Không rollback schema bằng cách chạy ngược migration tự động. Nếu release có thay đổi schema, phải có kế hoạch tương thích hai phiên bản, backup/restore point và phê duyệt database riêng trước khi áp dụng.

## Tài liệu nền tảng

- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [build image](https://developers.cloudflare.com/pages/configuration/build-image/), [redirects](https://developers.cloudflare.com/pages/configuration/redirects/)
- [Northflank buildpacks](https://northflank.com/docs/v1/application/build/build-with-buildpacks), [health checks](https://northflank.com/docs/v1/application/observe/configure-health-checks), [networking](https://northflank.com/docs/v1/application/network/networking-on-northflank), [egress IPs](https://northflank.com/docs/v1/application/network/configure-egress-ips)
- [Azure SQL firewall](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure), [Azure SQL Node.js connection example](https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart)
- [Browser third-party cookie behavior](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/third-party_cookies)
