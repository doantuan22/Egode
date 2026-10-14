-- =====================================================================
-- DB-0 test-constraints.sql
-- Exercises the constraints declared in the baseline migrations using a
-- single transaction that is ALWAYS rolled back at the end, so the
-- target database is left unmodified. Only constraints that actually
-- exist in the DDL (see data-dictionary.md) are tested here.
--
-- Pattern per test: attempt the statement inside TRY/CATCH.
--   - "invalid" tests expect an error (PASS if caught, FAIL if it succeeds)
--   - "valid" tests expect success (PASS if it succeeds, FAIL if caught)
-- =====================================================================

SET NOCOUNT ON;
SET XACT_ABORT OFF; -- a constraint violation must only fail its own statement
DECLARE @FailCount INT = 0;

BEGIN TRY
BEGIN TRANSACTION;

-- -----------------------------------------------------------------
-- Seed minimal valid parent rows needed by the tests below
-- -----------------------------------------------------------------
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

-- Second room type, used only by the DDI-02 "different MaLoaiPhong" test.
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

-- -----------------------------------------------------------------
-- TEST 1: duplicate UNIQUE (TAI_KHOAN.TenDangNhap) -> must fail
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO TAI_KHOAN (MaVaiTro, TenDangNhap, Email, MatKhau, HoTen, SoDienThoai, NgaySinh, GioiTinh, AnhDaiDien, TrangThai, NgayTao, NgayCapNhat)
    VALUES (@MaVaiTro, @TestUserName, N'other_' + @RunToken + N'@example.com', N'hashed', N'Dup User', '0900000001', '1990-01-01', N'Khac', N'/avatar.png', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 1 duplicate TenDangNhap was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 1 duplicate TenDangNhap rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- -----------------------------------------------------------------
-- TEST 2: invalid FK (DAT_PHONG.MaKhachSan -> non-existent KHACH_SAN) -> must fail
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO DAT_PHONG (MaXacNhanDatPhong, MaTaiKhoanKhachHang, MaKhachSan, MaChinhSachHuy, NgayNhanPhong, NgayTraPhong, TongTienPhong, SoTienGiam, TongTienThanhToan, TrangThai, NgayTao, NgayCapNhat)
    VALUES ('FK' + @RunToken, @MaTaiKhoan, -999999, @MaChinhSachHuy, '2026-01-01', '2026-01-03', 1000000, 0, 1000000, N'Cho thanh toan', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 2 invalid MaKhachSan FK was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 2 invalid FK rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- -----------------------------------------------------------------
-- TEST 3: invalid money (THANH_TOAN.SoTien <= 0) -> must fail
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO THANH_TOAN (MaDatPhong, SoTien, PhuongThucThanhToan, MaGiaoDichDoiTac, TrangThai, ThoiGianGiaoDich)
    VALUES (@MaDatPhong, -100, N'The', N'TXN-BAD-' + @RunToken, N'Thanh cong', SYSDATETIME());
    PRINT 'FAIL: TEST 3 negative SoTien was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 3 negative SoTien rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- -----------------------------------------------------------------
-- TEST 4: invalid quantity (CHI_TIET_DAT_PHONG.SoLuongPhong < 1) -> must fail
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO CHI_TIET_DAT_PHONG (MaDatPhong, MaLoaiPhong, SoLuongPhong)
    VALUES (@MaDatPhong, @MaLoaiPhong, 0);
    PRINT 'FAIL: TEST 4 SoLuongPhong = 0 was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 4 invalid SoLuongPhong rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- -----------------------------------------------------------------
-- TEST 5: invalid date relation (DAT_PHONG.NgayTraPhong <= NgayNhanPhong) -> must fail
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO DAT_PHONG (MaXacNhanDatPhong, MaTaiKhoanKhachHang, MaKhachSan, MaChinhSachHuy, NgayNhanPhong, NgayTraPhong, TongTienPhong, SoTienGiam, TongTienThanhToan, TrangThai, NgayTao, NgayCapNhat)
    VALUES ('DT' + @RunToken, @MaTaiKhoan, @MaKhachSan, @MaChinhSachHuy, '2026-01-05', '2026-01-05', 1000000, 0, 1000000, N'Cho thanh toan', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 5 NgayTraPhong = NgayNhanPhong was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 5 invalid date relation rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- -----------------------------------------------------------------
-- TEST 6: invalid percentage (CHI_TIET_CHINH_SACH_HUY.TyLeHoanTien > 100) -> must fail
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO CHI_TIET_CHINH_SACH_HUY (MaChinhSachHuy, SoGioTruocNhanPhong, TyLeHoanTien)
    VALUES (@MaChinhSachHuy, 24, 150.0);
    PRINT 'FAIL: TEST 6 TyLeHoanTien = 150 was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 6 invalid percentage rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- -----------------------------------------------------------------
-- TEST 7: HangSao out of range (KHACH_SAN.HangSao > 5) -> must fail
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO KHACH_SAN (MaTaiKhoanSoHuu, MaDiaPhuong, TenKhachSan, DiaChiChiTiet, HangSao, MoTa, GioNhanPhong, GioTraPhong, TrangThai, NgayDangKy, NgayCapNhat)
    VALUES (@MaTaiKhoan, @MaDiaPhuong, N'Bad Star Hotel', N'456 Test St', 6, N'Invalid star rating', '14:00', '12:00', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 7 HangSao = 6 was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 7 invalid HangSao rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- -----------------------------------------------------------------
-- TEST 8: closed-domain CHECK (HO_SO_DOI_TAC.TrangThaiDuyet not in enum) -> must fail
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO HO_SO_DOI_TAC (MaTaiKhoan, SoCCCD, SoGiayPhepKinhDoanh, MaSoThue, TepGiayTo, TrangThaiDuyet, NgayNop)
    VALUES (@MaTaiKhoan, N'123456789', N'GP-001', N'MST-001', N'/doc.pdf', N'Invalid Status', SYSDATETIME());
    PRINT 'FAIL: TEST 8 invalid TrangThaiDuyet was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 8 invalid TrangThaiDuyet rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- -----------------------------------------------------------------
-- TEST 9b (positive, encoding-sensitive): a valid closed-domain Vietnamese
-- value (with diacritics) must be ACCEPTED. This specifically guards against
-- the class of bug where a migration/script is executed with the wrong
-- input codepage and the CHECK constraint gets compiled with mojibake
-- literals that no longer match correctly-encoded application data — see
-- database/docs/db0-report.md "Encoding defect found and fixed in M1".
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO HO_SO_DOI_TAC (MaTaiKhoan, SoCCCD, SoGiayPhepKinhDoanh, MaSoThue, TepGiayTo, TrangThaiDuyet, NgayNop)
    VALUES (@MaTaiKhoan, N'987654321', N'GP-002', N'MST-002', N'/doc2.pdf', N'Chờ duyệt', SYSDATETIME());
    PRINT 'PASS: TEST 9b valid Vietnamese-diacritic TrangThaiDuyet accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 9b valid TrangThaiDuyet (Chờ duyệt) was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- -----------------------------------------------------------------
-- TEST 9 (control/positive): a fully valid CHI_TIET_DAT_PHONG insert must succeed
-- -----------------------------------------------------------------
BEGIN TRY
    INSERT INTO CHI_TIET_DAT_PHONG (MaDatPhong, MaLoaiPhong, SoLuongPhong)
    VALUES (@MaDatPhong, @MaLoaiPhong, 2);
    PRINT 'PASS: TEST 9 valid CHI_TIET_DAT_PHONG insert succeeded';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 9 valid insert was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- -----------------------------------------------------------------
-- DDI-02 (RESOLVED) regression: UNIQUE (MaLoaiPhong, NgayApDung) on
-- QUY_PHONG_GIA. User decision: one loại phòng, one bản ghi giá per ngày.
-- -----------------------------------------------------------------

-- TEST 10: first insert for (MaLoaiPhong, NgayApDung) -> must succeed
BEGIN TRY
    INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
    VALUES (@MaLoaiPhong, '2026-02-01', 500000, 5, N'Mo ban');
    PRINT 'PASS: TEST 10 first (MaLoaiPhong, NgayApDung) insert succeeded';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 10 first insert was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- TEST 11: same (MaLoaiPhong, NgayApDung) again -> must fail (DDI-02 UNIQUE)
BEGIN TRY
    INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
    VALUES (@MaLoaiPhong, '2026-02-01', 600000, 3, N'Mo ban');
    PRINT 'FAIL: TEST 11 duplicate (MaLoaiPhong, NgayApDung) was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 11 duplicate (MaLoaiPhong, NgayApDung) rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- TEST 12: same MaLoaiPhong, different NgayApDung -> must succeed
BEGIN TRY
    INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
    VALUES (@MaLoaiPhong, '2026-02-02', 500000, 5, N'Mo ban');
    PRINT 'PASS: TEST 12 same MaLoaiPhong / different NgayApDung succeeded';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 12 same MaLoaiPhong / different NgayApDung was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- TEST 13: different MaLoaiPhong, same NgayApDung -> must succeed
BEGIN TRY
    INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
    VALUES (@MaLoaiPhong2, '2026-02-01', 700000, 2, N'Mo ban');
    PRINT 'PASS: TEST 13 different MaLoaiPhong / same NgayApDung succeeded';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 13 different MaLoaiPhong / same NgayApDung was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- -----------------------------------------------------------------
-- DDI-01 (RESOLVED) regression: exact nullable/not-null per user decision.
-- -----------------------------------------------------------------

-- TEST 14: TAI_KHOAN with NgaySinh/GioiTinh/AnhDaiDien = NULL -> must succeed
BEGIN TRY
    INSERT INTO TAI_KHOAN (MaVaiTro, TenDangNhap, Email, MatKhau, HoTen, SoDienThoai, NgaySinh, GioiTinh, AnhDaiDien, TrangThai, NgayTao, NgayCapNhat)
    VALUES (@MaVaiTro, N'test_nulls_' + @RunToken, N'test_nulls_' + @RunToken + N'@example.com', N'hashed', N'Nullable Fields User', '0900000002', NULL, NULL, NULL, N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'PASS: TEST 14 TAI_KHOAN with NgaySinh/GioiTinh/AnhDaiDien = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 14 NULL optional fields were rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- TEST 15: TAI_KHOAN with SoDienThoai = NULL -> must still fail (stays NOT NULL)
BEGIN TRY
    INSERT INTO TAI_KHOAN (MaVaiTro, TenDangNhap, Email, MatKhau, HoTen, SoDienThoai, NgaySinh, GioiTinh, AnhDaiDien, TrangThai, NgayTao, NgayCapNhat)
    VALUES (@MaVaiTro, N'test_badphone_' + @RunToken, N'test_badphone_' + @RunToken + N'@example.com', N'hashed', N'Bad Phone User', NULL, '1990-01-01', N'Khac', N'/avatar.png', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'FAIL: TEST 15 SoDienThoai = NULL was allowed';
    SET @FailCount += 1;
END TRY
BEGIN CATCH
    PRINT 'PASS: TEST 15 SoDienThoai = NULL rejected (' + ERROR_MESSAGE() + ')';
END CATCH

-- TEST 16: KHACH_SAN.MoTa = NULL -> must succeed
BEGIN TRY
    INSERT INTO KHACH_SAN (MaTaiKhoanSoHuu, MaDiaPhuong, TenKhachSan, DiaChiChiTiet, HangSao, MoTa, GioNhanPhong, GioTraPhong, TrangThai, NgayDangKy, NgayCapNhat)
    VALUES (@MaTaiKhoan, @MaDiaPhuong, N'No-Description ' + @RunToken, N'789 Test St', 3, NULL, '14:00', '12:00', N'Hoat dong', SYSDATETIME(), SYSDATETIME());
    PRINT 'PASS: TEST 16 KHACH_SAN.MoTa = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 16 KHACH_SAN.MoTa = NULL was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- TEST 17: LOAI_PHONG.MoTa = NULL -> must succeed
BEGIN TRY
    INSERT INTO LOAI_PHONG (MaKhachSan, TenLoaiPhong, SoGiuong, SucChua, DienTich, LoaiGiuong, MoTa, TrangThai)
    VALUES (@MaKhachSan, N'No-Description ' + @RunToken, 1, 2, 18.0, N'Single', NULL, N'Hoat dong');
    PRINT 'PASS: TEST 17 LOAI_PHONG.MoTa = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 17 LOAI_PHONG.MoTa = NULL was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- TEST 18: TIEN_NGHI.BieuTuong = NULL -> must succeed
BEGIN TRY
    INSERT INTO TIEN_NGHI (TenTienNghi, BieuTuong) VALUES (N'No-Icon ' + @RunToken, NULL);
    PRINT 'PASS: TEST 18 TIEN_NGHI.BieuTuong = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 18 TIEN_NGHI.BieuTuong = NULL was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- TEST 19: DANH_GIA.NoiDung = NULL -> must succeed
BEGIN TRY
    INSERT INTO DANH_GIA (MaDatPhong, MaKhachHang, MaKhachSan, DiemDanhGia, NoiDung, TrangThai)
    VALUES (@MaDatPhong, @MaTaiKhoan, @MaKhachSan, 5, NULL, N'Hien thi');
    PRINT 'PASS: TEST 19 DANH_GIA.NoiDung = NULL accepted';
END TRY
BEGIN CATCH
    PRINT 'FAIL: TEST 19 DANH_GIA.NoiDung = NULL was rejected (' + ERROR_MESSAGE() + ')';
    SET @FailCount += 1;
END CATCH

-- -----------------------------------------------------------------
-- Summary + always rollback (test script must never leave data behind)
-- -----------------------------------------------------------------
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
