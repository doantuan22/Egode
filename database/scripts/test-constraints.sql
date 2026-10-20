-- Kiểm thử các ràng buộc của schema trong một giao dịch luôn rollback

SET NOCOUNT ON;
SET XACT_ABORT OFF;
DECLARE @FailCount INT = 0;

BEGIN TRY
BEGIN TRANSACTION;

-- Tạo các dòng cha tối thiểu cho các bài kiểm tra
DECLARE @RunToken VARCHAR(10) = RIGHT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 10);
DECLARE @TestUserName NVARCHAR(50) = N'test_user_' + @RunToken;
DECLARE @TestEmail NVARCHAR(255) = N'test_user_' + @RunToken + N'@example.com';
DECLARE @BookingCode VARCHAR(20) = 'CT' + @RunToken;

INSERT INTO VAI_TRO (TenVaiTro, MoTa) VALUES (N'TestRole_' + @RunToken, N'Test role for constraint checks');
DECLARE @MaVaiTro INT = SCOPE_IDENTITY();

INSERT INTO TAI_KHOAN (MaVaiTro, TenDangNhap, Email, MatKhau, HoTen, SoDienThoai, NgaySinh, GioiTinh, AnhDaiDien, TrangThai, NgayTao, NgayCapNhat)
VALUES (@MaVaiTro, @TestUserName, @TestEmail, N'hashed', N'Test User', '0900000000', '1990-01-01', N'Khac', N'/avatar.png', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
DECLARE @MaTaiKhoan INT = SCOPE_IDENTITY();

INSERT INTO DIA_PHUONG (TenThanhPho, TenTinh, QuocGia) VALUES (N'Test City ' + @RunToken, N'Test Province ' + @RunToken, N'Vietnam');
DECLARE @MaDiaPhuong INT = SCOPE_IDENTITY();

INSERT INTO KHACH_SAN (MaTaiKhoanSoHuu, MaDiaPhuong, TenKhachSan, DiaChiChiTiet, HangSao, MoTa, GioNhanPhong, GioTraPhong, TrangThai, NgayDangKy, NgayCapNhat)
VALUES (@MaTaiKhoan, @MaDiaPhuong, N'Test Hotel ' + @RunToken, N'123 Test St', 3, N'A test hotel', '14:00', '12:00', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
DECLARE @MaKhachSan INT = SCOPE_IDENTITY();

INSERT INTO LOAI_PHONG (MaKhachSan, TenLoaiPhong, SoGiuong, SucChua, DienTich, LoaiGiuong, MoTa, TrangThai)
VALUES (@MaKhachSan, N'Standard ' + @RunToken, 1, 2, 20.0, N'Double', N'Standard room', N'Hoat dong');
DECLARE @MaLoaiPhong INT = SCOPE_IDENTITY();

-- Loại phòng thứ hai cho bài kiểm tra khác MaLoaiPhong
INSERT INTO LOAI_PHONG (MaKhachSan, TenLoaiPhong, SoGiuong, SucChua, DienTich, LoaiGiuong, MoTa, TrangThai)
VALUES (@MaKhachSan, N'Deluxe ' + @RunToken, 1, 2, 25.0, N'Double', N'Deluxe room', N'Hoat dong');
DECLARE @MaLoaiPhong2 INT = SCOPE_IDENTITY();

INSERT INTO CHINH_SACH_HUY (TenChinhSach, MoTa, TrangThai, NgayTao)
VALUES (N'Flexible ' + @RunToken, N'Flexible cancellation', N'Hoat dong', SYSDATETIME());
DECLARE @MaChinhSachHuy INT = SCOPE_IDENTITY();

INSERT INTO DAT_PHONG (MaXacNhanDatPhong, MaTaiKhoanKhachHang, MaKhachSan, MaChinhSachHuy, NgayNhanPhong, NgayTraPhong, TongTienPhong, SoTienGiam, TongTienThanhToan, TrangThai, NgayTao, NgayCapNhat)
VALUES (@BookingCode, @MaTaiKhoan, @MaKhachSan, @MaChinhSachHuy, '2026-01-01', '2026-01-03', 1000000, 0, 1000000, N'Cho thanh toan', SYSDATETIME(), SYSDATETIME());
DECLARE @MaDatPhong INT = SCOPE_IDENTITY();

INSERT INTO THANH_TOAN (MaDatPhong, SoTien, PhuongThucThanhToan, MaGiaoDichDoiTac, TrangThai, ThoiGianGiaoDich)
VALUES (@MaDatPhong, 1000000, N'The', N'TXN-TEST-' + @RunToken, N'Thanh cong', SYSDATETIME());
DECLARE @MaThanhToan INT = SCOPE_IDENTITY();

PRINT '--- Seed rows created inside transaction (will be rolled back) ---';

-- Test 1: trùng TenDangNhap phải thất bại
BEGIN TRY
    INSERT INTO TAI_KHOAN (MaVaiTro, TenDangNhap, Email, MatKhau, HoTen, SoDienThoai, NgaySinh, GioiTinh, AnhDaiDien, TrangThai, NgayTao, NgayCapNhat)
    VALUES (@MaVaiTro, @TestUserName, N'other_' + @RunToken + N'@example.com', N'hashed', N'Dup User', '0900000001', '1990-01-01', N'Khac', N'/avatar.png', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 1 duplicate TenDangNhap was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 1 duplicate TenDangNhap rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 2: khóa ngoại MaKhachSan không tồn tại phải thất bại
BEGIN TRY
    INSERT INTO DAT_PHONG (MaXacNhanDatPhong, MaTaiKhoanKhachHang, MaKhachSan, MaChinhSachHuy, NgayNhanPhong, NgayTraPhong, TongTienPhong, SoTienGiam, TongTienThanhToan, TrangThai, NgayTao, NgayCapNhat)
    VALUES ('FK' + @RunToken, @MaTaiKhoan, -999999, @MaChinhSachHuy, '2026-01-01', '2026-01-03', 1000000, 0, 1000000, N'Cho thanh toan', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 2 invalid MaKhachSan FK was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 2 invalid FK rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 3: SoTien nhỏ hơn hoặc bằng 0 phải thất bại
BEGIN TRY
    INSERT INTO THANH_TOAN (MaDatPhong, SoTien, PhuongThucThanhToan, MaGiaoDichDoiTac, TrangThai, ThoiGianGiaoDich)
    VALUES (@MaDatPhong, -100, N'The', N'TXN-BAD-' + @RunToken, N'Thanh cong', SYSDATETIME());
    PRINT 'FAIL: TEST 3 negative SoTien was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 3 negative SoTien rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 4: SoLuongPhong nhỏ hơn 1 phải thất bại
BEGIN TRY
    INSERT INTO CHI_TIET_DAT_PHONG (MaDatPhong, MaLoaiPhong, SoLuongPhong)
    VALUES (@MaDatPhong, @MaLoaiPhong, 0);
    PRINT 'FAIL: TEST 4 SoLuongPhong = 0 was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 4 invalid SoLuongPhong rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 5: ngày trả không sau ngày nhận phải thất bại
BEGIN TRY
    INSERT INTO DAT_PHONG (MaXacNhanDatPhong, MaTaiKhoanKhachHang, MaKhachSan, MaChinhSachHuy, NgayNhanPhong, NgayTraPhong, TongTienPhong, SoTienGiam, TongTienThanhToan, TrangThai, NgayTao, NgayCapNhat)
    VALUES ('DT' + @RunToken, @MaTaiKhoan, @MaKhachSan, @MaChinhSachHuy, '2026-01-05', '2026-01-05', 1000000, 0, 1000000, N'Cho thanh toan', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 5 NgayTraPhong = NgayNhanPhong was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 5 invalid date relation rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 6: TyLeHoanTien lớn hơn 100 phải thất bại
BEGIN TRY
    INSERT INTO CHI_TIET_CHINH_SACH_HUY (MaChinhSachHuy, SoGioTruocNhanPhong, TyLeHoanTien)
    VALUES (@MaChinhSachHuy, 24, 150.0);
    PRINT 'FAIL: TEST 6 TyLeHoanTien = 150 was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 6 invalid percentage rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 7: HangSao lớn hơn 5 phải thất bại
BEGIN TRY
    INSERT INTO KHACH_SAN (MaTaiKhoanSoHuu, MaDiaPhuong, TenKhachSan, DiaChiChiTiet, HangSao, MoTa, GioNhanPhong, GioTraPhong, TrangThai, NgayDangKy, NgayCapNhat)
    VALUES (@MaTaiKhoan, @MaDiaPhuong, N'Bad Star Hotel', N'456 Test St', 6, N'Invalid star rating', '14:00', '12:00', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 7 HangSao = 6 was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 7 invalid HangSao rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 8: TrangThaiDuyet ngoài danh sách cho phép phải thất bại
BEGIN TRY
    INSERT INTO HO_SO_DOI_TAC (MaTaiKhoan, SoCCCD, SoGiayPhepKinhDoanh, MaSoThue, TepGiayTo, TrangThaiDuyet, NgayNop)
    VALUES (@MaTaiKhoan, N'123456789', N'GP-001', N'MST-001', N'/doc.pdf', N'Invalid Status', SYSDATETIME());
    PRINT 'FAIL: TEST 8 invalid TrangThaiDuyet was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 8 invalid TrangThaiDuyet rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 9b: giá trị tiếng Việt có dấu hợp lệ phải được chấp nhận
BEGIN TRY
    INSERT INTO HO_SO_DOI_TAC (MaTaiKhoan, SoCCCD, SoGiayPhepKinhDoanh, MaSoThue, TepGiayTo, TrangThaiDuyet, NgayNop)
    VALUES (@MaTaiKhoan, N'987654321', N'GP-002', N'MST-002', N'/doc2.pdf', N'Chờ duyệt', SYSDATETIME());
    PRINT 'PASS: TEST 9b valid Vietnamese-diacritic TrangThaiDuyet accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 9b valid TrangThaiDuyet (Chờ duyệt) was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Test 9: chi tiết đặt phòng hợp lệ phải thành công
BEGIN TRY
    INSERT INTO CHI_TIET_DAT_PHONG (MaDatPhong, MaLoaiPhong, SoLuongPhong)
    VALUES (@MaDatPhong, @MaLoaiPhong, 2);
    PRINT 'PASS: TEST 9 valid CHI_TIET_DAT_PHONG insert succeeded';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 9 valid insert was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Hồi quy duy nhất MaLoaiPhong và NgayApDung

-- Test 10: lần chèn đầu cho cặp MaLoaiPhong và NgayApDung phải thành công
BEGIN TRY
    INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
    VALUES (@MaLoaiPhong, '2026-02-01', 500000, 5, N'Mo ban');
    PRINT 'PASS: TEST 10 first (MaLoaiPhong, NgayApDung) insert succeeded';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 10 first insert was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Test 11: trùng cặp MaLoaiPhong và NgayApDung phải thất bại
BEGIN TRY
    INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
    VALUES (@MaLoaiPhong, '2026-02-01', 600000, 3, N'Mo ban');
    PRINT 'FAIL: TEST 11 duplicate (MaLoaiPhong, NgayApDung) was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 11 duplicate (MaLoaiPhong, NgayApDung) rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 12: cùng loại phòng khác ngày phải thành công
BEGIN TRY
    INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
    VALUES (@MaLoaiPhong, '2026-02-02', 500000, 5, N'Mo ban');
    PRINT 'PASS: TEST 12 same MaLoaiPhong / different NgayApDung succeeded';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 12 same MaLoaiPhong / different NgayApDung was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Test 13: khác loại phòng cùng ngày phải thành công
BEGIN TRY
    INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
    VALUES (@MaLoaiPhong2, '2026-02-01', 700000, 2, N'Mo ban');
    PRINT 'PASS: TEST 13 different MaLoaiPhong / same NgayApDung succeeded';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 13 different MaLoaiPhong / same NgayApDung was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Hồi quy các cột cho phép NULL

-- Test 14: ngày sinh, giới tính, ảnh đại diện NULL phải thành công
BEGIN TRY
    INSERT INTO TAI_KHOAN (MaVaiTro, TenDangNhap, Email, MatKhau, HoTen, SoDienThoai, NgaySinh, GioiTinh, AnhDaiDien, TrangThai, NgayTao, NgayCapNhat)
    VALUES (@MaVaiTro, N'test_nulls_' + @RunToken, N'test_nulls_' + @RunToken + N'@example.com', N'hashed', N'Nullable Fields User', '0900000002', NULL, NULL, NULL, N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'PASS: TEST 14 TAI_KHOAN with NgaySinh/GioiTinh/AnhDaiDien = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 14 NULL optional fields were rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Test 15: SoDienThoai NULL phải thất bại
BEGIN TRY
    INSERT INTO TAI_KHOAN (MaVaiTro, TenDangNhap, Email, MatKhau, HoTen, SoDienThoai, NgaySinh, GioiTinh, AnhDaiDien, TrangThai, NgayTao, NgayCapNhat)
    VALUES (@MaVaiTro, N'test_badphone_' + @RunToken, N'test_badphone_' + @RunToken + N'@example.com', N'hashed', N'Bad Phone User', NULL, '1990-01-01', N'Khac', N'/avatar.png', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 15 SoDienThoai = NULL was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 15 SoDienThoai = NULL rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- Test 16: MoTa của khách sạn NULL phải thành công
BEGIN TRY
    INSERT INTO KHACH_SAN (MaTaiKhoanSoHuu, MaDiaPhuong, TenKhachSan, DiaChiChiTiet, HangSao, MoTa, GioNhanPhong, GioTraPhong, TrangThai, NgayDangKy, NgayCapNhat)
    VALUES (@MaTaiKhoan, @MaDiaPhuong, N'No-Description ' + @RunToken, N'789 Test St', 3, NULL, '14:00', '12:00', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'PASS: TEST 16 KHACH_SAN.MoTa = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 16 KHACH_SAN.MoTa = NULL was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Test 17: MoTa của loại phòng NULL phải thành công
BEGIN TRY
    INSERT INTO LOAI_PHONG (MaKhachSan, TenLoaiPhong, SoGiuong, SucChua, DienTich, LoaiGiuong, MoTa, TrangThai)
    VALUES (@MaKhachSan, N'No-Description ' + @RunToken, 1, 2, 18.0, N'Single', NULL, N'Hoat dong');
    PRINT 'PASS: TEST 17 LOAI_PHONG.MoTa = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 17 LOAI_PHONG.MoTa = NULL was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Test 18: BieuTuong của tiện nghi NULL phải thành công
BEGIN TRY
    INSERT INTO TIEN_NGHI (TenTienNghi, BieuTuong) VALUES (N'No-Icon ' + @RunToken, NULL);
    PRINT 'PASS: TEST 18 TIEN_NGHI.BieuTuong = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 18 TIEN_NGHI.BieuTuong = NULL was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Test 19: NoiDung của đánh giá NULL phải thành công
BEGIN TRY
    INSERT INTO DANH_GIA (MaDatPhong, MaKhachHang, MaKhachSan, DiemDanhGia, NoiDung, TrangThai)
    VALUES (@MaDatPhong, @MaTaiKhoan, @MaKhachSan, 5, NULL, N'Hien thi');
    PRINT 'PASS: TEST 19 DANH_GIA.NoiDung = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 19 DANH_GIA.NoiDung = NULL was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- Tổng kết và luôn rollback
IF @FailCount = 0
    PRINT '=== test-constraints.sql: ALL CHECKS PASSED ===';
ELSE
    PRINT '=== test-constraints.sql: ' + CAST(@FailCount AS VARCHAR) + ' CHECK(S) FAILED ===';

ROLLBACK TRANSACTION;
PRINT 'Transaction rolled back — database left unmodified.';
IF @FailCount > 0
    RAISERROR('test-constraints.sql failed with %d failing check(s)', 16, 1, @FailCount);
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH
GO
