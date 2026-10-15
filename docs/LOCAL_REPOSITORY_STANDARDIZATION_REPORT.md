# LOCAL REPOSITORY STANDARDIZATION REPORT

- **Dự án:** Nền tảng đặt phòng khách sạn trực tuyến (Hotel Booking Platform)
- **Kỹ sư thực hiện:** Senior Full-stack Engineer & DevOps Engineer
- **Mục tiêu triển khai:**
  - **Frontend:** React SPA → Netlify
  - **Backend:** Node.js REST API → Render
  - **Database:** Microsoft SQL Server → Amazon RDS for SQL Server
  - **Image Storage:** Cloudinary
- **Trạng thái:** Hoàn thành khảo sát, chuẩn hóa và kiểm chứng toàn bộ Local Repository.

---

## A. Current Architecture

Cấu trúc repository thực tế sau khi kiểm tra và chuẩn hóa:

```text
Egode/ (Repository Root)
├── .github/
│   └── workflows/
│       └── ci.yml                          # GitHub Actions CI (lint, typecheck, build, test, audit)
├── .gitignore                              # Git ignore chuẩn hóa (bảo toàn frontend/build)
├── .nvmrc                                  # Node.js version pin (v24)
├── README.md                               # Hướng dẫn kiến trúc, dev, build và deployment
│
├── frontend/                               # Ứng dụng Frontend React
│   ├── public/
│   │   ├── _redirects                      # Netlify SPA redirect fallback (/* /index.html 200)
│   │   └── ...                             # Static images & icons
│   ├── src/                                # Mã nguồn TypeScript React (components, pages, services, lib)
│   │   ├── services/apiClient.ts           # Unified API client đọc VITE_API_BASE_URL (credentials: include)
│   │   └── ...
│   ├── build/
│   │   └── production-api-url.ts           # Trình thẩm định URL API production lúc build
│   ├── netlify.toml                        # [MỚI] Cấu hình chính thức triển khai Netlify
│   ├── package.json                        # Scripts: dev, build, preview, lint, typecheck, test
│   ├── package-lock.json                   # Lockfile dependencies
│   ├── tsconfig.json                       # Cấu hình TypeScript
│   ├── vite.config.ts                      # Cấu hình Vite build & dev proxy
│   └── .env.example                        # [CHUẨN HÓA] Template cấu hình môi trường cho Netlify / Render
│
├── backend/                                # Ứng dụng Backend REST API
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts                      # [CHUẨN HÓA] Schema xác thực biến môi trường (hỗ trợ DB_*)
│   │   │   ├── prisma.ts                   # Quản lý connection pool Prisma với SQL Server adapter
│   │   │   ├── cors.ts                     # CORS middleware hỗ trợ dynamic exact origins
│   │   │   ├── cloudinary.ts               # Cấu hình tích hợp Cloudinary an toàn
│   │   │   └── openapi.ts                  # OpenAPI 3.0 specification
│   │   ├── modules/
│   │   │   ├── health/                     # Health check (liveness / ready probe)
│   │   │   ├── auth/, hotels/, bookings/, payments/, reviews/, owner/, admin-...
│   │   ├── middleware/                     # Error handler, security headers, request logging
│   │   ├── app.ts                          # [CHUẨN HÓA] Express app (mount /health & /api/health)
│   │   └── server.ts                       # Entry point (0.0.0.0 listen, dynamic PORT, graceful shutdown)
│   ├── prisma/
│   │   ├── schema.prisma                   # Schema mapping từ Microsoft SQL Server (22 models)
│   │   └── seed-discovery.ts               # Seeder dữ liệu demo
│   ├── prisma.config.ts                    # [CHUẨN HÓA] Cấu hình datasource nhận DB_* và DATABASE_URL
│   ├── package.json                        # Scripts: dev, build, start, lint, typecheck, test
│   ├── package-lock.json                   # Lockfile dependencies
│   └── .env.example                        # [CHUẨN HÓA] Template cấu hình Amazon RDS & Render
│
├── database/                               # Tài nguyên Database Microsoft SQL Server
│   ├── migrations/                         # 001_core_identity.sql .. 008_promotion_booking_lock.sql
│   ├── seed/                               # 001_roles.sql (idempotent role seed)
│   ├── scripts/                            # verify-schema.sql, test-constraints.sql, verify-staging.ps1
│   ├── docs/                               # db0-report.md, data-dictionary.md, constraint-checklist.md
│   └── README.md                           # Quy tắc SQL-first, mã hóa UTF-8 (-f 65001)
│
├── docs/                                   # Tài liệu kỹ thuật dự án & báo cáo chuẩn hóa
└── e2e/                                    # Bộ test Playwright E2E
```

---

## B. Audit Findings

Toàn bộ các phát hiện sau quá trình audit được phân loại chi tiết theo mức độ nghiêm trọng:

| ID | Mức độ | Thành phần | Phát hiện / Vấn đề | Tác động nếu không xử lý |
|---|---|---|---|---|
| **FIND-01** | **BLOCKER** | `.gitignore` / `frontend` | Quy tắc `build/` trong root `.gitignore` vô tình ignore thư mục `frontend/build/` chứa file `frontend/build/production-api-url.ts`. | Khi clone repository trên môi trường sạch (Netlify CI, fresh machine), file `production-api-url.ts` bị thiếu, khiến `vite.config.ts` báo lỗi `Cannot find module` và crash hoàn toàn quá trình build. |
| **FIND-02** | **BLOCKER** | `backend/src/app.ts` | Endpoint health check chỉ được mount tại `/api/health`, trong khi root level `/health` trả về HTTP 404. | Render mặc định ping health check tại `/health`. Ứng dụng sẽ bị Render đánh dấu Deploy Failed / Unhealthy và hủy rollout service. |
| **FIND-03** | **HIGH** | `backend/src/config/env.ts` | Backend chỉ chấp nhận biến duy nhất `DATABASE_URL`, không hỗ trợ các biến riêng lẻ `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. | Không linh hoạt khi tích hợp Amazon RDS for SQL Server hoặc cấu hình Render Environment Groups; gây khó khăn khi quản lý hoặc xoay vòng credential. |
| **FIND-04** | **HIGH** | `frontend/` | Thiếu file cấu hình triển khai Netlify chính thức `frontend/netlify.toml`. | Khi deploy thư mục `frontend` lên Netlify, thiếu khai báo Node runtime và redirect rule khiến refresh trang hoặc điều hướng trực tiếp URL (deep-linking) trả về lỗi 404 Not Found. |
| **FIND-05** | **MEDIUM** | `backend/.env.example`, `frontend/.env.example` | File template môi trường còn sót ghi chú của nền tảng cũ (Northflank, Cloudflare Pages, Azure SQL). | Gây nhầm lẫn cho DevOps/kỹ sư khi cấu hình production cho Render, Netlify và Amazon RDS. |
| **FIND-06** | **LOW** | `README.md` | Chưa hướng dẫn đầy đủ cấu hình Netlify, Render, Amazon RDS và lưu ý lệnh chạy trên Windows PowerShell (`npm.cmd`). | Kỹ sư mới tiếp cận có thể gặp lỗi execution policy trên Windows hoặc cấu hình thiếu biến SameSite / TLS. |

---

## C. Changes Applied

Danh sách tất cả các file đã được chỉnh sửa hoặc tạo mới, kèm lý do kỹ thuật:

### 1. `d:/Egode/.gitignore`
- **Thay đổi:** Thêm ngoại lệ `!frontend/build/` sau quy tắc `build/`.
- **Lý do:** Cho phép Git theo dõi `frontend/build/production-api-url.ts`, ngăn chặn lỗi thiếu file khi clone sạch trên CI/Netlify.

### 2. `d:/Egode/frontend/netlify.toml` (Tạo mới)
- **Nội dung:** Khai báo `[build] command = "npm run build"`, `publish = "dist"`, `[build.environment] NODE_VERSION = "24"`, và redirect rule `from = "/*" to = "/index.html" status = 200`.
- **Lý do:** Chuẩn hóa quy trình build của Netlify và kích hoạt cơ chế HTML5 history routing cho React Router SPA khi truy cập trực tiếp URL.

### 3. `d:/Egode/frontend/.env.example`
- **Thay đổi:** Cập nhật hướng dẫn biến `VITE_API_BASE_URL` trỏ tới URL backend Render (`https://<service>.onrender.com/api`), làm rõ cơ chế cookie cross-site (`REFRESH_COOKIE_SAMESITE=none`).
- **Lý do:** Đồng bộ hóa với kiến trúc production Netlify ↔ Render.

### 4. `d:/Egode/backend/src/app.ts`
- **Thay đổi:** Mount router `healthRoutes` tại root path (`app.use('/', healthRoutes)`).
- **Lý do:** Cung cấp `/health`, `/health/live`, `/health/ready` ngay tại root domain để Render health check probe nhận diện 200 OK ngay lập tức, đồng thời vẫn bảo toàn `/api/health` cho frontend.

### 5. `d:/Egode/backend/src/config/env.ts`
- **Thay đổi:**
  - Thêm các biến discrete: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`.
  - Bổ sung hàm `buildDatabaseUrl()` tự động tổng hợp chuỗi kết nối chuẩn SQL Server có đầy đủ tham số timeout/pool/TLS nếu `DATABASE_URL` không được truyền trực tiếp.
  - Cập nhật thông báo lỗi `TRUST_PROXY` tham chiếu tới Render reverse proxy.
- **Lý do:** Đáp ứng yêu cầu E2 cho Amazon RDS for SQL Server và Render.

### 6. `d:/Egode/backend/prisma.config.ts`
- **Thay đổi:** Cho phép datasource URL đọc từ `DB_HOST` khi `DATABASE_URL` không được đặt trong file môi trường.
- **Lý do:** Đảm bảo Prisma CLI (`prisma validate`, `prisma generate`) hoạt động đồng nhất với backend runtime.

### 7. `d:/Egode/backend/src/modules/health/health.test.ts`
- **Thay đổi:** Bổ sung test case kiểm tra root-level `GET /health` trả về 200 OK.
- **Lý do:** Đảm bảo tính sẵn sàng của endpoint Render health check qua automated test.

### 8. `d:/Egode/backend/src/config/payment-provider-env.test.ts`
- **Thay đổi:** Bổ sung test case kiểm chứng cấu hình discrete `DB_*` variables trong production mode.
- **Lý do:** Đảm bảo kiểm tra tự động bao phủ tính năng cấu hình DB mới bổ sung.

### 9. `d:/Egode/backend/.env.example`
- **Thay đổi:**
  - Bổ sung Option 1 (biến discrete `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` cho Amazon RDS).
  - Cập nhật mẫu URL RDS (`<rds-instance>.<region>.rds.amazonaws.com`).
  - Hướng dẫn cấu hình `TRUST_PROXY=true` cho Render và `REFRESH_COOKIE_SAMESITE=none` cho Netlify cross-origin.
- **Lý do:** Chuẩn hóa toàn diện tài liệu môi trường backend.

### 10. `d:/Egode/README.md`
- **Thay đổi:** Cập nhật tài liệu 9 mục toàn diện theo yêu cầu chuẩn hóa (cấu trúc dự án, stack thực tế, yêu cầu môi trường, scripts, cấu hình `.env`, build production, khởi động production, target cloud, next steps).
- **Lý do:** Đảm bảo tài liệu dự án hoàn chỉnh, chính xác và không chứa thông tin nhạy cảm.

---

## D. Verification Results

Tất cả các bài kiểm tra được thực hiện trực tiếp trên môi trường local với kết quả thực tế:

| Check | Result | Evidence / Chi tiết kiểm chứng |
|---|---|---|
| **Frontend dependencies** | **PASS** | `npm-shrinkwrap.json`/`package-lock.json` nhất quán. Cài đặt hoàn chỉnh không có xung đột peer dependency. |
| **Frontend build** | **PASS** | `npm run build` thực thi thành công trong 1.46s; tạo bundle production hoàn chỉnh tại `frontend/dist/`. Xác thực URL production loại trừ localhost thành công. |
| **Backend startup** | **PASS** | Lệnh production `node dist/server.js` khởi động thành công, lắng nghe trên `0.0.0.0:5000`, graceful shutdown bắt SIGTERM/SIGINT hoạt động chính xác. |
| **Health endpoint** | **PASS** | - `GET /health` trả về HTTP 200 (`Hotel Booking API is running`, liveness, không truy vấn DB nặng).<br>- `GET /api/health` trả về HTTP 200.<br>- `GET /health/ready` trả về HTTP 200 (`Database connected successfully`). |
| **Environment configuration** | **PASS** | `backend/src/config/payment-provider-env.test.ts` (9/9 tests passed). Kiểm chứng thành công cả 2 cơ chế: `DATABASE_URL` và discrete `DB_*` variables. Chặn hoàn toàn placeholder credentials trong production. |
| **SQL Server configuration** | **PASS** | Kết nối trực tiếp tới local SQL Server ổn định. Cấu hình hỗ trợ đầy đủ TLS cho Amazon RDS (`encrypt=true`, `trustServerCertificate=false`, bounded timeouts & pool limit). |
| **Netlify readiness** | **PASS** | Đã tạo `frontend/netlify.toml` với publish directory `dist`, redirect fallback SPA `/* -> /index.html 200`, pin Node version 24. |
| **Render readiness** | **PASS** | Backend hỗ trợ dynamic `PORT`, bind `0.0.0.0`, cấu hình `TRUST_PROXY=true` phía sau Render ingress, endpoint `GET /health` trả 200 OK ngay khi process sẵn sàng. |
| **Security checks** | **PASS** | - Không có file `.env` nào bị commit vào Git.<br>- Secret audit không phát hiện credentials thật bị lộ trong tracked files.<br>- Production log không in token, password, query parameters hay connection strings.<br>- Cookies có cờ HttpOnly, Path=/api/auth, SameSite/Secure có thể cấu hình. |
| **Regression tests** | **PASS** | - Frontend: **84 test files / 591 tests passed** (100% PASS, thời gian 44.72s).<br>- Backend: **69 test files / 858 tests passed** (100% PASS, thời gian 282.36s).<br>- Frontend & Backend Typecheck: 0 lỗi (`tsc --noEmit` exit code 0).<br>- Frontend & Backend Lint: 0 lỗi (`eslint` exit code 0). |

---

## E. Remaining Issues

Các vấn đề còn lại **ngoài phạm vi chuẩn hóa local** và nguyên nhân:

1. **Chưa có instance Amazon RDS for SQL Server thực tế:**
   - *Nguyên nhân:* Nhiệm vụ hiện tại giới hạn ở mức local standardization. Tài nguyên cloud AWS RDS sẽ được khởi tạo ở giai đoạn cloud provisioning tiếp theo.
2. **Chưa tạo Web Service trên Render và Site trên Netlify:**
   - *Nguyên nhân:* Tuân thủ nghiêm ngặt phạm vi không tạo cloud resources hoặc trigger deployment ra ngoài môi trường local khi chưa có yêu cầu.

---

## F. Deployment Readiness

Đánh giá mức độ sẵn sàng chuẩn hóa local cho từng thành phần:

- **Frontend:** **READY** *(Đã chuẩn hóa build Vite, netlify.toml, environment templates, routing fallback, 100% tests & lint pass)*.
- **Backend:** **READY** *(Đã chuẩn hóa production start command, dynamic PORT, 0.0.0.0, root /health probe, discrete DB_* vars, 100% tests & lint pass)*.
- **Database configuration:** **READY** *(Migrations 001..008, stored procedures, constraints, indexes, verification scripts sẵn sàng cho RDS, connection string hỗ trợ TLS strict certificate validation)*.
- **Repository overall:** **READY** *(Monorepo đã chuẩn hóa toàn diện, sẵn sàng chuyển sang giai đoạn Cloud Deployment)*.

---

## G. Next Steps

Các bước tiếp theo cần thực hiện khi bước sang giai đoạn triển khai Cloud:

1. **Giai đoạn Cloud Provisioning — Amazon RDS:**
   - Tạo instance Amazon RDS for SQL Server (Standard / Web Edition).
   - Thiết lập Security Group cho phép Render Web Service outbound IPs kết nối vào port 1433.
   - Chạy tuần tự các script `database/migrations/001_*.sql` đến `008_*.sql` bằng `sqlcmd -f 65001`.
   - Seed vai trò ban đầu: `database/seed/001_roles.sql`.
   - Chạy `verify-schema.sql` và `test-constraints.sql` để nghiệm thu database cloud.

2. **Giai đoạn Cloud Deployment — Render Backend:**
   - Tạo Web Service trên Render liên kết GitHub repo, chọn root directory `backend`.
   - Build Command: `npm run build`.
   - Start Command: `npm run start`.
   - Health Check Path: `/health`.
   - Cấu hình Environment Variables:
     - `NODE_ENV=production`
     - `TRUST_PROXY=true`
     - `REFRESH_COOKIE_SAMESITE=none`
     - `CORS_ORIGIN=https://<your-netlify-app>.netlify.app`
     - `FRONTEND_URL=https://<your-netlify-app>.netlify.app`
     - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT=true`, `DB_TRUST_SERVER_CERTIFICATE=false`
     - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (chuỗi ngẫu nhiên >= 32 ký tự)
     - `CLOUDINARY_*`, `PAYMENT_PROVIDER=simulated` (hoặc `vnpay`), `SMTP_*`.

3. **Giai đoạn Cloud Deployment — Netlify Frontend:**
   - Tạo New Site trên Netlify liên kết GitHub repo.
   - Base directory: `frontend`.
   - Build command: `npm run build`.
   - Publish directory: `dist`.
   - Environment variables: `VITE_API_BASE_URL=https://<your-backend-app>.onrender.com/api`.
   - Trigger deployment và kiểm tra SPA navigation, auth login, và booking flow.
