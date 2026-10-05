# Hotel Booking Platform

Nền tảng đặt phòng khách sạn trực tuyến.

## Kiến trúc

Dự án gồm 2 phần độc lập trong cùng một repository:

```text
project-root/
├── frontend/   # React + Vite (SPA)
└── backend/    # Node.js + Express REST API (prefix /api)
```

Frontend gọi backend qua `fetch` (xem `frontend/src/services/apiClient.ts`) với base URL lấy từ biến `VITE_API_BASE_URL`.

## Tech stack

| Thành phần     | Công nghệ                              |
| -------------- | -------------------------------------- |
| Frontend       | React + Vite (TypeScript), React Router, TanStack Query |
| Backend        | Node.js + Express (TypeScript)         |
| Database       | Microsoft SQL Server (Prisma + `@prisma/adapter-mssql`) |
| Image Storage  | Cloudinary (+ multer)                  |
| Authentication | JWT (`jsonwebtoken`, `bcrypt`)         |

## Yêu cầu môi trường

- Node.js >= 20 và npm
- Git
- Microsoft SQL Server (chỉ cần khi dùng các endpoint truy cập database)
- Tài khoản Cloudinary (chỉ cần khi dùng chức năng upload ảnh)

## Cài đặt dependency

```bash
cd frontend && npm install
cd ../backend && npm install
```

## Cấu hình `.env`

Sao chép file mẫu và điền giá trị thực (không commit file `.env`):

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

- `backend/.env`: `PORT`, `DATABASE_URL` (chuỗi kết nối SQL Server), `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, `CLOUDINARY_*`, `VNPAY_*`, `SMTP_*`, `CORS_ORIGIN`/`FRONTEND_URL`.
- `frontend/.env`: `VITE_API_BASE_URL` (mặc định `http://localhost:5000/api`).

> Dev: nếu thiếu `VITE_API_BASE_URL`, `apiClient` gọi `/api` tương đối và Vite proxy (`vite.config.ts`) chuyển tiếp sang `http://localhost:5000` (đổi bằng `VITE_DEV_API_TARGET`). Khi API trả về không phải JSON, thông báo lỗi chỉ rõ cần kiểm tra `VITE_API_BASE_URL`/proxy.

### Triển khai: cookie refresh và CORS

Refresh token nằm trong cookie `HttpOnly` (`Path=/api/auth`). Trình duyệt chỉ gửi nó theo cách phụ thuộc vào việc SPA và API **cùng site** hay **khác site**. Repo không quy định domain production (tài liệu chỉ nêu frontend dự kiến chạy trên Cloudflare Pages), nên chính sách là cấu hình bắt buộc khi `NODE_ENV=production`:

| Triển khai | `REFRESH_COOKIE_SAMESITE` | `CORS_ORIGIN` | Frontend |
|---|---|---|---|
| SPA và API cùng site (cùng domain gốc, hoặc một reverse proxy phục vụ cả hai) | `lax` | origin https của SPA | `VITE_API_BASE_URL` để trống (đường dẫn `/api`) hoặc API cùng site |
| SPA và API khác site | `none` (tự bật `Secure`) | origin https **chính xác** của SPA (không `*`) | `VITE_API_BASE_URL=https://<api>/api` |

Backend từ chối khởi động nếu production thiếu `REFRESH_COOKIE_SAMESITE`, hoặc `CORS_ORIGIN`/`FRONTEND_URL` có ký tự đại diện/không dùng HTTPS. `POST /auth/refresh` và `/auth/logout` (chỉ xác thực bằng cookie) từ chối request có header `Origin` không thuộc `CORS_ORIGIN` (403). Mọi request của frontend đều gửi `credentials: 'include'`.

## Chạy dự án

Frontend (http://localhost:5173):

```bash
cd frontend
npm.cmd run dev
```

Backend (http://localhost:5000):

```bash
cd backend
npm.cmd run dev
```

Kiểm tra backend: `GET http://localhost:5000/api/health`

```json
{ "success": true, "message": "Hotel Booking API is running" }
```

## Build frontend

```bash
cd frontend
npm run build
```
