# TÀI LIỆU BỐI CẢNH DỰ ÁN (PROJECT CONTEXT)
**Hệ thống Nền tảng Đặt phòng Khách sạn Trực tuyến (Online Hotel Booking Platform)**

> **Dành cho AI Coding Assistant:**  
> Tài liệu này là nguồn tham chiếu bối cảnh tập trung (Single Context Entrypoint) của toàn bộ repository. File này tổng hợp kiến trúc, cơ sở dữ liệu, nghiệp vụ, trạng thái triển khai Use Case (UC01–UC40), các quyết định đã khóa (Gate 0) và các hạng mục kỹ thuật còn tồn đọng.  
> **Quy tắc tiên quyết:** Trước khi thực hiện bất kỳ thay đổi nào trên mã nguồn, AI coding mới chỉ cần đọc tài liệu này để hiểu toàn bộ dự án mà không cần duyệt lại toàn bộ kho mã nguồn từ đầu.

---

## MỤC LỤC
1. [Project Overview](#1-project-overview)
2. [Actors và Phân Quyền (RBAC)](#2-actors-và-phân-quyền-rbac)
3. [Kiến Trúc Hệ Thống (Architecture)](#3-kiến-trúc-hệ-thống-architecture)
4. [Cơ Sở Dữ Liệu (Database Context - 22 Bảng)](#4-cơ-sở-dữ-liệu-database-context---22-bảng)
5. [Gate 0 & Các Quyết Định Nghiệp Vụ Đã Khóa](#5-gate-0--các-quyết-định-nghiệp-vụ-đã-khóa)
6. [Business Rules Quan Trọng Đã Triển Khai](#6-business-rules-quan-trọng-đã-triển-khai)
7. [Trạng Thái Triển Khai Milestone (M0–M8)](#7-trạng-thái-triển-khai-milestone-m0m8)
8. [Use Case Coverage (UC01–UC40 Matrix)](#8-use-case-coverage-uc01uc40-matrix)
9. [Chi Tiết Các Use Case Đang Có Vấn Đề (Quan Trọng Nhất)](#9-chi-tiết-các-use-case-đang-có-vấn-đề-quan-trọng-nhất)
10. [Chi Tiết Coverage Group 1 Đã Fix (UC03 & UC32)](#10-chi-tiết-coverage-group-1-đã-fix-uc03--uc32)
11. [Bản Đồ Tập Tin Trọng Yếu (Important File Map)](#11-bản-đồ-tập-tin-trọng-yếu-important-file-map)
12. [Bối Cảnh Kiểm Thử (Testing Context)](#12-bối-cảnh-kiểm-thử-testing-context)
13. [Giới Hạn Đã Biết & Nợ Kỹ Thuật (Known Limitations / Tech Debt)](#13-giới-hạn-đã-biết--nợ-kỹ-thuật-known-limitations--tech-debt)
14. [Quy Tắc Bắt Buộc Dành Cho AI Coding Tiếp Theo](#14-quy-tắc-bắt-buộc-dành-cho-ai-coding-tiếp-theo)

---

## 1. Project Overview

### 1.1. Mô tả dự án
Nền tảng đặt phòng khách sạn trực tuyến (Online Hotel Booking Platform) cho phép khách du lịch tìm kiếm, xem phòng, nhận báo giá tức thời, đặt phòng khách sạn, thanh toán trực tuyến qua VNPAY, quản lý đơn đặt phòng, hủy phòng hoàn tiền theo chính sách và gửi đánh giá/khiếu nại. Hệ thống đồng thời cung cấp cổng thông tin dành cho Chủ khách sạn quản lý danh mục phòng/giá/quỹ phòng theo ngày và xem doanh thu, cùng cổng Quản trị hệ thống kiểm duyệt đối tác, quản lý tài khoản, khuyến mại và điều hành vận hành.

### 1.2. Cấu trúc Repository (Monorepo)
Dự án được tổ chức dưới dạng monorepo chứa cả frontend, backend, cơ sở dữ liệu và tài liệu kiến trúc:
```text
d:\CNPM\
├── backend/            # Express REST API (TypeScript, Node.js >= 24)
├── frontend/           # Single Page Application (React 19, TypeScript, Vite)
├── database/           # DDL Migrations (SQL Server), Seed scripts, Constraint docs
├── docs/               # Báo cáo kiến trúc, tài liệu milestone M1-M8, coverage audit
└── README.md           # Hướng dẫn khởi chạy tổng quát
```

### 1.3. Công nghệ chủ đạo (Tech Stack)
- **Database Engine:** Microsoft SQL Server (T-SQL, driver `mssql` v12.7, adapter `@prisma/adapter-mssql` v7.10).
- **ORM & Data Access:** Prisma Client v7.10 (tạo kiểu mạnh từ schema, hỗ trợ interactive transaction và partial indexes).
- **Backend Framework:** Node.js (>=24), Express 5.2.1, TypeScript 5.8.0.
- **Backend Libraries:** Zod (runtime validation), bcrypt (hashing mật khẩu), jsonwebtoken (JWT Auth), cookie-parser (httpOnly cookies), multer & cloudinary (quản lý lưu trữ ảnh).
- **Frontend Framework:** React 19.2.8, TypeScript 5.8.0, Vite 8.3.0.
- **Frontend State & Routing:** React Router v7.18.4, TanStack Query v5.66.0 (Server State), React Hook Form v7.54.2 + @hookform/resolvers (Form State), Zustand v5.0.3 (Client Auth State), Tailwind CSS v4.0.0.
- **External Integrations:**
  - **Cloudinary:** Lưu trữ và quản lý CDN hình ảnh khách sạn, loại phòng, ảnh đánh giá.
  - **VNPAY Sandbox:** Cổng thanh toán trực tuyến (URL generation, checksum HMAC-SHA512, IPN & Return callback, refund gateway).
  - **SMTP (Nodemailer):** Gửi liên kết đặt lại mật khẩu UC04; cấu hình qua biến môi trường, bắt buộc đầy đủ ở production.

### 1.4. Luồng nghiệp vụ chính theo đối tượng (End-to-End Business Flow)
1. **Khách vãng lai (Guest / Anonymous):**
   - Tìm kiếm khách sạn theo địa phương, khoảng ngày nhận/trả phòng, số lượng khách, tầm giá, hạng sao, tiện nghi.
   - Xem thông tin chi tiết khách sạn, hình ảnh, danh sách loại phòng và tiện nghi.
   - Nhận báo giá tức thời (`POST /api/hotels/:id/quote`) kiểm tra số lượng phòng trống và thử áp mã khuyến mãi.
   - Đăng ký tài khoản khách hàng mới hoặc đăng nhập tài khoản.
2. **Khách hàng (Customer):**
   - Cập nhật thông tin cá nhân hồ sơ (`/profile`).
   - Đăng ký hồ sơ đối tác kinh doanh (`/partner/apply`) gửi giấy tờ pháp lý chờ Admin duyệt.
   - Thực hiện đặt phòng (`POST /api/hotels/:id/bookings`) với phòng trống và giá được tính lại an toàn bằng khóa giao dịch phía server.
   - Thực hiện thanh toán qua cổng VNPAY (`POST /api/bookings/:id/payments/vnpay`).
   - Xem lịch sử và chi tiết các đơn đặt phòng của bản thân (`/bookings`, `/bookings/:id`).
   - Hủy đơn đặt phòng và nhận tiền hoàn tự động theo chính sách hủy gắn liền với đơn (`POST /api/bookings/:id/cancel`).
   - Đánh giá khách sạn kèm hình ảnh sau khi kỳ lưu trú hoàn tất (`POST /api/bookings/:id/review`).
   - Gửi yêu cầu hỗ trợ hoặc khiếu nại liên quan đến đơn đặt phòng hoặc dịch vụ chung (`/support`).
3. **Chủ khách sạn (Hotel Owner / Partner):**
   - Đăng ký thông tin khách sạn mới (`/owner/hotels/new`) chờ Admin phê duyệt.
   - Quản lý danh sách khách sạn sở hữu, cập nhật thông tin mô tả, tiện nghi, tải lên/xóa ảnh đại diện.
   - Khởi tạo và cập nhật các loại phòng thuộc khách sạn (`/owner/hotels/:id/room-types`).
   - Quản lý tiện nghi và hình ảnh loại phòng.
   - Thiết lập số lượng phòng mở bán và giá phòng theo từng ngày cụ thể (`QUY_PHONG_GIA` bulk upsert).
   - Xem báo cáo phân tích doanh thu (doanh thu gộp, tiền hoàn, doanh thu thực nhận), tỷ lệ lấp đầy phòng đêm và loại phòng thịnh hành (`/owner/hotels/:id/analytics`).
4. **Quản trị hệ thống (System Administrator):**
   - Quản lý danh sách tài khoản toàn hệ thống, xem chi tiết, cập nhật, khóa/mở khóa tài khoản, xóa an toàn tài khoản (`/admin/accounts`).
   - Tiếp nhận và thẩm định hồ sơ đăng ký kinh doanh đối tác (`/admin/partner-applications`), phê duyệt nâng quyền đối tác lên Chủ khách sạn hoặc từ chối kèm lý do rõ ràng.
   - Kiểm duyệt các đánh giá của khách hàng (`/admin/reviews`), ẩn hoặc gắn cờ đánh giá vi phạm tiêu chuẩn cộng đồng.
   - Tiếp nhận và phân công xử lý các khiếu nại, yêu cầu hỗ trợ của khách hàng (`/admin/support`).
   - Tạo mới, cập nhật, kích hoạt hoặc ngừng áp dụng các mã khuyến mãi toàn hệ thống (`/admin/promotions`).
   - Theo dõi dashboard báo cáo thống kê toàn diện nền tảng (`/admin/analytics`).

---

## 2. Actors và Phân Quyền (RBAC)

### 2.1. Danh mục Actor duy nhất
Hệ thống **CHỈ CÓ 4 ACTOR** sau:
1. **Guest / Anonymous (Khách vãng lai):** Người dùng chưa xác thực danh tính.
2. **Khách hàng (Customer):** Người dùng thông thường đã đăng ký/đăng nhập.
3. **Chủ khách sạn (Hotel Owner / Partner):** Khách hàng đã nộp hồ sơ đối tác và được Admin phê duyệt.
4. **Quản trị hệ thống (System Administrator):** Quản trị viên cấp cao của nền tảng.

> [!CAUTION]
> **QUY TẮC BẮT BUỘC (G0-09):** Hệ thống **TUYỆT ĐỐI KHÔNG CÓ** vai trò hoặc module riêng dành cho `Nhân viên CSKH`. Mọi công tác chăm sóc khách hàng, hỗ trợ và giải quyết khiếu nại đều do actor `Quản trị hệ thống` phụ trách trực tiếp. Trong database, bảng `VAI_TRO` chỉ có đúng 3 bản ghi: `Khách hàng`, `Chủ khách sạn`, `Quản trị hệ thống`.

### 2.2. Chi tiết quyền hạn & Nguyên tắc sở hữu (Ownership Rules)

| Actor | Phạm vi quyền hạn chính | Quy tắc kiểm soát sở hữu (Ownership Enforcement) |
|---|---|---|
| **Guest** | Tìm kiếm, xem chi tiết khách sạn/phòng, tính quote, login, register, forgot/reset password. | Không có dữ liệu định danh người dùng. Không truy cập được route bảo vệ. |
| **Khách hàng** | Quản lý profile, nộp hồ sơ đối tác, tạo đơn đặt phòng, thanh toán, xem danh sách/chi tiết booking của mình, hủy booking của mình, đánh giá booking hoàn tất, gửi yêu cầu hỗ trợ. | **Customer Scope:** Chỉ được xem/sửa tài nguyên mà `MaTaiKhoanKhachHang === req.user.maTaiKhoan` (hoặc `MaKhachHang`). Truy cập booking/yêu cầu của người khác sẽ bị từ chối bằng HTTP `403 Forbidden` (hoặc `404 Not Found` nếu không lộ sự tồn tại). |
| **Chủ khách sạn** | Đăng ký khách sạn, quản lý thông tin/ảnh/tiện nghi khách sạn của mình, quản lý loại phòng, cấu hình quỹ phòng và giá theo ngày, xem analytics khách sạn sở hữu. | **Partner Scope:** Khách sạn phải có `MaTaiKhoanSoHuu === req.user.maTaiKhoan`. Mọi thao tác loại phòng/giá phòng đều kiểm tra quan hệ bắc cầu về khách sạn cha. Thao tác trên khách sạn của chủ khác bị trả về `403 Forbidden`, không tồn tại trả về `404 Not Found`. Không thể can thiệp booking hay analytics của khách sạn khác. |
| **Quản trị hệ thống** | Quản lý tài khoản toàn hệ thống, duyệt hồ sơ đối tác, kiểm duyệt đánh giá, giải quyết hỗ trợ/khiếu nại, quản trị khuyến mại, xem analytics hệ thống. | **Admin Scope:** Có quyền truy cập toàn diện trên phạm vi hệ thống tại các route `/api/admin/*`. Khi duyệt hồ sơ hoặc giải quyết khiếu nại, ID quản trị viên xử lý (`MaTaiKhoanDuyet`, `MaTaiKhoanXuLy`) được gán tự động từ JWT token, client không thể can thiệp. |

---

## 3. Kiến Trúc Hệ Thống (Architecture)

### 3.1. Luồng xử lý Backend (Layered Architecture)
Backend tuân thủ kiến trúc phân tầng một chiều, tách biệt hoàn toàn giữa giao thức HTTP và logic nghiệp vụ:
```text
HTTP Request
  └── Route (src/modules/<domain>/<domain>.routes.ts)
        └── Middleware (auth, validation qua Zod, security)
              └── Controller (src/modules/<domain>/<domain>.controller.ts)
                    └── Service (src/modules/<domain>/<domain>.service.ts)
                          └── Repository (src/modules/<domain>/<domain>.repository.ts)
                                └── Prisma Client (src/generated/prisma)
                                      └── Microsoft SQL Server
```
- **Controller:** Chỉ thực hiện bóc tách request (params, query, body), chuyển cho service và format dữ liệu trả về thông qua helper chuẩn (`sendSuccess`, `sendPaginated`). Tuyệt đối không chứa logic nghiệp vụ.
- **Service:** Độc lập với Express req/res. Nhận tham số kiểu dữ liệu nguyên thủy/DTO, thực hiện toàn bộ kiểm tra nghiệp vụ, tính toán tiền tệ, concurrency locks, và điều phối transaction.
- **Repository:** Chịu trách nhiệm tương tác dữ liệu duy nhất qua Prisma client hoặc raw SQL query có hint.
- **Fail-fast Configuration:** Mọi biến môi trường được parse và validate nghiêm ngặt qua Zod ngay tại `src/config/env.ts`.

### 3.2. Luồng xử lý Frontend (SPA Architecture)
```text
React Router (src/routes/AppRoutes.tsx)
  └── Layout / ProtectedRoute (src/components/auth/ProtectedRoute.tsx)
        └── Page Component (src/pages/*.tsx)
              └── Feature Hook / API Client (src/features/<domain>/api.ts)
                    └── Universal apiClient (src/services/apiClient.ts)
                          └── Backend REST API (/api/*)
```
- **State Separation:**
  - *Server State:* Quản lý bằng `TanStack Query` (caching, revalidation tự động, query keys rõ ràng).
  - *Form State:* `React Hook Form` kết hợp Zod resolver (`@hookform/resolvers/zod`).
  - *URL State:* `React Router` (`useSearchParams`) làm nguồn chân lý duy nhất cho bộ lọc, trang, từ khóa tìm kiếm.
  - *Client State:* `Zustand` (`useAuthStore`) chỉ lưu trữ trạng thái đăng nhập tối thiểu và access token.

### 3.3. Các cơ chế tích hợp trọng yếu
1. **Xác thực JWT kép (Dual-Token Mechanism):**
   - Access Token: Ngắn hạn (15 phút), ký HMAC-SHA256 với `JWT_ACCESS_SECRET`, lưu trong bộ nhớ client (Zustand state), gửi qua header `Authorization: Bearer <token>`.
   - Refresh Token: Dài hạn (7 ngày), ký với `JWT_REFRESH_SECRET`, lưu trong cookie `httpOnly: true`, `secure` tự động bật khi `NODE_ENV==='production'`, `Path=/api/auth`. `SameSite` do `REFRESH_COOKIE_SAMESITE` quyết định: `lax` khi SPA và API cùng site (mặc định ngoài production; không dùng `strict` để cookie không rớt trên các luồng redirect top-level hợp lệ), `none` (tự bật `Secure`) khi khác site; production bắt buộc đặt tường minh. `POST /auth/refresh` và `/auth/logout` từ chối `Origin` không thuộc `CORS_ORIGIN`. Xem README, mục "Triển khai: cookie refresh và CORS" và `common/utils/auth-cookie.ts`.
   - Auto-refresh: `apiClient.ts` tự động phát hiện mã `401`, gọi `POST /api/auth/refresh` và có cờ `refreshPromise` deduplication chống race condition khi nhiều request đồng thời nhận 401. Nếu refresh cũng thất bại, phiên được đánh dấu hết hạn (`expireSession`) và người dùng thấy thông báo rõ ràng ở trang đăng nhập thay vì bị chuyển hướng âm thầm (M9).
2. **Cổng thanh toán VNPAY Sandbox:**
   - Tạo URL thanh toán an toàn: Tính checksum `vnp_SecureHash` bằng HMAC-SHA512 với `VNPAY_HASH_SECRET`.
   - Xử lý Callback trình duyệt (`GET /api/payments/vnpay-return`): Xác minh chữ ký, redirect về trang kết quả `/payment/result`.
   - Xử lý IPN Server-to-Server (`GET /api/payments/vnpay-ipn`): Xác minh chữ ký độc lập, kiểm tra trạng thái và cập nhật booking/thanh toán mang tính thẩm quyền tối cao.
3. **Lưu trữ hình ảnh Cloudinary:**
   - Upload ảnh thông qua chuỗi base64 Data URI gửi trong JSON payload (`uploadImageSchema`). Backend đóng vai trò gateway upload lên Cloudinary với secret bảo mật, lưu lại secure URL vào database. Frontend không bao giờ tiếp xúc với API secret của Cloudinary.

---

## 4. Cơ Sở Dữ Liệu (Database Context - 22 Bảng)

Cơ sở dữ liệu Microsoft SQL Server là **Nguồn Chân Lý Duy Nhất (Single Source of Truth)** của hệ thống. Schema gồm đúng **22 bảng**, tương ứng với 22 Prisma Models.

| STT | Tên Bảng | Mục Đích Lưu Trữ | Khóa Chính (PK) | Quan Hệ Khóa Ngoại Trọng Yếu (FK) | Nghiệp Vụ Sử Dụng |
|---:|---|---|---|---|---|
| 1 | `VAI_TRO` | Danh mục 3 vai trò hệ thống | `MaVaiTro` | Không | Auth, RBAC, phân quyền |
| 2 | `TAI_KHOAN` | Người dùng (khách, chủ KS, admin) | `MaTaiKhoan` | `MaVaiTro → VAI_TRO` | Đăng nhập, profile, sở hữu tài nguyên |
| 3 | `HO_SO_DOI_TAC` | Hồ sơ đăng ký đối tác chủ khách sạn | `MaHoSoDoiTac` | `MaTaiKhoan → TAI_KHOAN`<br>`MaTaiKhoanDuyet → TAI_KHOAN` | Đăng ký đối tác (UC03), duyệt đối tác (UC32) |
| 4 | `DIA_PHUONG` | Danh mục địa phương (thành phố, tỉnh) | `MaDiaPhuong` | Không | Tìm kiếm khách sạn, đăng ký khách sạn |
| 5 | `KHACH_SAN` | Thông tin cơ sở khách sạn | `MaKhachSan` | `MaTaiKhoanSoHuu → TAI_KHOAN`<br>`MaDiaPhuong → DIA_PHUONG`<br>`MaTaiKhoanDuyet → TAI_KHOAN` | Tìm kiếm, chi tiết KS, quản lý KS của Owner |
| 6 | `HINH_ANH_KHACH_SAN` | Ảnh không gian, phối cảnh khách sạn | `MaHinhAnh` | `MaKhachSan → KHACH_SAN` | Gallery khách sạn, quản lý ảnh Owner |
| 7 | `TIEN_NGHI` | Danh mục tiện nghi (Wifi, Hồ bơi,...) | `MaTienNghi` | Không | Bộ lọc tìm kiếm, tiện nghi KS & phòng |
| 8 | `KHACH_SAN_TIEN_NGHI` | Liên kết KS – Tiện nghi (n-n) | `(MaKhachSan, MaTienNghi)` | `MaKhachSan → KHACH_SAN`<br>`MaTienNghi → TIEN_NGHI` | Tiện nghi khách sạn |
| 9 | `LOAI_PHONG` | Định nghĩa loại phòng (Standard, Suite) | `MaLoaiPhong` | `MaKhachSan → KHACH_SAN` | Danh sách phòng, đặt phòng, tồn phòng |
| 10 | `HINH_ANH_LOAI_PHONG` | Ảnh chi tiết nội thất phòng | `MaHinhAnhLoaiPhong` | `MaLoaiPhong → LOAI_PHONG` | Chi tiết phòng, quản lý ảnh phòng Owner |
| 11 | `LOAI_PHONG_TIEN_NGHI` | Liên kết Phòng – Tiện nghi (n-n) | `(MaLoaiPhong, MaTienNghi)` | `MaLoaiPhong → LOAI_PHONG`<br>`MaTienNghi → TIEN_NGHI` | Tiện nghi loại phòng |
| 12 | `QUY_PHONG_GIA` | Quỹ phòng mở bán & giá theo ngày | `MaQuyPhong` | `MaLoaiPhong → LOAI_PHONG` | Báo giá, kiểm tra tồn phòng, tính tiền |
| 13 | `CHINH_SACH_HUY` | Chính sách hủy cấp hệ thống | `MaChinhSachHuy` | Không | Gắn vào đơn đặt phòng khi tạo |
| 14 | `CHI_TIET_CHINH_SACH_HUY`| Các mốc giờ và % hoàn tiền của chính sách | `MaChiTietChinhSach` | `MaChinhSachHuy → CHINH_SACH_HUY` | Tính toán tiền hoàn khi khách hủy phòng |
| 15 | `KHUYEN_MAI` | Mã giảm giá toàn hệ thống | `MaKhuyenMai` | Không | Giảm giá đơn đặt phòng (UC15, UC39, UC40) |
| 16 | `DAT_PHONG` | Đơn đặt phòng trung tâm | `MaDatPhong` | `MaTaiKhoanKhachHang → TAI_KHOAN`<br>`MaKhachSan → KHACH_SAN`<br>`MaKhuyenMai → KHUYEN_MAI`<br>`MaChinhSachHuy → CHINH_SACH_HUY` | Đặt phòng, thanh toán, hủy phòng, review |
| 17 | `CHI_TIET_DAT_PHONG` | Danh sách phòng và số lượng trong đơn | `MaChiTietDatPhong` | `MaDatPhong → DAT_PHONG`<br>`MaLoaiPhong → LOAI_PHONG` | Lưu số phòng đặt, tính occupancy |
| 18 | `THANH_TOAN` | Lịch sử giao dịch thanh toán | `MaThanhToan` | `MaDatPhong → DAT_PHONG` | Giao dịch VNPAY, đối soát thanh toán |
| 19 | `HOAN_TIEN` | Giao dịch hoàn tiền khi hủy phòng | `MaHoanTien` | `MaThanhToan → THANH_TOAN` | Hoàn tiền VNPAY, đối soát doanh thu net |
| 20 | `DANH_GIA` | Đánh giá & điểm sao của khách hàng | `MaDanhGia` | `MaDatPhong → DAT_PHONG`<br>`MaKhachHang → TAI_KHOAN`<br>`MaKhachSan → KHACH_SAN` | Review khách sạn, kiểm duyệt Admin |
| 21 | `HINH_ANH_DANH_GIA` | Ảnh thực tế khách hàng đính kèm review | `MaHinhAnhDanhGia` | `MaDanhGia → DANH_GIA` | Chi tiết review, bằng chứng khiếu nại |
| 22 | `YEU_CAU_HO_TRO` | Yêu cầu hỗ trợ, khiếu nại dịch vụ | `MaYeuCauHoTro` | `MaTaiKhoanKhachHang → TAI_KHOAN`<br>`MaTaiKhoanXuLy → TAI_KHOAN`<br>`MaDatPhong → DAT_PHONG` | Support, khiếu nại, Admin xử lý (UC16, UC38) |

---

## 5. Gate 0 & Các Quyết Định Nghiệp Vụ Đã Khóa

Đây là các quyết định mang tính ràng buộc kiến trúc cao nhất (Architecture Freeze), bắt nguồn từ văn bản thiết kế chuẩn `database/DATABASE_SOURCE_CHAPTER_6_7.md` và các quyết định Gate 0 (G0-01 đến G0-10):

1. **G0-01 (Bỏ KHUYEN_MAI_KHACH_SAN):** Khuyến mại chỉ áp dụng ở cấp **toàn hệ thống** (`PhamViApDung = 'Toàn hệ thống'`). Không hỗ trợ khuyến mãi riêng lẻ theo từng khách sạn. Mọi tài liệu cũ nhắc đến bảng này đều là **OBSOLETE**.
2. **G0-02 (Bỏ CHI_TIET_GIA_DAT_PHONG):** Không lưu bảng chi tiết giá theo ngày cho từng booking. Giá phòng được tính động theo ngày lưu trú dựa trên `QUY_PHONG_GIA` tại thời điểm đặt phòng.
3. **G0-03 (CHINH_SACH_HUY độc lập):** Bảng `CHINH_SACH_HUY` **không có cột `MaDatPhong`** và **không có cột `MaKhachSan`**. Chính sách hủy là tài nguyên hệ thống. Quan hệ hiệu lực là `DAT_PHONG.MaChinhSachHuy` tham chiếu đến `CHINH_SACH_HUY.MaChinhSachHuy`.
4. **G0-04 (HO_SO_DOI_TAC.MaTaiKhoanDuyet):** Hồ sơ đối tác sử dụng khóa ngoại `MaTaiKhoanDuyet` trỏ về `TAI_KHOAN` (Admin duyệt).
5. **G0-05 (Ưu tiên tên trường theo Chương 6 / Schema hiện hành):** Khi có sự sai lệch giữa Chương 6 và Chương 7, luôn lấy tên trường chuẩn theo Chương 6 và Prisma schema hiện hành (ví dụ: `TAI_KHOAN.MatKhau`, `KHACH_SAN.MaTaiKhoanSoHuu`, `QUY_PHONG_GIA.GiaPhong`, `QUY_PHONG_GIA.SoLuongPhong`).
6. **G0-09 (Không có role Nhân viên CSKH):** Không tạo bảng, actor, role hay token cho CSKH. `YEU_CAU_HO_TRO.MaTaiKhoanXuLy` trỏ tới Quản trị hệ thống.
7. **G0-10 (Bảo toàn lịch sử / Soft Delete):** Dữ liệu có lịch sử giao dịch (Tài khoản, Khách sạn, Loại phòng, Đặt phòng, Đánh giá, Thanh toán) **phải ưu tiên đổi trạng thái / soft delete**. Tuyệt đối không thêm `CASCADE DELETE` hoặc thực hiện hard delete làm mất vết kiểm toán tài chính.
8. **Ràng buộc Change Gate:** Bất kỳ thay đổi nào liên quan đến thêm/xóa bảng, đổi tên cột, sửa đổi kiểu dữ liệu SQL Server/Prisma schema **phải thông qua Change Gate**. Lập trình viên AI tuyệt đối không tự ý chạy migration thay đổi cấu trúc bảng khi chưa có yêu cầu rõ ràng.

---

## 6. Business Rules Quan Trọng Đã Triển Khai

### 6.1. Nghiệp vụ Đặt phòng (Booking & Anti-Overbooking)
- **Công thức tính phòng trống (Availability):**
  $$\text{Số phòng khả dụng} = \text{QUY_PHONG_GIA.SoLuongPhong} - \sum (\text{CHI_TIET_DAT_PHONG.SoLuongPhong của các DAT_PHONG đang hoạt động})$$
  Trong đó, đơn đặt phòng đang hoạt động là đơn có `TrangThai <> 'Đã hủy'`.
- **Nguyên tắc không trừ tồn kho trực tiếp:** Hệ thống **không bao giờ** trừ trực tiếp giá trị cột `SoLuongPhong` trong bảng `QUY_PHONG_GIA`. Số phòng còn lại luôn được tính động.
- **Chống Overbooking bằng Pessimistic Concurrency Lock:**
  - Khi thực hiện đặt phòng (`POST /api/hotels/:id/bookings`), backend mở Prisma interactive transaction và thực hiện câu lệnh SELECT với khóa cấp cao của SQL Server:
    ```sql
    SELECT MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong 
    FROM QUY_PHONG_GIA WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
    WHERE MaLoaiPhong IN (...) AND NgayApDung >= @checkIn AND NgayApDung < @checkOut
    ```
  - Khóa `UPDLOCK` chặn đứng mọi transaction đặt phòng cạnh tranh khác trên cùng loại phòng và khoảng ngày ngay tại bước đọc, triệt tiêu hoàn toàn race condition gây overbooking.
- **Server Authoritative Totals:**
  - Client tuyệt đối không được gửi các trường tổng tiền (`TongTienPhong`, `SoTienGiam`, `TongTienThanhToan`). Request body chứa các trường này sẽ bị Zod gạt bỏ hoàn toàn.
  - Toàn bộ giá tiền, chiết khấu và tổng thanh toán được tính toán lại 100% tại backend trong transaction có khóa.
- **Trạng thái ban đầu:** Luôn là `"Chờ thanh toán"`.

### 6.2. Nghiệp vụ Thanh toán (Payment & Idempotency)
- **Cổng thanh toán:** VNPAY Sandbox.
- **Số tiền thanh toán:** Đọc trực tiếp từ `DAT_PHONG.TongTienThanhToan` trong database, không tin tưởng giá trị từ client.
- **Idempotency cho Callback & IPN:**
  - Xử lý tập trung qua `PaymentsService.handleCallback`.
  - Khi nhận webhook IPN hoặc Return URL từ VNPAY, hệ thống kiểm tra trạng thái hiện tại của bản ghi `THANH_TOAN`. Nếu đã ở trạng thái kết thúc (`Thành công` hoặc `Thất bại`), hệ thống trả ngay mã phản hồi `RspCode 02` ("Order already confirmed") mà không sửa đổi dữ liệu.
- **Booking Expiry (Timeout thanh toán):**
  - Mặc định sau 15 phút (`PAYMENT_TIMEOUT_MINUTES=15`), đơn `"Chờ thanh toán"` sẽ hết hạn.
  - Cơ chế **Lazy Sweep** (`booking-expiry.ts`): Thay vì dùng cronjob phức tạp, backend tự động thực hiện truy vấn quét hủy các đơn hết hạn ngay tại đầu các luồng nghiệp vụ liên quan (tạo booking mới, kiểm tra thanh toán, xem chi tiết booking):
    ```sql
    UPDATE DAT_PHONG SET TrangThai = N'Đã hủy' 
    WHERE TrangThai = N'Chờ thanh toán' AND NgayTao < @cutoff
    ```
- **Xử lý thanh toán trễ (Late Payment):** Nếu VNPAY báo thanh toán thành công sau khi đơn đặt phòng đã bị hủy do timeout, hệ thống **không tái kích hoạt booking** mà tự động tạo bản ghi `HOAN_TIEN` 100% cho khách hàng.

### 6.3. Nghiệp vụ Hủy phòng & Hoàn tiền (Cancellation & Refund)
- **Quyền hủy:** Chỉ chủ sở hữu booking mới có quyền gửi yêu cầu hủy (`MaTaiKhoanKhachHang === req.user.maTaiKhoan`).
- **Trạng thái cho phép hủy:** Đơn phải ở trạng thái `"Chờ thanh toán"` hoặc `"Đã xác nhận"`.
- **Xác định tỷ lệ hoàn tiền:** Dựa vào chính sách hủy đã lưu cố định trên đơn (`DAT_PHONG.MaChinhSachHuy` trỏ về `CHINH_SACH_HUY` kèm `CHI_TIET_CHINH_SACH_HUY`), so sánh số giờ tính từ thời điểm hủy đến **00:00 UTC của ngày `NgayNhanPhong`** để chọn bậc hoàn tiền cao nhất thỏa mãn điều kiện.
- **Quy tắc tạo hoàn tiền:** Chỉ tạo bản ghi `HOAN_TIEN` nếu đơn đặt phòng đã có giao dịch `THANH_TOAN` với trạng thái `"Thành công"`. Đơn chưa thanh toán khi hủy sẽ không tạo bản ghi hoàn tiền.

### 6.4. Nghiệp vụ Đánh giá (Review Eligibility & Moderation)
- **Điều kiện đánh giá (RB9):** Đơn đặt phòng phải ở trạng thái `"Hoàn tất"` (khách đã lưu trú xong).
- **Lazy Completion Sweep (`booking-completion.ts`):** Tự động chuyển trạng thái đơn đặt phòng từ `"Đã xác nhận"` sang `"Hoàn tất"` khi `NgayTraPhong < NOW()`.
- **Ràng buộc duy nhất:** Mỗi đơn đặt phòng chỉ được đánh giá duy nhất một lần nhờ constraint `UNIQUE (MaDatPhong)` trên bảng `DANH_GIA`.
- **Hình ảnh đánh giá:** Tải lên Cloudinary thông qua backend, giới hạn tối đa 6 ảnh, mỗi ảnh không quá 5MB, hỗ trợ định dạng ảnh chuẩn (`jpeg`, `png`, `webp`, `gif`).
- **Trạng thái kiểm duyệt:** Đánh giá mới tạo có trạng thái `"Chờ duyệt"`. Admin có quyền duyệt (`"Hiển thị"`), ẩn (`"Ẩn"`), hoặc đánh dấu vi phạm (`"Vi phạm"`).

### 6.5. Nghiệp vụ Hỗ trợ & Khiếu nại (Support)
- Khách hàng tạo yêu cầu hỗ trợ hoặc khiếu nại (`LoaiYeuCau IN (N'Hỗ trợ', N'Khiếu nại')`).
- Nếu có đính kèm `MaDatPhong`, hệ thống bắt buộc kiểm tra đơn đó phải thuộc về khách hàng gửi yêu cầu.
- Quản trị hệ thống tiếp nhận, chuyển trạng thái sang `"Đang xử lý"` hoặc `"Đã xử lý"` kèm nội dung phản hồi `KetQuaXuLy`. Bản ghi đã xử lý không được phép sửa đổi lại.

### 6.6. Nghiệp vụ Phân tích & Báo cáo (Analytics)
- **Owner Analytics (`/api/owner/hotels/:id/analytics`):** Bắt buộc kiểm tra quyền sở hữu khách sạn trước khi tổng hợp số liệu. Thống kê theo 3 mốc thời gian chuyên biệt:
  1. *Booking:* Theo `DAT_PHONG.NgayTao`.
  2. *Tài chính:* Theo `THANH_TOAN.ThoiGianGiaoDich` và `HOAN_TIEN.NgayHoanTien` của các giao dịch `"Thành công"`.
  3. *Tỷ lệ lấp đầy (Occupancy Rate):* Tính chuẩn xác theo số đêm lưu trú thực tế chia cho tổng số phòng đêm mở bán từ `QUY_PHONG_GIA`.
- **Admin Analytics (`/api/admin/analytics`):** Báo cáo toàn diện hệ thống: tổng tài khoản theo vai trò, khách sạn theo trạng thái, giao dịch thanh toán & hoàn tiền theo trạng thái, yêu cầu hỗ trợ và tình trạng đánh giá toàn thời gian.

---

## 7. Trạng Thái Triển Khai Milestone (M0–M8)

| Milestone | Tên Milestone | Nội Dung Đã Đưa Vào Hệ Thống | Trạng Thái Kiểm Thử / Bằng Chứng Thực Tế |
|---|---|---|---|
| **Gate 0** | Architecture Freeze | Khóa danh mục 22 bảng, loại bỏ các bảng/ràng buộc lỗi thời (G0-01 đến G0-10). | Tài liệu thiết kế đã chốt tại `database/DATABASE_SOURCE_CHAPTER_6_7.md`. |
| **TECH-0** | Foundation Setup | Cấu hình monorepo, Express app, React Vite SPA, Zod env validation, middleware cơ bản. | Kiến trúc nền tảng hoàn tất; lint & typecheck sẵn sàng. |
| **DB-0** | Baseline Migrations | 6 migration DDL (`001` đến `006`), 22 bảng, 30 FKs, 7 UNIQUE, 33 CHECK constraints; đã giải quyết DDI-01 (nullability) và DDI-02 (unique rate). | Schema verified bằng script SQL; Prisma introspect & generate khớp 100%. |
| **M0** | Scaffolding | Module pattern chuẩn (Route-Controller-Service-Repository), Health check endpoint. | Endpoint `GET /api/health` hoạt động ổn định. |
| **M1** | Identity & Access | Auth login/register, JWT kép (access token + httpOnly refresh cookie), Profile cá nhân, Quản lý tài khoản Admin, Nộp hồ sơ đối tác cơ bản. | Unit & integration tests có sẵn trong mã nguồn (`auth.test.ts`, `accounts.test.ts`, `profile.test.ts`). Historical tests passed. |
| **M2** | Discovery & Catalog | Tìm kiếm khách sạn theo nhiều tiêu chí, xem chi tiết khách sạn, kiểm tra phòng trống & giá theo ngày (read-only), danh mục tiện nghi & địa phương. | Unit & integration tests có sẵn (`hotels.test.ts`, `availability.test.ts`). Historical tests passed. |
| **M3** | Supply & Owner Portal | Cổng thông tin đối tác: đăng ký KS, quản lý thông tin/tiện nghi/ảnh KS, CRUD loại phòng, bulk upsert giá & quỹ phòng `QUY_PHONG_GIA`. | Unit & integration tests có sẵn (`owner-hotels.test.ts`, `owner-room-types.test.ts`, `owner-rates.test.ts`). Historical tests passed. |
| **M4** | Commercial Rules | API tính toán báo giá (`/hotels/:id/quote`), công cụ đánh giá khuyến mãi (`evaluatePromotion`), danh mục chính sách hủy. | Pure function tests passed (`promotion-pricing.test.ts`, `quotes.test.ts`). Historical tests passed. |
| **M5** | Booking Core | Tạo đơn đặt phòng an toàn với khóa `WITH (UPDLOCK, ROWLOCK, HOLDLOCK)`, chống overbooking, server authoritative pricing. | Concurrency tests và booking integration tests có sẵn (`bookings.test.ts`). Historical tests passed. |
| **M6** | Payment & Cancellation | Tích hợp VNPAY Sandbox (URL, IPN, return), idempotency webhook, lazy sweep hết hạn thanh toán, hủy phòng theo chính sách, hoàn tiền. | Unit & integration tests có sẵn (`vnpay.test.ts`, `payments.test.ts`, `bookings-cancel.test.ts`). Historical tests passed. |
| **M7** | After-sales | Đánh giá kèm upload ảnh Cloudinary, lazy sweep hoàn tất lưu trú, kiểm duyệt đánh giá Admin, cổng hỗ trợ & khiếu nại khách hàng/admin. | Integration tests có sẵn (`reviews.test.ts`, `support.test.ts`, `review-images.test.ts`). Historical tests passed. |
| **M8** | Analytics & Indexes | Quản trị mã khuyến mãi Admin, báo cáo doanh thu & lấp đầy của Owner, báo cáo tổng thể Admin, Migration `007_indexes.sql` bổ sung 15 indexes tối ưu. | Tests có sẵn (`promotions.test.ts`, `owner-analytics.test.ts`, `admin-analytics.test.ts`). Historical tests passed. |
| **M9** | Hardening, Regression, Security, UX & Production Readiness | Rate limit cho `reset-password`; enforce `encrypt=true` khi production; request-logging middleware (method/route/status/duration/requestId, không log secret); Cloudinary upload/delete timeout; xóa file chết (`vnpay.integration.ts`, `config/database.ts`); bổ sung 4 endpoint owner còn thiếu vào OpenAPI; fix root cause 2 test availability (stale seed fixture); frontend: xác nhận cho lock account/deactivate promotion/xóa ảnh, thông báo session-expired, `aria-invalid`/`aria-describedby` cho các form auth, alt text mô tả cho ảnh gallery/review. | Xem `docs/M9_HARDENING_REPORT.md`. Backend 32/32 file, 302/302 test; frontend 24/24 file, 118/118 test; lint/typecheck/build/`prisma validate` đều pass. Không đổi schema. |

> [!NOTE]
> **Phân loại trạng thái kiểm thử:**
> - *Implementation complete:* Mã nguồn đã được hiện thực đầy đủ cả backend lẫn frontend.
> - *Historical tests passed:* Toàn bộ test suite đã pass trong quá trình hoàn thành từng milestone (thể hiện qua các báo cáo `m1-report.md` đến `m8-report.md`).
> - *Current runtime verification:* Do môi trường dev hiện tại chưa khởi động tiến trình SQL Server cục bộ, các bài kiểm thử tương tác database chưa được re-run toàn bộ; tuy nhiên mã nguồn đã vượt qua lint, typecheck và schema validation.

---

## 8. Use Case Coverage (UC01–UC40 Matrix)

Bảng đối chiếu tổng thể 40 Use Case theo tài liệu kiểm toán thẩm quyền `docs/usecase-coverage-audit.md`:

| UC | Tên Use Case | Actor | Status | Ghi Chú Tóm Tắt |
|---|---|---|---|---|
| **UC01** | Đăng nhập | Guest / Public | **COMPLETE** | Login username/email + mật khẩu, sinh JWT cặp |
| **UC02** | Đăng ký tài khoản khách hàng | Guest / Public | **COMPLETE** | Đăng ký tài khoản role Khách hàng |
| **UC03** | Đăng ký tài khoản đối tác | Khách hàng | **COMPLETE** | Nộp hồ sơ đối tác `HO_SO_DOI_TAC`, theo dõi trạng thái |
| **UC04** | Quên mật khẩu | Guest / Public | **COMPLETE** | Gửi reset link ký số, hết hạn 15 phút qua SMTP; token dùng một lần theo password fingerprint |
| **UC05** | Tìm kiếm thông tin khách sạn | Guest / Public | **COMPLETE** | Bộ lọc địa phương, ngày, khách, giá, sao, tiện nghi |
| **UC06** | Cập nhật thông tin cá nhân | Khách hàng | **COMPLETE** | Xem và cập nhật profile cá nhân |
| **UC07** | Xem thông tin khách sạn | Guest / Public | **COMPLETE** | Chi tiết khách sạn, ảnh, tiện nghi |
| **UC08** | Xem thông tin loại phòng | Guest / Public | **COMPLETE** | Danh sách loại phòng kèm giá và tình trạng phòng trống |
| **UC09** | Đặt phòng | Khách hàng | **COMPLETE** | Đặt phòng với khóa chống overbooking trong transaction |
| **UC10** | Thanh toán | Khách hàng | **COMPLETE** | Thanh toán VNPAY, xử lý IPN/Return, tự động hoàn tiền nếu muộn |
| **UC11** | Xem thông tin đặt phòng | Khách hàng | **COMPLETE** | Chi tiết đơn đặt phòng, loại phòng, tiền, chính sách hủy |
| **UC12** | Xem lịch sử đặt phòng | Khách hàng | **COMPLETE** | Danh sách các đơn đặt phòng của tài khoản |
| **UC13** | Hủy đặt phòng | Khách hàng | **COMPLETE** | Hủy đơn và hoàn tiền theo bậc chính sách hủy |
| **UC14** | Đánh giá khách sạn | Khách hàng | **COMPLETE** | Đánh giá booking đã hoàn tất kèm tải ảnh Cloudinary |
| **UC15** | Áp dụng mã khuyến mãi | Khách hàng / Guest | **COMPLETE** | Kiểm tra và áp dụng mã giảm giá khi quote và booking |
| **UC16** | Gửi yêu cầu hỗ trợ/khiếu nại | Khách hàng | **COMPLETE** | Tạo ticket hỗ trợ/khiếu nại, tùy chọn gắn booking |
| **UC17** | Đăng ký khách sạn mới | Chủ khách sạn | **COMPLETE** | Tạo cơ sở khách sạn mới ở trạng thái chờ duyệt |
| **UC18** | Cập nhật thông tin khách sạn | Chủ khách sạn | **COMPLETE** | Cập nhật thông tin, tiện nghi, upload ảnh khách sạn |
| **UC19** | Xóa khách sạn | Chủ khách sạn | **COMPLETE** | Owner ngừng kinh doanh bằng soft-deactivation, giữ lịch sử booking |
| **UC20** | Thêm loại phòng | Chủ khách sạn | **COMPLETE** | Thêm loại phòng cho khách sạn sở hữu |
| **UC21** | Cập nhật loại phòng | Chủ khách sạn | **COMPLETE** | Cập nhật phòng, tiện nghi, ảnh, trạng thái mở/ngừng bán |
| **UC22** | Cập nhật thông tin quỹ phòng | Chủ khách sạn | **COMPLETE** | Bulk upsert giá và số lượng phòng theo ngày vào `QUY_PHONG_GIA` |
| **UC23** | Xóa loại phòng | Chủ khách sạn | **COMPLETE** | Owner ngừng bán loại phòng, giữ lịch sử booking |
| **UC24** | Xem danh sách đặt phòng KS | Chủ khách sạn | **COMPLETE** | Owner list/detail booking theo khách sạn sở hữu, có phân trang/lọc |
| **UC25** | Xem doanh thu | Chủ khách sạn | **COMPLETE** | Thống kê doanh thu gộp, hoàn tiền, doanh thu net theo KS |
| **UC26** | Xem báo cáo thống kê | Chủ KS / Admin | **COMPLETE** | Báo cáo tỷ lệ lấp đầy, top loại phòng, báo cáo hệ thống |
| **UC27** | Xem tài khoản | Quản trị hệ thống | **COMPLETE** | Danh sách và chi tiết tài khoản người dùng |
| **UC28** | Thêm tài khoản | Quản trị hệ thống | **COMPLETE** | Admin create-account form/route, backend RBAC và targeted UI/backend tests đã pass |
| **UC29** | Cập nhật tài khoản | Quản trị hệ thống | **COMPLETE** | Chỉnh sửa thông tin tài khoản từ trang quản trị |
| **UC30** | Khóa tài khoản | Quản trị hệ thống | **COMPLETE** | Khóa/Mở khóa tài khoản người dùng |
| **UC31** | Xóa tài khoản | Quản trị hệ thống | **COMPLETE** | Xóa cứng an toàn nếu chưa có giao dịch, nếu có thì khóa |
| **UC32** | Duyệt đăng ký kinh doanh KS | Quản trị hệ thống | **COMPLETE** | Phê duyệt hồ sơ đối tác, nâng role `Chủ khách sạn` trong transaction |
| **UC33** | Admin cập nhật thông tin KS | Quản trị hệ thống | **COMPLETE** | Admin list/detail/edit hotel, RBAC và targeted tests đã pass |
| **UC34** | Đình chỉ khách sạn | Quản trị hệ thống | **COMPLETE** | Suspend/reactivate, hotel bị loại khỏi public inventory khi suspend, targeted tests đã pass |
| **UC35** | Admin xem thông tin thanh toán| Quản trị hệ thống | **COMPLETE** | Admin payment list/detail read-only, filter/pagination, không trả dữ liệu nhạy cảm |
| **UC36** | Xem chi tiết đánh giá | Quản trị hệ thống | **COMPLETE** | Xem chi tiết đánh giá kèm khách hàng, khách sạn, hình ảnh |
| **UC37** | Xóa đánh giá vi phạm | Quản trị hệ thống | **COMPLETE** | `DELETE /api/admin/reviews/:id` safe-removes review đã gắn cờ vi phạm bằng trạng thái `Ẩn`, giữ lịch sử/ảnh audit |
| **UC38** | Xử lý hỗ trợ/khiếu nại | Quản trị hệ thống | **COMPLETE** | Tiếp nhận, xử lý, cập nhật trạng thái và kết quả hỗ trợ |
| **UC39** | Thêm mã khuyến mãi | Quản trị hệ thống | **COMPLETE** | Tạo mới mã khuyến mãi toàn hệ thống kèm ràng buộc ngày/% |
| **UC40** | Ngừng khuyến mãi | Quản trị hệ thống | **COMPLETE** | Hủy kích hoạt/ngừng áp dụng chương trình khuyến mãi |

### Tóm tắt tỷ lệ bao phủ:
- **COMPLETE:** **40 / 40** (100%)
- **PARTIAL:** **0 / 40** (0%)
- **MISSING:** **0 / 40** (0%)

---

## 9. Lưu ý về ảnh chụp backlog lịch sử

Các tiểu mục chi tiết còn lại trong phần này là ảnh chụp backlog trước Coverage Group 3/4/5 và chỉ giữ lại để truy vết. Chúng không ghi đè bảng coverage hiện tại ở trên. UC19, UC23, UC24, UC28, UC33, UC34, UC35 và UC37 đã được hoàn thiện ở các đợt sau.

### 9.0. Coverage Group 4 (đã hoàn thành)

- **UC28:** `/api/admin/accounts` được expose bằng `AdminCreateAccountPage` và route `/admin/accounts/new`; backend targeted test và frontend success/error test pass.
- **UC33/UC34:** `/api/admin/hotels` cung cấp list/detail/update cùng suspend/reactivate; chỉ Admin truy cập. Targeted test xác nhận Customer/Owner nhận `403`, hotel suspend biến mất khỏi public detail/inventory và reactivate khôi phục được.
- **UC35:** `/api/admin/payments` và `/:id` là read-only, có phân trang/lọc; UI list/detail không hiển thị hay API trả email, mật khẩu, signature/secret thanh toán.
- **OpenAPI:** đầy đủ các route admin accounts create, admin hotels và admin payments. Không thay đổi database schema; UC37 được xử lý riêng ở Coverage Group 5.

Các lệnh verify đã pass: backend/frontend lint, typecheck, build; backend Group 4 targeted tests 16/16; frontend Group 4 tests 7/7.

### 9.0.1. UC37 – Xóa đánh giá vi phạm (đã hoàn thành)

- **Semantics:** `DELETE /api/admin/reviews/:id` không hard-delete. Backend chỉ chuyển review đã `Vi phạm` sang trạng thái hiện có `Ẩn`; không nhận trạng thái từ request body và request lặp lại là idempotent.
- **Audit & public behavior:** `DANH_GIA` và `HINH_ANH_DANH_GIA` được giữ nguyên. Public hotel detail hiện không có review list/rating summary; targeted regression xác nhận nội dung review bị gỡ không xuất hiện ở read model public. Customer vẫn có thể xem review của chính booking mình qua API authenticated, không phải public endpoint.
- **UI/tests:** Admin list/detail có nút “Xóa/gỡ đánh giá vi phạm”, xác nhận trước khi thao tác và trạng thái loading/success/error/disabled. Backend review tests 18/18 và frontend UC37 tests 6/6 pass.
- **Database:** Không thay đổi schema, migration hoặc UC khác.

## 9 (archive). Chi Tiết Các Use Case Đang Có Vấn Đề Trước Group 3/4

Phần này cung cấp phân tích chi tiết cho AI coding tiếp theo khi được giao nhiệm vụ hoàn thiện các Use Case chưa đạt chuẩn `COMPLETE`.

### 9.1. Nhóm Use Case PARTIAL (2 Use Cases)

#### 1. UC28 – Thêm tài khoản (Admin)
- **Hiện đã có:**
  - Backend: Tuyến `POST /api/admin/accounts` đã hiện thực hoàn chỉnh (`AccountsController.create`, `AccountsService.create`, `createAccountSchema`), bảo vệ bởi `authenticate + requireAdmin`. Đã có integration test đầy đủ trong `accounts.test.ts`.
- **Điểm còn thiếu:**
  - Frontend: `frontend/src/features/admin/accounts/api.ts` chưa export hàm `createAccount`.
  - `frontend/src/routes/AppRoutes.tsx` chưa có tuyến `/admin/accounts/new` và chưa có trang/modal tạo tài khoản dành cho Admin.
- **Hạng mục cần làm:**
  - Bổ sung hàm gọi API `createAccount` trong frontend.
  - Thêm form/modal hoặc trang `AdminAccountCreatePage` cho phép Admin nhập họ tên, username, email, mật khẩu, số điện thoại, vai trò để tạo tài khoản mới.

#### 2. UC37 – Xóa đánh giá vi phạm (Admin)
- **Hiện đã có:**
  - Tuyến `PATCH /api/admin/reviews/:id/moderate` cho phép Admin cập nhật trạng thái đánh giá thành `Hiển thị`, `Ẩn`, hoặc `Vi phạm`.
  - Frontend trang `AdminReviewDetailPage.tsx` có các nút thao tác kiểm duyệt tương ứng.
- **Điểm còn thiếu:**
  - Chưa có hành vi/tuyến "Xóa" (`DELETE /api/admin/reviews/:id`) thực tế.
- **Phân tích ràng buộc:**
  - Theo Gate 0 (G0-10), dữ liệu có lịch sử không được hard delete tùy tiện vì có thể ảnh hưởng đến kiểm toán và tính toàn vẹn khóa ngoại với `DAT_PHONG`.
  - Cần thống nhất nghiệp vụ: Nếu "Xóa" chỉ là ẩn khỏi người dùng thì trạng thái `"Ẩn"` hoặc `"Vi phạm"` hiện tại đã đáp ứng đủ; nếu yêu cầu hard delete, cần xóa kèm hình ảnh trong `HINH_ANH_DANH_GIA` và Cloudinary, đồng thời xử lý quan hệ 1-1 với `DAT_PHONG`.

---

### 9.2. Nhóm Use Case MISSING (6 Use Cases)

#### 1. UC19 – Xóa khách sạn (Chủ khách sạn)
- **Hiện trạng:** Tuyệt đối chưa có route, controller, service hay nút bấm UI nào cho phép chủ khách sạn xóa hoặc ngừng kinh doanh khách sạn. (Lưu ý: Nút xóa ảnh đại diện ở UC18 không phải là xóa khách sạn).
- **Backend thiếu:** Tuyến `DELETE` hoặc `POST /api/owner/hotels/:id/deactivate`.
- **Frontend thiếu:** Hành động xóa/ngừng kinh doanh trên giao diện `OwnerHotelManagePage.tsx`.
- **Database & Ràng buộc:**
  - Bảng `KHACH_SAN` có nhiều quan hệ phụ thuộc (`LOAI_PHONG`, `DAT_PHONG`, `DANH_GIA`, `HINH_ANH_KHACH_SAN`) với khóa ngoại `ON DELETE NO ACTION`.
  - **Không được phép hard delete** khách sạn đã có lịch sử đặt phòng (vi phạm G0-10). Cần thiết kế theo hướng chuyển `KHACH_SAN.TrangThai = 'Ngừng hoạt động'` (soft-deactivate) và chỉ cho phép xóa cứng khi khách sạn chưa phát sinh bất kỳ booking nào.

#### 2. UC23 – Xóa loại phòng (Chủ khách sạn)
- **Hiện trạng:** Chỉ có cập nhật trạng thái loại phòng (`TrangThai = 'Hoạt động' | 'Ngừng bán'`) qua `PATCH /api/owner/room-types/:id`. Chưa có endpoint và nút xóa loại phòng.
- **Backend thiếu:** Tuyến xóa loại phòng trong `owner-room-types.routes.ts`.
- **Frontend thiếu:** Nút bấm và xác nhận xóa loại phòng trong `OwnerRoomTypeManagePage.tsx`.
- **Database & Ràng buộc:**
  - Bảng `LOAI_PHONG` có liên kết với `CHI_TIET_DAT_PHONG` và `QUY_PHONG_GIA`.
  - Nếu đã có đơn đặt phòng tham chiếu tới loại phòng, hard delete sẽ bị SQL Server chặn (`FK constraint`). Giải pháp chuẩn là kiểm tra: nếu chưa có booking thì cho phép xóa kèm dọn dẹp `QUY_PHONG_GIA` và `LOAI_PHONG_TIEN_NGHI`; nếu đã có booking thì chuyển sang trạng thái `"Ngừng bán"` vĩnh viễn.

#### 3. UC24 – Xem danh sách đặt phòng của khách sạn (Chủ khách sạn)
- **Hiện trạng:**
  - Khách hàng đã có `GET /api/bookings` (danh sách booking của tôi).
  - Chủ khách sạn **chưa có** tuyến tra cứu danh sách các đơn đặt phòng thuộc về khách sạn của mình.
- **Backend thiếu:** Tuyến `GET /api/owner/hotels/:id/bookings` (hoặc `GET /api/owner/bookings`), lọc theo khách sạn mà Caller sở hữu, hỗ trợ phân trang, lọc theo trạng thái booking và khoảng ngày nhận phòng.
- **Frontend thiếu:** Trang quản lý đơn đặt phòng cho Owner (`OwnerBookingsPage.tsx`) và menu điều hướng trên Dashboard của Owner.
- **Database & Ràng buộc:** Đọc từ `DAT_PHONG` join `CHI_TIET_DAT_PHONG`, bắt buộc kiểm tra `KHACH_SAN.MaTaiKhoanSoHuu === req.user.maTaiKhoan`.

#### 4. UC33 – Admin cập nhật thông tin khách sạn
- **Hiện trạng:** Chỉ có API của Chủ khách sạn cập nhật thông tin khách sạn của mình (`UC18`). Admin chưa có endpoint riêng để cập nhật thông tin khách sạn hoặc can thiệp thông tin kiểm định.
- **Backend thiếu:** Tuyến `PATCH /api/admin/hotels/:id` trong module quản trị.
- **Frontend thiếu:** Giao diện quản lý và chỉnh sửa khách sạn dành cho Quản trị viên.
- **Ràng buộc:** Khác với Owner (không được đổi trạng thái duyệt hay thông tin chủ sở hữu), Admin có quyền cập nhật các trường quản trị (`TrangThai`, `HangSao`, ghi chú kiểm định).

#### 5. UC34 – Đình chỉ khách sạn (Admin)
- **Hiện trạng:** Cột `KHACH_SAN.TrangThai` có hỗ trợ giá trị `'Đình chỉ'` nhưng chưa có API hay giao diện nào cho Admin thực hiện thao tác đình chỉ hoặc gỡ đình chỉ hoạt động của một khách sạn vi phạm.
- **Backend thiếu:** Tuyến `POST /api/admin/hotels/:id/suspend` và `POST /api/admin/hotels/:id/reactivate`.
- **Frontend thiếu:** Nút thao tác đình chỉ khách sạn trên giao diện quản trị Admin.
- **Nghiệp vụ liên đới:** Khi khách sạn bị đình chỉ, khách sạn phải bị ẩn khỏi kết quả tìm kiếm của khách vãng lai (`GET /api/hotels`), không cho phép tạo booking mới, nhưng các booking đã xác nhận từ trước vẫn phải giữ nguyên để đối soát và xử lý sau bán.

#### 6. UC35 – Admin xem thông tin thanh toán
- **Hiện trạng:** Admin hiện chỉ có báo cáo tài chính tổng hợp (`GET /api/admin/analytics`), hoàn toàn chưa có màn hình xem danh sách và chi tiết từng giao dịch thanh toán cụ thể.
- **Backend thiếu:** Tuyến `GET /api/admin/payments` (hỗ trợ phân trang, lọc theo mã giao dịch đối tác, phương thức, trạng thái, ngày) và `GET /api/admin/payments/:id` (chi tiết giao dịch kèm đơn đặt phòng, khách hàng, khách sạn và các lần hoàn tiền liên quan).
- **Frontend thiếu:** Trang `AdminPaymentsPage` và route tương ứng trong cổng Quản trị.
- **Database:** Đọc từ `THANH_TOAN` liên kết `DAT_PHONG`, `TAI_KHOAN`, `HOAN_TIEN`.

---

## 10. Chi Tiết Coverage Group 1 Đã Fix (UC03 & UC32)

Trong đợt cập nhật Coverage Group 1, hai Use Case cốt lõi liên quan đến chu trình đối tác đã được hoàn thiện và kiểm thử đạt chuẩn 10/10 test case:

### 10.1. UC03 – Đăng ký tài khoản đối tác (Customer Flow)
- **Endpoint:** `POST /api/partners/apply` (Bảo vệ bởi `authenticate`).
- **Quy trình:**
  1. Khách hàng nộp hồ sơ gồm: `SoCCCD`, `SoGiayPhepKinhDoanh`, `MaSoThue`, `TepGiayTo`.
  2. Service kiểm tra: Khách hàng chưa được có hồ sơ nào khác đang ở trạng thái `'Chờ duyệt'` hoặc `'Đã duyệt'`.
  3. Tạo bản ghi `HO_SO_DOI_TAC` với `TrangThaiDuyet = 'Chờ duyệt'`, `NgayNop = NOW()`, `MaTaiKhoan` lấy trực tiếp từ JWT caller (không tin body).
- **Theo dõi:** Tuyến `GET /api/partners/me` cho phép khách hàng theo dõi trạng thái hồ sơ của mình trên giao diện `/partner/apply` (`PartnerApplyPage.tsx`).

### 10.2. UC32 – Duyệt đăng ký kinh doanh khách sạn mới (Admin Flow)
- **Endpoints:**
  - `GET /api/admin/partner-applications`: Danh sách hồ sơ đối tác (phân trang, lọc theo trạng thái).
  - `GET /api/admin/partner-applications/:id`: Chi tiết hồ sơ nộp kèm thông tin tài khoản.
  - `POST /api/admin/partner-applications/:id/approve`: Phê duyệt hồ sơ.
  - `POST /api/admin/partner-applications/:id/reject`: Từ chối hồ sơ.
- **Logic Phê duyệt (Approve - Atomic Transaction):**
  - Chạy trong Prisma interactive transaction có guard:
    - Hồ sơ phải tồn tại và đang ở trạng thái `'Chờ duyệt'`.
    - Kiểm tra `NgayDuyet >= NgayNop`.
    - Cập nhật `TrangThaiDuyet = 'Đã duyệt'`.
    - Gán `MaTaiKhoanDuyet = req.user.maTaiKhoan` (Admin đang đăng nhập).
    - **Nâng quyền tài khoản:** Cập nhật `TAI_KHOAN.MaVaiTro` của người nộp hồ sơ sang vai trò `'Chủ khách sạn'` (`ROLE_NAMES.PARTNER`).
    - **Tuyệt đối không tự động tạo khách sạn:** Sau khi được cấp role Chủ khách sạn, người dùng sẽ tự vào cổng `/owner/hotels/new` để đăng ký khách sạn thông qua UC17.
- **Logic Từ chối (Reject):**
  - Yêu cầu bắt buộc phải có `LyDoTuChoi` (tối thiểu 1 ký tự).
  - Cập nhật `TrangThaiDuyet = 'Từ chối'`, `MaTaiKhoanDuyet = adminId`.
  - **Không** thay đổi vai trò của tài khoản (vẫn giữ là Khách hàng).
- **Kiểm chứng:** File test `backend/src/modules/partners/partners.test.ts` đã bao phủ 10 kịch bản (RBAC, submit, chống trùng lặp, danh sách admin, phê duyệt, gán đúng approver ID, cập nhật role, từ chối bắt buộc lý do, chống duyệt lại hồ sơ đã xử lý, rollback transaction khi lỗi).

---

## 11. Bản Đồ Tập Tin Trọng Yếu (Important File Map)

Tất cả đường dẫn dưới đây là **đường dẫn thực tế** trong kho mã nguồn:

### 11.1. Backend (`backend/`)
- **Khởi động & Cấu hình:**
  - `src/server.ts`: Điểm khởi chạy HTTP server.
  - `src/app.ts`: Khởi tạo Express app, cài đặt middleware (CORS, JSON 10MB, Cookie Parser).
  - `src/config/env.ts`: Zod schema thẩm định biến môi trường.
  - `src/config/prisma.ts`: Quản lý kết nối Prisma Client & Adapter SQL Server.
  - `src/config/openapi.ts`: Đặc tả OpenAPI 3.0.3 phục vụ route `GET /api/openapi.json`.
  - `src/routes/index.ts`: Điểm tập trung mount toàn bộ routes của hệ thống.
- **Middleware cốt lõi:**
  - `src/middleware/auth.middleware.ts`: `authenticate`, `requireRole`, `requireAdmin`.
  - `src/middleware/validate.middleware.ts`: Validate DTO qua Zod schema.
  - `src/middleware/error.middleware.ts`: Global error handler, chuẩn hóa response lỗi `AppError`.
- **Modules nghiệp vụ (`src/modules/`):**
  - `auth/`: `auth.routes.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.repository.ts`, `auth.schemas.ts`.
  - `email/`: `email.service.ts` định nghĩa `EmailService`, SMTP adapter Nodemailer và FakeEmailService dùng cho test UC04.
  - `partners/`: Xử lý nộp và duyệt hồ sơ đối tác (UC03, UC32).
  - `accounts/`: Quản trị tài khoản hệ thống (UC27–UC31).
  - `hotels/`: Tìm kiếm và xem chi tiết khách sạn (UC05, UC07, UC08).
  - `quotes/`: Báo giá tức thời và kiểm tra khuyến mãi (UC15).
  - `bookings/`: Đặt phòng, khóa chống overbooking, hủy phòng (UC09, UC11, UC12, UC13).
  - `payments/`: Thanh toán VNPAY, IPN webhook, hoàn tiền (UC10).
  - `owner/`: `owner-hotels.*`, `owner-room-types.*`, `owner-rates.*`, `owner-analytics.*` (UC17, UC18, UC20, UC21, UC22, UC25).
  - `reviews/`: Đánh giá khách sạn, kiểm duyệt review (UC14, UC36, UC37).
  - `support/`: Tiếp nhận và xử lý yêu cầu hỗ trợ (UC16, UC38).
  - `promotions/`: Quản trị mã khuyến mãi toàn hệ thống (UC39, UC40).
  - `analytics/`: Thống kê toàn diện hệ thống dành cho Admin (UC26).

### 11.2. Frontend (`frontend/`)
- **Khởi động & Điều hướng:**
  - `src/main.tsx`: Entrypoint của ứng dụng React.
  - `src/routes/AppRoutes.tsx`: Khai báo toàn bộ client-side routes và lazy loading.
  - `src/components/auth/ProtectedRoute.tsx`: Route guard phân quyền theo vai trò.
  - `src/services/apiClient.ts`: HTTP client xử lý auto-refresh token và interceptor.
  - `src/lib/authStore.ts`: Zustand store quản lý auth state và token.
- **Trang theo Actor (`src/pages/`):**
  - *Public / Guest:* `HomePage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `HotelListPage.tsx`, `HotelDetailPage.tsx`.
  - *Customer:* `ProfilePage.tsx`, `PartnerApplyPage.tsx`, `BookingsPage.tsx`, `BookingDetailPage.tsx`, `PaymentResultPage.tsx`, `SupportPage.tsx`, `SupportDetailPage.tsx`.
  - *Owner:* `OwnerDashboardPage.tsx`, `OwnerHotelFormPage.tsx`, `OwnerHotelManagePage.tsx`, `OwnerRoomTypeManagePage.tsx`, `OwnerAnalyticsPage.tsx`.
  - *Admin:* `AdminDashboardPage.tsx`, `AdminAccountsPage.tsx`, `AdminAccountDetailPage.tsx`, `AdminPartnerApplicationsPage.tsx`, `AdminPartnerApplicationDetailPage.tsx`, `AdminReviewsPage.tsx`, `AdminReviewDetailPage.tsx`, `AdminSupportPage.tsx`, `AdminSupportDetailPage.tsx`, `AdminPromotionsPage.tsx`, `AdminPromotionFormPage.tsx`, `AdminAnalyticsPage.tsx`.

### 11.3. Database (`database/`)
- **Migrations SQL Server (`database/migrations/`):**
  - `001_core_identity.sql`: Tạo `VAI_TRO`, `TAI_KHOAN`, `DIA_PHUONG`, `HO_SO_DOI_TAC`.
  - `002_hotel_catalog.sql`: Tạo `KHACH_SAN`, `HINH_ANH_KHACH_SAN`, `TIEN_NGHI`, `KHACH_SAN_TIEN_NGHI`.
  - `003_room_inventory.sql`: Tạo `LOAI_PHONG`, `HINH_ANH_LOAI_PHONG`, `LOAI_PHONG_TIEN_NGHI`, `QUY_PHONG_GIA`.
  - `004_commercial.sql`: Tạo `CHINH_SACH_HUY`, `CHI_TIET_CHINH_SACH_HUY`, `KHUYEN_MAI`.
  - `005_booking.sql`: Tạo `DAT_PHONG`, `CHI_TIET_DAT_PHONG`.
  - `006_payment_after_sales.sql`: Tạo `THANH_TOAN`, `HOAN_TIEN`, `DANH_GIA`, `HINH_ANH_DANH_GIA`, `YEU_CAU_HO_TRO`.
  - `007_indexes.sql`: Bổ sung 15 indexes tối ưu truy vấn cho M1–M8.
- **Tài liệu đặc tả & Seed:**
  - `database/DATABASE_SOURCE_CHAPTER_6_7.md`: Văn bản nguồn chính thống về thiết kế DB và Gate 0.
  - `database/docs/data-dictionary.md`: Từ điển dữ liệu chi tiết 22 bảng.
  - `database/docs/constraint-checklist.md`: Danh mục toàn bộ PK, FK, Unique, Check constraints.
  - `database/seed/001_roles.sql`: Dữ liệu seed 3 vai trò hệ thống.

---

## 12. Bối Cảnh Kiểm Thử (Testing Context)

### 12.1. Frameworks & Công Cụ
- **Backend:** `vitest` v3.0, `supertest` v7.0, mock data qua `backend/src/test/factories.ts`.
- **Frontend:** `vitest` v3.0, `@testing-library/react` v16.2, `@testing-library/user-event` v14.6, môi trường `jsdom`.

### 12.2. Phân loại các bộ Test hiện có trong kho mã nguồn
1. **Unit Tests (Kiểm thử hàm thuần túy):**
   - Backend: Kiểm thử tính hợp lệ JWT (`jwt.test.ts`), giải thuật VNPAY signature (`vnpay.test.ts`), tính toán phòng trống (`availability.test.ts`), xác định bậc hoàn tiền (`refund-policy.test.ts`), đánh giá khuyến mại (`promotion-pricing.test.ts`), kiểm định ảnh (`review-images.test.ts`), kiểm định mã khuyến mãi (`promotion-validation.test.ts`).
2. **Integration Tests (Kiểm thử tích hợp End-to-End API):**
   - Đầy đủ tại 29 file test trải rộng trên tất cả các module (`auth.test.ts`, `accounts.test.ts`, `partners.test.ts`, `hotels.test.ts`, `owner-hotels.test.ts`, `bookings.test.ts`, `payments.test.ts`, `reviews.test.ts`, `support.test.ts`,...).
3. **Critical Concurrency & Lock Tests:**
   - Tập trung tại `backend/src/modules/bookings/bookings.test.ts`: Giả lập các transaction đồng thời tranh chấp phòng trống để kiểm chứng khóa `UPDLOCK, ROWLOCK, HOLDLOCK` ngăn chặn thành công overbooking.
4. **Callback Idempotency Tests:**
   - Tập trung tại `backend/src/modules/payments/payments.test.ts`: Gọi lặp lại webhook IPN của cùng một giao dịch để chứng minh hệ thống không ghi nhận thanh toán hai lần.

### 12.3. Bằng chứng kiểm thử & Xác thực runtime
- **Mã nguồn kiểm thử có sẵn:** Toàn bộ test suite tồn tại đầy đủ trong repo.
- **Bằng chứng lịch sử:** Các báo cáo `m1-report.md` đến `m8-report.md` ghi nhận 100% test pass tại thời điểm hoàn thành từng milestone.
- **Lưu ý xác thực runtime hiện tại:** Việc thực thi toàn bộ integration test suite yêu cầu kết nối trực tiếp đến một instance Microsoft SQL Server khả dụng. Các bài kiểm thử đơn vị độc lập và kiểm tra lint/typecheck đều đã được xác thực đạt chuẩn.

---

## 13. Giới Hạn Đã Biết & Nợ Kỹ Thuật (Known Limitations / Tech Debt)

Khi tiếp quản dự án, lập trình viên AI cần nhận biết rõ các giới hạn sau để tránh nhầm lẫn:

1. ~~Tập tin cũ chưa gỡ bỏ (Legacy / Unwired Integration)~~ — **đã xử lý tại M9**: `backend/src/integrations/vnpay.integration.ts` (placeholder throw `planned for later phase`, không có route nào import) và `backend/src/config/database.ts` (pool `mssql` trực tiếp không dùng, đọc các biến `DB_*` không qua Zod validation) đã được xóa hoàn toàn. Mã nguồn thanh toán VNPAY thực tế vẫn nằm tại `backend/src/modules/payments/vnpay.ts` và `refund-gateway.ts`.
2. **Môi trường Gateway VNPAY:**
   - Trong môi trường dev, các biến `VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` mang giá trị cấu hình sandbox. Các bài unit test sử dụng cơ chế fake gateway để tránh phụ thuộc vào đường truyền mạng VNPAY.
3. ~~Xóa ảnh khác với xóa khách sạn/loại phòng~~ — **đã lỗi thời**: UC19 (`POST /owner/hotels/:id/deactivate`) và UC23 (`POST /owner/room-types/:id/deactivate`) đã hoàn thiện từ Coverage Group trước M9 (soft-deactivate, giữ lịch sử). Xem mục 8 (UC Matrix) — hai endpoint này cũng vừa được bổ sung vào OpenAPI tại M9 (trước đó bị thiếu trong spec dù đã hoạt động).
4. **Giới hạn trường thời gian trên bảng DANH_GIA:**
   - Bảng `DANH_GIA` trong thiết kế cơ sở dữ liệu không có cột `NgayTao`. Do đó, trong báo cáo Admin Analytics, số liệu đánh giá được tổng hợp trên phạm vi **toàn thời gian** chứ không lọc theo khoảng ngày (`from`/`to`).

---

## 14. Quy Tắc Bắt Buộc Dành Cho AI Coding Tiếp Theo

Để bảo toàn tính toàn vẹn của dự án, mọi AI coding assistant khi thực hiện nhiệm vụ mới **BẮT BUỘC TUÂN THỦ 9 NGUYÊN TẮC SAU**:

1. **Đọc tài liệu này đầu tiên:** Luôn nắm vững `docs/PROJECT_CONTEXT.md` trước khi phân tích bất kỳ bài toán cụ thể nào.
2. **Khảo sát mã nguồn thực tế trước khi sửa:** Đọc kỹ Controller, Service, Repository và DTO của module liên quan. Tránh đưa ra giả định khi chưa xem code.
3. **Đối chiếu Use Case Audit:** Nếu nhiệm vụ liên quan đến việc triển khai hoặc sửa đổi Use Case (từ UC01 đến UC40), bắt buộc đối chiếu với `docs/usecase-coverage-audit.md` để nắm rõ phạm vi và các tiêu chí nghiệm thu.
4. **Không tự ý thay đổi Database Schema:** Tuyệt đối không chỉnh sửa `backend/prisma/schema.prisma` hoặc tạo migration SQL mới nếu yêu cầu không thuộc quy trình Change Gate được phê duyệt.
5. **Bảo toàn các quy tắc Gate 0 đã khóa:** Tuyệt đối không tái tạo `KHUYEN_MAI_KHACH_SAN`, không tạo `CHI_TIET_GIA_DAT_PHONG`, không thêm cột `MaDatPhong` vào `CHINH_SACH_HUY`, và không tạo role cho CSKH.
6. **Backend là nguồn thẩm quyền tối cao (Server Authority):** Toàn bộ quyền hạn, tính toán giá phòng, khuyến mãi, tính khả dụng phòng trống và xác nhận thanh toán phải do Backend chịu trách nhiệm. Không bao giờ tin tưởng dữ liệu tổng tiền gửi lên từ phía client.
7. **Thực thi nghiêm ngặt Phân quyền & Sở hữu (RBAC & Ownership):** Mọi endpoint nghiệp vụ phải có middleware xác thực và kiểm tra sở hữu ở tầng Service. Đảm bảo Customer chỉ xem được dữ liệu của mình, Partner chỉ quản lý khách sạn của mình, và chỉ Admin mới truy cập được tuyến `/api/admin/*`.
8. **Ưu tiên đổi trạng thái / Soft Delete:** Khi hiện thực các chức năng xóa (UC19, UC23, UC31, UC37), luôn ưu tiên chuyển đổi trạng thái (`TrangThai`) đối với các thực thể đã có lịch sử liên kết nhằm bảo toàn dữ liệu giao dịch.
9. **Cập nhật tài liệu bối cảnh sau khi hoàn thành:** Nếu một Use Case chuyển từ `MISSING`/`PARTIAL` sang `COMPLETE`, hoặc có sự thay đổi quan trọng về mặt kiến trúc, hãy cập nhật lại `docs/PROJECT_CONTEXT.md` và `docs/usecase-coverage-audit.md` để duy trì tính chuẩn xác cho các phiên làm việc tiếp theo.
