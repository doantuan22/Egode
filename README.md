# Hotel Booking Platform

Nền tảng đặt phòng khách sạn trực tuyến (Monorepo).

## 1. Cấu trúc dự án (Project Structure)

Repository được tổ chức theo mô hình Monorepo gồm các thành phần độc lập:

```text
Egode/
├── frontend/                     # React + Vite SPA (TypeScript)
│   ├── public/                   # Static assets & _redirects
│   ├── src/                      # Source code React (components, pages, services, lib)
│   ├── package.json              # Frontend scripts & dependencies
│   ├── .env.example              # Template biến môi trường frontend
│   └── netlify.toml              # Netlify build & redirect configuration
│
├── backend/                      # Node.js + Express REST API (TypeScript)
│   ├── src/                      # Source code API (modules, middleware, config, common)
│   │   ├── config/               # env, prisma, cors, cloudinary, openapi
│   │   ├── modules/              # health, auth, hotels, bookings, payments, reviews,...
│   │   ├── middleware/           # security, logging, error handling, auth guards
│   │   └── server.ts             # Entry point ứng dụng
│   ├── prisma/                   # Prisma schema & demo seeders
│   ├── package.json              # Backend scripts & dependencies
│   └── .env.example              # Template biến môi trường backend
│
├── database/                     # Microsoft SQL Server resources
│   ├── migrations/               # DDL scripts chạy tuần tự 001 -> 008
│   ├── seed/                     # Seed data (001_roles.sql, demo data)
│   ├── scripts/                  # verify-schema.sql, test-constraints.sql
│   └── docs/                     # Data dictionary, constraint checklist
│
├── docs/                         # Báo cáo kỹ thuật & tài liệu triển khai
├── .github/                      # GitHub Actions CI workflow
├── .gitignore                    # Quy tắc Git ignore toàn dự án
├── .nvmrc                        # Phiên bản Node.js (24)
└── README.md                     # Hướng dẫn dự án
```

---

## 2. Công nghệ thực tế (Technology Stack)

| Thành phần | Công nghệ thực tế |
|---|---|
| **Frontend** | React 19, Vite 8, TypeScript, TailwindCSS v4, React Router 7, TanStack Query 5 |
| **Backend** | Node.js (v24), Express 5, TypeScript, Prisma 7 (`@prisma/adapter-mssql`), Zod |
| **Database** | Microsoft SQL Server (tương thích Amazon RDS for SQL Server) |
| **Lưu trữ ảnh** | Cloudinary API |
| **Xác thực** | JWT (Access Token in-memory, Refresh Token HttpOnly Cookie) + bcrypt |
| **Mục tiêu triển khai** | **Frontend: Netlify** \| **Backend: Render** \| **Database: Amazon RDS** |

---

## 3. Yêu cầu môi trường (System Requirements)

- **Node.js:** >= 20.x (khuyến nghị Node 24 theo `.nvmrc`)
- **Package Manager:** `npm` (trên Windows PowerShell khuyến nghị dùng `npm.cmd` để tránh lỗi ExecutionPolicy)
- **Database:** Microsoft SQL Server 2019/2022 hoặc Amazon RDS for SQL Server
- **Công cụ dòng lệnh:** `git`, `sqlcmd` (với tùy chọn `-f 65001` cho UTF-8 tiếng Việt)

---

## 4. Cài đặt Dependencies

Từ thư mục gốc repository:

```bash
# Frontend
cd frontend
npm install   # Trên Windows PowerShell nếu gặp policy: npm.cmd install

# Backend
cd ../backend
npm install   # Trên Windows PowerShell: npm.cmd install
```

---

## 5. Cấu hình biến môi trường (`.env`)

Sao chép từ file template mẫu:

```bash
# Trên Linux / macOS:
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Trên Windows PowerShell:
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

### Danh sách biến môi trường chính

#### Frontend (`frontend/.env`)
- `VITE_API_BASE_URL`: URL API backend (Dev: `http://localhost:5000/api`, Prod trên Netlify: `https://<backend-render-app>.onrender.com/api`).
- `VITE_DEV_API_TARGET`: URL proxy nội bộ khi dev nếu không đặt base URL (mặc định `http://localhost:5000`).

#### Backend (`backend/.env`)
- **Cấu hình Database (Hỗ trợ 2 định dạng):**
  - *Cách 1 (Biến riêng lẻ - khuyến nghị cho Amazon RDS):*
    - `DB_HOST`: Host/endpoint của SQL Server (VD: `localhost` hoặc `<rds-endpoint>.rds.amazonaws.com`)
    - `DB_PORT`: Cổng kết nối (mặc định `1433`)
    - `DB_NAME`: Tên database (mặc định `HotelBooking`)
    - `DB_USER`: Tên tài khoản DB (VD: `sa` hoặc `admin`)
    - `DB_PASSWORD`: Mật khẩu DB
    - `DB_ENCRYPT`: Bật mã hóa TLS (`true` khi production/RDS, `false` khi local dev)
    - `DB_TRUST_SERVER_CERTIFICATE`: Tin tưởng chứng chỉ server (`false` khi production/RDS, `true` khi local dev)
  - *Cách 2 (Chuỗi kết nối đầy đủ):*
    - `DATABASE_URL`: `sqlserver://localhost:1433;database=HotelBooking;user=sa;password=...;encrypt=false;trustServerCertificate=true`
- **Mạng & Hosting:**
  - `PORT`: Cổng backend lắng nghe (mặc định `5000`, Render tự động inject `PORT`).
  - `TRUST_PROXY`: `true` khi chạy sau reverse proxy Render, `false` khi local dev.
  - `FRONTEND_URL` / `CORS_ORIGIN`: Origin frontend được phép gọi API (Dev: `http://localhost:5173`, Prod: `https://<site>.netlify.app`).
  - `REFRESH_COOKIE_SAMESITE`: `none` khi frontend và backend khác domain (Netlify & Render); `lax` khi cùng domain.
- **Xác thực & Bảo mật:**
  - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: Chuỗi khóa ký JWT (tối thiểu 32 ký tự, bắt buộc khác nhau trên production).
- **Dịch vụ tích hợp:**
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Quản lý upload ảnh.
  - `PAYMENT_PROVIDER`: `simulated` (mô phỏng thanh toán, không cần cổng thật) hoặc `vnpay` (kèm `VNPAY_*`).
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: Gửi email khôi phục mật khẩu.

---

## 6. Khởi động môi trường phát triển (Development)

Khởi động hai dịch vụ độc lập:

### Frontend (http://localhost:5173):
```bash
cd frontend
npm.cmd run dev   # hoặc: npm run dev
```

### Backend (http://localhost:5000):
```bash
cd backend
npm.cmd run dev   # hoặc: npm run dev
```

### Kiểm tra Health Check:
- Liveness check (Root): `GET http://localhost:5000/health`
- Liveness check (API): `GET http://localhost:5000/api/health`
- Readiness check (Kèm kiểm tra kết nối DB): `GET http://localhost:5000/health/ready` hoặc `GET http://localhost:5000/api/health/ready`

---

## 7. Build và chạy Production Mode

### Build Frontend:
Khi build production cho Netlify, `VITE_API_BASE_URL` bắt buộc phải là URL HTTPS hợp lệ của backend Render:

```bash
cd frontend

# Trên Windows PowerShell:
$env:VITE_API_BASE_URL="https://your-backend.onrender.com/api"; npm.cmd run build

# Trên Linux / macOS:
VITE_API_BASE_URL="https://your-backend.onrender.com/api" npm run build
```
Kết quả build được tạo tại thư mục `frontend/dist/`.

### Khởi động Backend Production:
```bash
cd backend
npm.cmd run build   # Sinh Prisma client và biên dịch TypeScript sang dist/
npm.cmd start       # Chạy lệnh: node dist/server.js
```

---

## 8. Mục tiêu triển khai Cloud (Deployment Targets)

1. **Frontend -> Netlify:**
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Environment variables: `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api`
   - Cấu hình điều hướng SPA đã được định nghĩa trong `frontend/netlify.toml`.

2. **Backend -> Render (Web Service):**
   - Root directory: `backend`
   - Runtime: `Node`
   - Build command: `npm run build`
   - Start command: `npm run start` (hoặc `node dist/server.js`)
   - Health check path: `/health` (hoặc `/api/health`)
   - Environment variables: Cấu hình `NODE_ENV=production`, `TRUST_PROXY=true`, `REFRESH_COOKIE_SAMESITE=none`, `CORS_ORIGIN=https://<your-netlify-app>.netlify.app`, cùng các biến DB và JWT secrets.

3. **Database -> Amazon RDS for Microsoft SQL Server:**
   - Chạy các migration SQL tuần tự từ `database/migrations/001_*.sql` đến `008_*.sql`.
   - Seed dữ liệu vai trò bằng `database/seed/001_roles.sql` với cờ UTF-8: `sqlcmd ... -f 65001`.
   - Backend kết nối qua discrete variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) hoặc `DATABASE_URL` với `encrypt=true;trustServerCertificate=false`.

---

## 9. Những công việc chưa thực hiện (Next Steps trước khi Deploy)

1. **Tạo tài nguyên Cloud:**
   - Khởi tạo instance Amazon RDS for SQL Server và cấu hình Security Group (cho phép IP của Render outbound).
   - Đăng ký và tạo Web Service trên Render kết nối với GitHub repository.
   - Tạo Site trên Netlify liên kết với thư mục `frontend` của repository.
2. **Chạy Migration trên RDS:**
   - Chạy script 001 đến 008 và seed roles lên database RDS đích.
   - Chạy `verify-schema.sql` và `test-constraints.sql` để xác minh toàn vẹn schema.
3. **Cấu hình Secret Variables trên Cloud:**
   - Cung cấp các giá trị production thật (RDS password, JWT secrets ngẫu nhiên 32+ ký tự, Cloudinary production keys).
