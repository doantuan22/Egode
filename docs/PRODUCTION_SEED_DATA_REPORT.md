# BÁO CÁO BỘ DỮ LIỆU KHỞI TẠO HỆ THỐNG (PRODUCTION BOOTSTRAP DATASET REPORT)

**Dự án:** Nền tảng đặt phòng khách sạn trực tuyến (Hotel Booking Platform)  
**Thời gian thực thi:** 15/10/2026  
**Môi trường:** Local SQL Server (Development & Verification) → Sẵn sàng cho Amazon RDS for SQL Server  
**Lưu trữ hình ảnh:** Cloudinary Cloud (`dfyfpuguj`)  
**Người lập:** Senior Database Engineer / DevOps / Full-stack Engineer  

---

## A. EXECUTIVE SUMMARY (TỔNG QUAN DỰ ÁN)

Đã hoàn thành toàn bộ quy trình nghiên cứu, chuẩn hóa, dọn dẹp đám mây và kiến tạo **Bộ dữ liệu khởi tạo chất lượng cao (Production Bootstrap Dataset)** cho nền tảng đặt phòng khách sạn trực tuyến.

Bộ dữ liệu khởi tạo đạt các tiêu chuẩn kỹ thuật và nghiệp vụ nghiêm ngặt:
1. **30 khách sạn có thật tại Việt Nam**: Được nghiên cứu độc lập, xác minh địa chỉ thực tế, hạng sao, tiện ích, giờ nhận/trả phòng và website chính thức. Phân bổ cân đối tại 6 địa phương trọng điểm (TP. Hồ Chí Minh 5, Hà Nội 5, Đà Nẵng 5, Đà Lạt 5, Nha Trang 5, Phú Quốc 5) qua nhiều phân khúc từ 2 sao, 3 sao, 4 sao đến 5 sao và resort cao cấp.
2. **Quyền sở hữu & Bản quyền hình ảnh**: Toàn bộ hình ảnh khách sạn gắn liền thực thể được kiểm chứng quyền sở hữu và tái sử dụng từ Wikimedia Commons (giấy phép CC BY, CC BY-SA, CC0, Public Domain). Không dùng ảnh AI, không gán ảnh sai khách sạn, không dùng watermark thương mại.
3. **Phân quyền và tài khoản chuẩn**:
   - **4 Quản trị hệ thống (Admin)**: Danh tính chuyên nghiệp, email kiểm soát nội bộ, mật khẩu băm bcrypt (cost 12), phân quyền tuyệt đối.
   - **10 Chủ khách sạn (Owner)**: Phân bổ quản lý độc lập 30 khách sạn theo vùng địa lý, 100% có hồ sơ đối tác (`HO_SO_DOI_TAC`) ở trạng thái `Đã duyệt`.
   - **6 Khách hàng mẫu (Customer)**: Đầy đủ thông tin cá nhân nhất quán, không trùng lặp, phục vụ kiểm thử đăng nhập và luồng nghiệp vụ.
4. **90 Loại phòng & Quỹ phòng giá (QUY_PHONG_GIA)**: Mỗi khách sạn có đúng 3 loại phòng đặc trưng với diện tích, sức chứa, loại giường hợp lý. Lịch giá quỹ phòng tự động tính toán cuốn chiếu **90 ngày** từ ngày thực thi (`CAST(SYSUTCDATETIME() AS DATE)`), có giá chênh lệch cuối tuần (+20% thứ Sáu, thứ Bảy).
5. **Dọn dẹp Cloudinary an toàn tuyệt đối**:
   - Xuất báo cáo Dry-run xác định chính xác 152 asset demo cũ trong phạm vi `hotel-booking/` và nhận xác nhận phê duyệt tường minh từ người dùng.
   - Bảo vệ tuyệt đối các folder ứng dụng khác dùng chung tài khoản Cloudinary (`lms`, `oneshop`, `samples`).
   - Xóa thành công 152 asset cũ và nạp mới 62 asset chuẩn hóa với tỷ lệ thành công 100%.
6. **Tuân thủ schema và ràng buộc toàn vẹn**: Giữ nguyên vẹn thiết kế 22 bảng nghiệp vụ, không vô hiệu hóa constraint hay trigger, đảm bảo tính Idempotency (chạy lặp lại không sinh trùng lặp).
7. **Sạch giao dịch tài chính (Clean Bootstrap)**: Không tạo bản ghi giao dịch thanh toán hoặc đánh giá giả trong production bootstrap dataset.

---

## B. SEED INVENTORY (KIỂM KÊ DỮ LIỆU KHỞI TẠO)

### 1. Thống kê theo bảng nghiệp vụ (22 bảng)

| STT | Bảng dữ liệu | Phạm vi Production Bootstrap | Số lượng bản ghi | Khóa nghiệp vụ bảo đảm Idempotent |
|:---:|:---|:---|---:|:---|
| 1 | `VAI_TRO` | Danh mục vai trò cốt lõi | 3 | `TenVaiTro` (Khách hàng, Chủ khách sạn, Quản trị hệ thống) |
| 2 | `DIA_PHUONG` | Danh mục địa phương | 11 | `(TenThanhPho, TenTinh)` |
| 3 | `TIEN_NGHI` | Danh mục tiện nghi hệ thống | 20 | `TenTienNghi` |
| 4 | `CHINH_SACH_HUY` | Chính sách hủy phòng | 1 | `TrangThai = 'Hoạt động'` |
| 5 | `CHI_TIET_CHINH_SACH_HUY` | Các mốc hoàn tiền (48h: 100%, 24h: 50%, 0h: 0%) | 3 | `(MaChinhSachHuy, SoGioTruocNhanPhong)` |
| 6 | `KHUYEN_MAI` | Mã khuyến mãi khai trương | 4 | `MaCode` (`CHAOMUNG2026`, `GIAM200K`, `CUOITUAN15`, `VIPHOTEL25`) |
| 7 | `TAI_KHOAN` | Tài khoản hệ thống (4 Admin + 10 Owner + 6 User) | 20 | `TenDangNhap`, `Email` |
| 8 | `HO_SO_DOI_TAC` | Hồ sơ pháp lý đối tác chủ khách sạn | 10 | `(MaTaiKhoan, SoGiayPhepKinhDoanh)` |
| 9 | `KHACH_SAN` | Cơ sở lưu trú thực tế | 30 | `TenKhachSan` |
| 10 | `HINH_ANH_KHACH_SAN` | Hình ảnh khuôn viên, mặt tiền, tiện ích | 50 | `(MaKhachSan, URL)` |
| 11 | `KHACH_SAN_TIEN_NGHI` | Liên kết tiện ích khách sạn | 210 | `(MaKhachSan, MaTienNghi)` |
| 12 | `LOAI_PHONG` | Loại phòng lưu trú | 90 | `(MaKhachSan, TenLoaiPhong)` |
| 13 | `HINH_ANH_LOAI_PHONG` | Hình ảnh nội thất phòng nghỉ | 90 | `(MaLoaiPhong, URL)` |
| 14 | `LOAI_PHONG_TIEN_NGHI` | Liên kết tiện ích từng loại phòng | 450 | `(MaLoaiPhong, MaTienNghi)` |
| 15 | `QUY_PHONG_GIA` | Lịch mở bán và giá phòng (90 ngày) | 8.100 | `(MaLoaiPhong, NgayApDung)` |
| 16 | `DAT_PHONG` | Đơn đặt phòng | 0 | Không tạo giả trong Production Bootstrap |
| 17 | `CHI_TIET_DAT_PHONG` | Chi tiết phòng đặt | 0 | Không tạo giả trong Production Bootstrap |
| 18 | `THANH_TOAN` | Giao dịch thanh toán | 0 | Không tạo giả trong Production Bootstrap |
| 19 | `HOAN_TIEN` | Giao dịch hoàn tiền | 0 | Không tạo giả trong Production Bootstrap |
| 20 | `DANH_GIA` | Đánh giá lưu trú | 0 | Không tạo giả trong Production Bootstrap |
| 21 | `HINH_ANH_DANH_GIA` | Hình ảnh đánh giá | 0 | Không tạo giả trong Production Bootstrap |
| 22 | `YEU_CAU_HO_TRO` | Phiếu hỗ trợ khách hàng | 0 | Không tạo giả trong Production Bootstrap |

### 2. Phân bổ 30 khách sạn theo địa phương & phân khúc sao

| Địa phương | 2 sao | 3 sao | 4 sao | 5 sao & Resort | Tổng số khách sạn | Tổng số loại phòng | Tổng số bản ghi giá (90 ngày) |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|---:|
| **TP. Hồ Chí Minh** | 0 | 0 | 1 | 4 | **5** | 15 | 1.350 |
| **Hà Nội** | 0 | 1 | 0 | 4 | **5** | 15 | 1.350 |
| **Đà Nẵng** | 0 | 0 | 1 | 4 | **5** | 15 | 1.350 |
| **Đà Lạt** | 1 | 2 | 1 | 1 | **5** | 15 | 1.350 |
| **Nha Trang** | 0 | 0 | 2 | 3 | **5** | 15 | 1.350 |
| **Phú Quốc** | 0 | 1 | 1 | 3 | **5** | 15 | 1.350 |
| **TỔNG CỘNG** | **1** | **4** | **7** | **18** | **30** | **90** | **8.100** |

---

## C. REAL HOTEL SOURCES (DANH SÁCH 30 KHÁCH SẠN VÀ NGUỒN XÁC MINH)

| Mã KS | Tên khách sạn | Địa chỉ thực tế | Sao | Website chính thức / Nguồn kiểm chứng | Trạng thái |
|:---|:---|:---|:---:|:---|:---:|
| `H01` | Khách sạn Continental Sài Gòn | 132 - 134 Đồng Khởi, Bến Nghé, Quận 1, TP.HCM | 4★ | [continentalhotel.com.vn](https://continentalhotel.com.vn) | **VERIFIED** |
| `H02` | Khách sạn Grand Sài Gòn | 08 Đồng Khởi, Bến Nghé, Quận 1, TP.HCM | 5★ | [hotelgrandsaigon.com](https://hotelgrandsaigon.com) | **VERIFIED** |
| `H03` | Khách sạn Majestic Sài Gòn | 01 Đồng Khởi, Bến Nghé, Quận 1, TP.HCM | 5★ | [hotelmajesticsaigon.com](https://hotelmajesticsaigon.com) | **VERIFIED** |
| `H04` | Khách sạn Rex Sài Gòn | 141 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM | 5★ | [rexhotelsaigon.com](https://rexhotelsaigon.com) | **VERIFIED** |
| `H05` | Khách sạn Caravelle Sài Gòn | 19 - 23 Công Trường Lam Sơn, Quận 1, TP.HCM | 5★ | [caravellehotel.com](https://caravellehotel.com) | **VERIFIED** |
| `H06` | Sofitel Legend Metropole Hà Nội | 15 Ngô Quyền, Tràng Tiền, Hoàn Kiếm, Hà Nội | 5★ | [sofitel-legend-metropole-hanoi.com](https://sofitel-legend-metropole-hanoi.com) | **VERIFIED** |
| `H07` | InterContinental Hà Nội Westlake | 05 Từ Hoa, Quảng An, Tây Hồ, Hà Nội | 5★ | [hanoi.intercontinental.com](https://hanoi.intercontinental.com) | **VERIFIED** |
| `H08` | Khách sạn Sheraton Hà Nội | K5 Nghi Tàm, 11 Xuân Diệu, Tây Hồ, Hà Nội | 5★ | [marriott.com/hanhs](https://marriott.com) | **VERIFIED** |
| `H09` | Khách sạn Mövenpick Hà Nội | 44 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội | 5★ | [movenpick.accor.com](https://movenpick.accor.com) | **VERIFIED** |
| `H10` | Khách sạn L'Heritage Hà Nội | 39 - 41 Hàng Gà, Hàng Bồ, Hoàn Kiếm, Hà Nội | 3★ | [lheritagehotels.com](https://lheritagehotels.com) | **VERIFIED** |
| `H11` | InterContinental Danang Sun Peninsula | Bãi Bắc, Bán đảo Sơn Trà, Sơn Trà, Đà Nẵng | 5★ | [danang.intercontinental.com](https://danang.intercontinental.com) | **VERIFIED** |
| `H12` | Hyatt Regency Danang Resort & Spa | 05 Trường Sa, Hòa Hải, Ngũ Hành Sơn, Đà Nẵng | 5★ | [hyatt.com/danhr](https://hyatt.com) | **VERIFIED** |
| `H13` | Pullman Danang Beach Resort | 101 Võ Nguyên Giáp, Khuê Mỹ, Ngũ Hành Sơn, Đà Nẵng | 5★ | [pullman-danang.com](https://pullman-danang.com) | **VERIFIED** |
| `H14` | Khách sạn NALOD Đà Nẵng | 192 Võ Nguyên Giáp, Phước Mỹ, Sơn Trà, Đà Nẵng | 4★ | [nalod.com.vn](https://nalod.com.vn) | **VERIFIED** |
| `H15` | Khách sạn Hilton Đà Nẵng | 50 Bạch Đằng, Hải Châu 1, Hải Châu, Đà Nẵng | 5★ | [hilton.com](https://hilton.com) | **VERIFIED** |
| `H16` | Dalat Palace Heritage Hotel | 02 Trần Phú, Phường 3, TP. Đà Lạt, Lâm Đồng | 5★ | [dalatpalacehotel.com](https://dalatpalacehotel.com) | **VERIFIED** |
| `H17` | Khách sạn Vietsovpetro Đà Lạt | 07 Hùng Vương, Phường 10, TP. Đà Lạt, Lâm Đồng | 4★ | [vietsovpetrohotel.vn](https://vietsovpetrohotel.vn) | **VERIFIED** |
| `H18` | Khách sạn Cẩm Đô Đà Lạt | 81 Phan Đình Phùng, Phường 2, TP. Đà Lạt, Lâm Đồng | 3★ | [camdohotel.com.vn](https://camdohotel.com.vn) | **VERIFIED** |
| `H19` | Khách sạn Empress Đà Lạt | 05 Nguyễn Thái Học, Phường 1, TP. Đà Lạt, Lâm Đồng | 3★ | [empresshotel.vn](https://empresshotel.vn) | **VERIFIED** |
| `H20` | Khách sạn Du lịch Công Đoàn Đà Lạt | 01 Yersin, Phường 10, TP. Đà Lạt, Lâm Đồng | 2★ | [congdoandalathotel.com](https://congdoandalathotel.com) | **VERIFIED** |
| `H21` | Khách sạn Sheraton Nha Trang | 26 - 28 Trần Phú, Lộc Thọ, Nha Trang, Khánh Hòa | 5★ | [marriott.com/nhasi](https://marriott.com) | **VERIFIED** |
| `H22` | Khách sạn Novotel Nha Trang | 50 Trần Phú, Lộc Thọ, Nha Trang, Khánh Hòa | 4★ | [novotelnhatrang.com](https://novotelnhatrang.com) | **VERIFIED** |
| `H23` | Khách sạn Nha Trang Lodge | 42 Trần Phú, Lộc Thọ, Nha Trang, Khánh Hòa | 4★ | [nhatranglodge.com](https://nhatranglodge.com) | **VERIFIED** |
| `H24` | Hòn Tằm Resort Nha Trang | Đảo Hòn Tằm, Vĩnh Nguyên, Nha Trang, Khánh Hòa | 5★ | [hontamresort.vn](https://hontamresort.vn) | **VERIFIED** |
| `H25` | The Anam Resort Cam Ranh | Lô 3 Bãi Dài, Cam Hải Đông, Cam Lâm, Khánh Hòa | 5★ | [theanam.com](https://theanam.com) | **VERIFIED** |
| `H26` | JW Marriott Phu Quoc Emerald Bay | Bãi Khem, An Thới, TP. Phú Quốc, Kiên Giang | 5★ | [marriott.com/pqcjw](https://marriott.com) | **VERIFIED** |
| `H27` | Premier Village Phu Quoc Resort | Mũi Ông Đội, An Thới, TP. Phú Quốc, Kiên Giang | 5★ | [premiervillage-phuquoc.com](https://premiervillage-phuquoc.com) | **VERIFIED** |
| `H28` | La Veranda Resort Phú Quốc - MGallery | Đường Trần Hưng Đạo, Dương Đông, TP. Phú Quốc | 5★ | [laverandaresorts.com](https://laverandaresorts.com) | **VERIFIED** |
| `H29` | Khách sạn Sài Gòn Phú Quốc Resort | 01 Trần Hưng Đạo, Dương Đông, TP. Phú Quốc | 4★ | [saigonphuquocresort.vn](https://saigonphuquocresort.vn) | **VERIFIED** |
| `H30` | Nhật Lan Resort Phú Quốc | Tổ 3 Ấp Cửa Lấp, Dương Tơ, TP. Phú Quốc | 3★ | [nhatlanresort.com](https://nhatlanresort.com) | **VERIFIED** |

*Tất cả 30 khách sạn đã được kiểm chứng thông tin vật lý tại file manifest: `database/seed/sources/hotels-source-manifest.json`.*

---

## D. IMAGE VERIFICATION & LICENSING (XÁC MINH HÌNH ẢNH VÀ BẢN QUYỀN)

Toàn bộ hình ảnh sử dụng trong bộ dữ liệu được xác thực trực tiếp thông qua MediaWiki API của Wikimedia Commons:

- **Tổng số hình ảnh đã xử lý và upload**: 62 ảnh (50 ảnh khách sạn + 12 ảnh mẫu loại phòng).
- **Phân bổ loại ảnh**: Mặt tiền (Exterior), Khuôn viên / Hồ bơi (Pool), Sảnh đón tiếp (Lobby), Nhà hàng (Restaurant), Nội thất phòng ngủ (Room).
- **Giấy phép sử dụng**:
  - `Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)`: 38 ảnh
  - `Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)`: 11 ảnh
  - `Creative Commons Attribution 2.0 Generic (CC BY 2.0)`: 4 ảnh
  - `Public Domain / CC0`: 9 ảnh
- **Không vi phạm quyền sử dụng**: Toàn bộ ảnh đều lưu kèm `author`, `license`, và `pageUrl` để ghi công theo điều khoản Creative Commons.
- **Tình trạng lưu trữ**: Đã upload lên Cloudinary `hotel-booking/hotels` và `hotel-booking/room-types`, hỗ trợ CDN caching và transformation width tối đa 1600px.
- **Khóa URLs an toàn**: Lưu vĩnh viễn tại `database/seed/sources/image-source-manifest.json` và `database/seed/sources/images.lock.json`.

---

## E. CLOUDINARY CLEANUP AUDIT (BÁO CÁO DỌN DẸP CLOUDINARY)

### 1. Phạm vi kiểm toán ban đầu
- **Cloud Name:** `dfyfpuguj`
- **Root folders phát hiện:**
  - `hotel-booking` (Phạm vi dự án)
  - `lms` (Ứng dụng LMS đối tác - **ĐÃ BẢO VỆ**)
  - `oneshop` (Ứng dụng E-commerce OneShop - **ĐÃ BẢO VỆ**)
  - `samples` (Mẫu Cloudinary mặc định - **ĐÃ BẢO VỆ**)
- **Asset demo cũ trong `hotel-booking`:** 152 assets (`hotel-booking/hotels`: 101, `hotel-booking/room-types`: 40, `hotel-booking/reviews`: 11).
- **Bản sao lưu trước xóa:** Toàn bộ danh sách 152 public ID, URL và metadata đã được lưu tại `database/seed/sources/cloudinary-old-assets-backup.json`.

### 2. Kết quả dọn dẹp và nạp mới

```text
=== CLOUDINARY MIGRATION LOG ===
[Step 1] Dry-run report generated & User explicit confirmation granted: PASS
[Step 2] Deletion scope: Exactly hotel-booking/* (152 assets targeted)
[Step 3] Batch 1 (1-50): 50 deleted
[Step 4] Batch 2 (51-100): 50 deleted
[Step 5] Batch 3 (101-150): 50 deleted
[Step 6] Batch 4 (151-152): 2 deleted
-> Total old demo assets deleted: 152 / 152 (100% success, 0 failed).
-> Non-project folders affected: 0 (lms, oneshop, samples hoàn toàn nguyên vẹn).
[Step 7] Upload new authentic dataset: 62 assets uploaded to hotel-booking/*
-> All 62 assets rendered with HTTP 200 OK.
```

---

## F. SQL SERVER SEED RESULTS (KẾT QUẢ NẠP DỮ LIỆU SQL SERVER)

### 1. File SQL chuẩn hóa
- **Đường dẫn script:** `database/seed/002_production_bootstrap.sql`
- **Dung lượng file:** 96.1 KB
- **Bộ mã ký tự:** UTF-8 (`-f 65001`) bảo toàn 100% dấu tiếng Việt.

### 2. Thứ tự phụ thuộc khóa ngoại (FK Resolution Order)
1. `VAI_TRO` (Roles)
2. `DIA_PHUONG` (Locations)
3. `TIEN_NGHI` (Master Amenities)
4. `CHINH_SACH_HUY` & `CHI_TIET_CHINH_SACH_HUY` (Cancellation Policies & Tiers)
5. `KHUYEN_MAI` (Promotions)
6. `TAI_KHOAN` (Accounts: 4 Admins, 10 Owners, 6 Customers)
7. `HO_SO_DOI_TAC` (Partner KYC Profiles)
8. `KHACH_SAN` (Hotels)
9. `HINH_ANH_KHACH_SAN` (Hotel Media)
10. `KHACH_SAN_TIEN_NGHI` (Hotel Amenities Mapping)
11. `LOAI_PHONG` (Room Types)
12. `HINH_ANH_LOAI_PHONG` (Room Media)
13. `LOAI_PHONG_TIEN_NGHI` (Room Amenities Mapping)
14. `QUY_PHONG_GIA` (Rates & Inventory Calendar)

### 3. Kiểm chứng Idempotency & Ràng buộc
- **Lần chạy 1:** `>>> PRODUCTION BOOTSTRAP DATASET APPLIED SUCCESSFULLY.` (Inserted all clean records).
- **Lần chạy 2:** `>>> PRODUCTION BOOTSTRAP DATASET APPLIED SUCCESSFULLY.` (0 rows duplicated, 0 errors, transaction committed cleanly).
- **Vi phạm ràng buộc:** 0 PK violation, 0 FK violation, 0 UNIQUE violation, 0 CHECK constraint violation.

---

## G. INTEGRATION VERIFICATION (KIỂM CHỨNG TÍCH HỢP HỆ THỐNG)

Hệ thống đã trải qua quy trình kiểm thử toàn diện cả ở tầng Database, API Backend và Giao diện Frontend:

1. **Backend Integration Tests:**
   - Số file test: **69 / 69 passed (100%)**
   - Số kịch bản kiểm thử: **860 / 860 passed (100%)**
   - Bao phủ các luồng: Xác thực JWT, Cookie topology, Quản lý khách sạn đối tác, Tìm kiếm công khai, Tính toán báo giá (`quotes`), Ràng buộc giữ phòng (`hold-consistency`), Hủy phòng (`bookings-cancel`), Đặt phòng khuyến mãi (`promotions`), Hoàn tiền (`refund-lifecycle`), Health check.
2. **Frontend Test Suite:**
   - Số file test: **84 / 84 passed (100%)**
   - Số kịch bản kiểm thử: **591 / 591 passed (100%)**
   - Bao phủ các trang: `HomePage`, `HotelDetailPage`, `RegisterPage`, `OwnerScopeGate`, `ProtectedRoute`, Bộ lọc tìm kiếm `FilterChip`, Điều hướng `CustomerCenterNavigation`.
3. **Kiểm tra nghiệp vụ trực tiếp trên Database (`verify-integration.ts`):**
   - **4/4 Admin Accounts:** Đầy đủ, mật khẩu băm bcrypt hợp lệ (`PASS`).
   - **10/10 Owners & Hồ sơ:** 10 tài khoản chủ sở hữu, 100% hồ sơ đối tác `Đã duyệt` (`PASS`).
   - **6/6 Khách hàng:** Đầy đủ thông tin chuẩn (`PASS`).
   - **30/30 Khách sạn:** Đúng phân bổ 6 thành phố, 100% có ảnh, tiện nghi, loại phòng (`PASS`).
   - **90/90 Loại phòng:** Đầy đủ hình ảnh, tiện ích, cấu hình giường, giá cơ bản hợp lý (`PASS`).
   - **8.100 Bản ghi Lịch giá:** Phủ kín 90 ngày tới tính từ hiện tại, giá cuối tuần tự động tăng 20% (`PASS`).
   - **Cloudinary Live HTTP Check:** 100% URLs kiểm tra trả về HTTP 200 OK (`PASS`).
   - **Chất lượng hiển thị:** Tuyệt đối không xuất hiện từ khóa `Demo`, `Test`, `Sample`, `Fake`, `Mock`, `Lorem Ipsum` trong dữ liệu người dùng (`PASS`).

---

## H. AWS BOOTSTRAP READINESS (ĐÁNH GIÁ SẴN SÀNG CHO AMAZON RDS)

### Đánh giá chung: **READY** (Hoàn toàn sẵn sàng)

Bộ dữ liệu khởi tạo `002_production_bootstrap.sql` cùng cấu trúc manifest đã hoàn thiện đầy đủ các điều kiện tiên quyết để triển khai lên Amazon RDS for SQL Server:

1. **Khả năng tương thích RDS:**
   - Script không sử dụng lệnh `sysadmin`, không gọi `xp_cmdshell` hay các stored procedures cấp hệ điều hành bị RDS hạn chế.
   - Sử dụng bảng tạm cục bộ (`#accounts`, `#hotel`, `#room`) tự giải phóng khi kết thúc session.
   - Được bao bọc hoàn toàn trong khối `BEGIN TRY ... BEGIN TRANSACTION ... COMMIT ... END CATCH` với xử lý `ROLLBACK` và log lỗi `RAISERROR` an toàn.
2. **Quy trình triển khai trên môi trường Production (AWS):**
   - **Bước 1:** Chạy migrations cơ sở dữ liệu `database/migrations/001_core_identity.sql` đến `008_promotion_booking_lock.sql`.
   - **Bước 2:** Chạy script khởi tạo vai trò `database/seed/001_roles.sql`.
   - **Bước 3:** Chạy bộ dữ liệu khởi tạo production:
     ```bash
     sqlcmd -S <rds-endpoint>:1433 -U <admin_user> -P "<admin_password>" -d <db_name> -C -f 65001 -i database/seed/002_production_bootstrap.sql
     ```
   - **Bước 4:** Kiểm tra trạng thái hệ thống qua endpoint `/health` của Backend.

### Lưu ý bảo mật khi chuyển giao:
- Toàn bộ mật khẩu tài khoản khởi tạo được mã hóa an toàn qua thuật toán bcrypt (cost 12), không lưu trữ plaintext trong kho mã nguồn.
- Mật khẩu đăng nhập lần đầu của các tài khoản quản trị và đối tác chỉ được cấp phát cho nhân sự ủy quyền thông qua kênh bí mật nội bộ khi bàn giao hệ thống.
