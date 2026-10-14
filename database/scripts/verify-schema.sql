-- =====================================================================
-- DB-0 verify-schema.sql
-- Read-only verification of the baseline schema against Gate 0 rules
-- and the 22 official tables. Run against the target database after
-- migrations 001-006 have been applied.
--
-- Each check PRINTs PASS/FAIL. Exits with RAISERROR (severity 16) if
-- any check fails, so the script can be used in CI with @@ERROR checks.
-- =====================================================================

SET NOCOUNT ON;
DECLARE @FailCount INT = 0;

-- -----------------------------------------------------------------
-- Check 1: exactly the 22 official tables exist (no more, no less)
-- -----------------------------------------------------------------
DECLARE @ExpectedTables TABLE (TableName SYSNAME);
INSERT INTO @ExpectedTables (TableName) VALUES
    ('VAI_TRO'), ('TAI_KHOAN'), ('HO_SO_DOI_TAC'), ('DIA_PHUONG'),
    ('KHACH_SAN'), ('HINH_ANH_KHACH_SAN'), ('TIEN_NGHI'), ('KHACH_SAN_TIEN_NGHI'),
    ('LOAI_PHONG'), ('HINH_ANH_LOAI_PHONG'), ('LOAI_PHONG_TIEN_NGHI'), ('QUY_PHONG_GIA'),
    ('CHINH_SACH_HUY'), ('CHI_TIET_CHINH_SACH_HUY'), ('KHUYEN_MAI'),
    ('DAT_PHONG'), ('CHI_TIET_DAT_PHONG'), ('THANH_TOAN'), ('HOAN_TIEN'),
    ('DANH_GIA'), ('HINH_ANH_DANH_GIA'), ('YEU_CAU_HO_TRO');

DECLARE @MissingCount INT, @ExtraCount INT, @TotalCount INT;

SELECT @MissingCount = COUNT(*) FROM @ExpectedTables e
WHERE NOT EXISTS (
    SELECT 1 FROM sys.tables t WHERE t.name = e.TableName AND t.type = 'U'
);

SELECT @ExtraCount = COUNT(*) FROM sys.tables t
WHERE t.type = 'U'
  AND NOT EXISTS (SELECT 1 FROM @ExpectedTables e WHERE e.TableName = t.name);

SELECT @TotalCount = COUNT(*) FROM sys.tables WHERE type = 'U';

IF @MissingCount = 0 AND @TotalCount = 22
    PRINT 'PASS: exactly 22 official tables present';
ELSE
BEGIN
    PRINT 'FAIL: table count/list mismatch. Missing=' + CAST(@MissingCount AS VARCHAR) + ', Total=' + CAST(@TotalCount AS VARCHAR);
    SET @FailCount += 1;
END

IF @ExtraCount > 0
BEGIN
    PRINT 'FAIL: unexpected extra tables found (see list below):';
    SELECT t.name AS ExtraTable FROM sys.tables t
    WHERE t.type = 'U' AND NOT EXISTS (SELECT 1 FROM @ExpectedTables e WHERE e.TableName = t.name);
    SET @FailCount += 1;
END
ELSE
    PRINT 'PASS: no unexpected extra tables';

-- -----------------------------------------------------------------
-- Check 2: G0-01 - KHUYEN_MAI_KHACH_SAN must not exist
-- -----------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'KHUYEN_MAI_KHACH_SAN')
BEGIN
    PRINT 'FAIL: G0-01 violated - KHUYEN_MAI_KHACH_SAN exists';
    SET @FailCount += 1;
END
ELSE
    PRINT 'PASS: G0-01 - KHUYEN_MAI_KHACH_SAN absent';

-- -----------------------------------------------------------------
-- Check 3: G0-02 - CHI_TIET_GIA_DAT_PHONG must not exist
-- -----------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CHI_TIET_GIA_DAT_PHONG')
BEGIN
    PRINT 'FAIL: G0-02 violated - CHI_TIET_GIA_DAT_PHONG exists';
    SET @FailCount += 1;
END
ELSE
    PRINT 'PASS: G0-02 - CHI_TIET_GIA_DAT_PHONG absent';

-- -----------------------------------------------------------------
-- Check 4: G0-03 - CHINH_SACH_HUY must NOT have MaDatPhong
-- -----------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'CHINH_SACH_HUY' AND c.name = 'MaDatPhong'
)
BEGIN
    PRINT 'FAIL: G0-03 violated - CHINH_SACH_HUY.MaDatPhong exists';
    SET @FailCount += 1;
END
ELSE
    PRINT 'PASS: G0-03 - CHINH_SACH_HUY has no MaDatPhong';

-- -----------------------------------------------------------------
-- Check 5: G0-04 - HO_SO_DOI_TAC must have MaTaiKhoanDuyet
-- -----------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'HO_SO_DOI_TAC' AND c.name = 'MaTaiKhoanDuyet'
)
    PRINT 'PASS: G0-04 - HO_SO_DOI_TAC.MaTaiKhoanDuyet exists';
ELSE
BEGIN
    PRINT 'FAIL: G0-04 violated - HO_SO_DOI_TAC.MaTaiKhoanDuyet missing';
    SET @FailCount += 1;
END

-- -----------------------------------------------------------------
-- Check 6: DAT_PHONG -> CHINH_SACH_HUY FK via MaChinhSachHuy exists
-- -----------------------------------------------------------------
IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys fk
    JOIN sys.tables tp ON tp.object_id = fk.parent_object_id
    JOIN sys.tables tr ON tr.object_id = fk.referenced_object_id
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns cp ON cp.object_id = fkc.parent_object_id AND cp.column_id = fkc.parent_column_id
    JOIN sys.columns cr ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
    WHERE tp.name = 'DAT_PHONG' AND tr.name = 'CHINH_SACH_HUY'
      AND cp.name = 'MaChinhSachHuy' AND cr.name = 'MaChinhSachHuy'
)
    PRINT 'PASS: DAT_PHONG.MaChinhSachHuy -> CHINH_SACH_HUY.MaChinhSachHuy FK exists';
ELSE
BEGIN
    PRINT 'FAIL: DAT_PHONG -> CHINH_SACH_HUY FK missing/incorrect';
    SET @FailCount += 1;
END

-- -----------------------------------------------------------------
-- Check 7: every table has a primary key
-- -----------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.tables t
    WHERE t.type = 'U'
      AND NOT EXISTS (
        SELECT 1 FROM sys.key_constraints kc
        WHERE kc.parent_object_id = t.object_id AND kc.type = 'PK'
      )
)
BEGIN
    PRINT 'FAIL: tables without a primary key found:';
    SELECT t.name FROM sys.tables t
    WHERE t.type = 'U'
      AND NOT EXISTS (
        SELECT 1 FROM sys.key_constraints kc
        WHERE kc.parent_object_id = t.object_id AND kc.type = 'PK'
      );
    SET @FailCount += 1;
END
ELSE
    PRINT 'PASS: every table has a primary key';

-- -----------------------------------------------------------------
-- Check 8: all FKs reference existing tables/columns (integrity is
-- guaranteed by SQL Server at creation time; this re-confirms no FK
-- is disabled/not-trusted, which would indicate NOCHECK was used)
-- -----------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE is_not_trusted = 1 OR is_disabled = 1
)
BEGIN
    PRINT 'FAIL: untrusted or disabled foreign keys found:';
    SELECT name, is_not_trusted, is_disabled FROM sys.foreign_keys
    WHERE is_not_trusted = 1 OR is_disabled = 1;
    SET @FailCount += 1;
END
ELSE
    PRINT 'PASS: all foreign keys are trusted and enabled';

-- -----------------------------------------------------------------
-- Check 9: key UNIQUE constraints present
-- -----------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
           WHERE t.name = 'TAI_KHOAN' AND i.name = 'UQ_TAI_KHOAN_TenDangNhap' AND i.is_unique = 1)
   AND EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
           WHERE t.name = 'TAI_KHOAN' AND i.name = 'UQ_TAI_KHOAN_Email' AND i.is_unique = 1)
   AND EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
           WHERE t.name = 'KHUYEN_MAI' AND i.name = 'UQ_KHUYEN_MAI_MaCode' AND i.is_unique = 1)
   AND EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
           WHERE t.name = 'DAT_PHONG' AND i.name = 'UQ_DAT_PHONG_MaXacNhanDatPhong' AND i.is_unique = 1)
   AND EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
           WHERE t.name = 'DANH_GIA' AND i.name = 'UQ_DANH_GIA_MaDatPhong' AND i.is_unique = 1)
    PRINT 'PASS: key UNIQUE constraints present (TAI_KHOAN, KHUYEN_MAI, DAT_PHONG, DANH_GIA)';
ELSE
BEGIN
    PRINT 'FAIL: one or more expected UNIQUE constraints missing';
    SET @FailCount += 1;
END

-- -----------------------------------------------------------------
-- Check 10: no money column uses FLOAT/REAL
-- -----------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id AND t.type = 'U'
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE ty.name IN ('float', 'real')
)
BEGIN
    PRINT 'FAIL: FLOAT/REAL columns found (money must use DECIMAL):';
    SELECT t.name AS TableName, c.name AS ColumnName, ty.name AS TypeName
    FROM sys.columns c
    JOIN sys.tables t ON t.object_id = c.object_id AND t.type = 'U'
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE ty.name IN ('float', 'real');
    SET @FailCount += 1;
END
ELSE
    PRINT 'PASS: no FLOAT/REAL columns in schema';

-- -----------------------------------------------------------------
-- Check 11: CHECK constraints exist (count sanity, expect >= 25)
-- -----------------------------------------------------------------
DECLARE @CheckCount INT;
SELECT @CheckCount = COUNT(*) FROM sys.check_constraints;
IF @CheckCount >= 25
    PRINT 'PASS: CHECK constraints present (count=' + CAST(@CheckCount AS VARCHAR) + ')';
ELSE
BEGIN
    PRINT 'FAIL: fewer CHECK constraints than expected (count=' + CAST(@CheckCount AS VARCHAR) + ')';
    SET @FailCount += 1;
END

-- -----------------------------------------------------------------
-- Check 12: DDI-01 (RESOLVED) - exact nullability per the user's decision
-- -----------------------------------------------------------------
DECLARE @NullabilityExpected TABLE (TableName SYSNAME, ColumnName SYSNAME, ExpectNullable BIT);
INSERT INTO @NullabilityExpected (TableName, ColumnName, ExpectNullable) VALUES
    ('TAI_KHOAN', 'SoDienThoai', 0),  -- stays NOT NULL
    ('TAI_KHOAN', 'NgaySinh', 1),
    ('TAI_KHOAN', 'GioiTinh', 1),
    ('TAI_KHOAN', 'AnhDaiDien', 1),
    ('KHACH_SAN', 'MoTa', 1),
    ('LOAI_PHONG', 'MoTa', 1),
    ('TIEN_NGHI', 'BieuTuong', 1),
    ('DANH_GIA', 'NoiDung', 1);

IF EXISTS (
    SELECT 1
    FROM @NullabilityExpected e
    JOIN sys.tables t ON t.name = e.TableName
    JOIN sys.columns c ON c.object_id = t.object_id AND c.name = e.ColumnName
    WHERE c.is_nullable <> e.ExpectNullable
)
BEGIN
    PRINT 'FAIL: DDI-01 nullability mismatch found:';
    SELECT e.TableName, e.ColumnName, e.ExpectNullable AS Expected, c.is_nullable AS Actual
    FROM @NullabilityExpected e
    JOIN sys.tables t ON t.name = e.TableName
    JOIN sys.columns c ON c.object_id = t.object_id AND c.name = e.ColumnName
    WHERE c.is_nullable <> e.ExpectNullable;
    SET @FailCount += 1;
END
ELSE
    PRINT 'PASS: DDI-01 - nullability matches the resolved decision (SoDienThoai NOT NULL; NgaySinh/GioiTinh/AnhDaiDien/KHACH_SAN.MoTa/LOAI_PHONG.MoTa/TIEN_NGHI.BieuTuong/DANH_GIA.NoiDung NULL)';

-- -----------------------------------------------------------------
-- Check 13: DDI-02 (RESOLVED) - UNIQUE (MaLoaiPhong, NgayApDung) on
-- QUY_PHONG_GIA, verified by actual key columns, not just constraint name.
-- -----------------------------------------------------------------
IF EXISTS (
    SELECT i.index_id
    FROM sys.indexes i
    JOIN sys.tables t ON t.object_id = i.object_id
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    WHERE t.name = 'QUY_PHONG_GIA' AND i.is_unique = 1
    GROUP BY i.index_id
    HAVING
        COUNT(*) = 2
        AND SUM(CASE WHEN COL_NAME(i.object_id, ic.column_id) = 'MaLoaiPhong' THEN 1 ELSE 0 END) = 1
        AND SUM(CASE WHEN COL_NAME(i.object_id, ic.column_id) = 'NgayApDung' THEN 1 ELSE 0 END) = 1
)
    PRINT 'PASS: DDI-02 - UNIQUE (MaLoaiPhong, NgayApDung) exists on QUY_PHONG_GIA';
ELSE
BEGIN
    PRINT 'FAIL: DDI-02 - no UNIQUE index on QUY_PHONG_GIA covering exactly (MaLoaiPhong, NgayApDung)';
    SET @FailCount += 1;
END

-- -----------------------------------------------------------------
-- Check 14: Migration 007 indexes are present and enabled.
-- -----------------------------------------------------------------
DECLARE @ExpectedIndexes TABLE (TableName SYSNAME, IndexName SYSNAME);
INSERT INTO @ExpectedIndexes (TableName, IndexName) VALUES
    ('DAT_PHONG', 'IX_DAT_PHONG_TrangThai_NgayTao'),
    ('DAT_PHONG', 'IX_DAT_PHONG_TrangThai_NgayTraPhong'),
    ('DAT_PHONG', 'IX_DAT_PHONG_MaTaiKhoanKhachHang_NgayTao'),
    ('DAT_PHONG', 'IX_DAT_PHONG_MaKhachSan_NgayTao'),
    ('DAT_PHONG', 'IX_DAT_PHONG_MaKhuyenMai'),
    ('CHI_TIET_DAT_PHONG', 'IX_CHI_TIET_DAT_PHONG_MaLoaiPhong'),
    ('LOAI_PHONG', 'IX_LOAI_PHONG_MaKhachSan_TrangThai'),
    ('KHACH_SAN', 'IX_KHACH_SAN_TrangThai'),
    ('KHACH_SAN', 'IX_KHACH_SAN_MaTaiKhoanSoHuu_NgayDangKy'),
    ('THANH_TOAN', 'IX_THANH_TOAN_MaDatPhong'),
    ('THANH_TOAN', 'IX_THANH_TOAN_MaGiaoDichDoiTac'),
    ('THANH_TOAN', 'IX_THANH_TOAN_TrangThai_ThoiGianGiaoDich'),
    ('HOAN_TIEN', 'IX_HOAN_TIEN_MaThanhToan'),
    ('HOAN_TIEN', 'IX_HOAN_TIEN_TrangThai_NgayHoanTien'),
    ('YEU_CAU_HO_TRO', 'IX_YEU_CAU_HO_TRO_MaTaiKhoanKhachHang_NgayTao');

DECLARE @MissingIndexCount INT;
SELECT @MissingIndexCount = COUNT(*)
FROM @ExpectedIndexes e
LEFT JOIN sys.tables t ON t.name = e.TableName
LEFT JOIN sys.indexes i ON i.object_id = t.object_id AND i.name = e.IndexName AND i.is_disabled = 0
WHERE i.index_id IS NULL;

IF @MissingIndexCount = 0
    PRINT 'PASS: all 15 Migration 007 indexes exist and are enabled';
ELSE
BEGIN
    PRINT 'FAIL: one or more Migration 007 indexes are missing or disabled:';
    SELECT e.TableName, e.IndexName
    FROM @ExpectedIndexes e
    LEFT JOIN sys.tables t ON t.name = e.TableName
    LEFT JOIN sys.indexes i ON i.object_id = t.object_id AND i.name = e.IndexName AND i.is_disabled = 0
    WHERE i.index_id IS NULL;
    SET @FailCount += 1;
END

-- -----------------------------------------------------------------
-- Check 15: Migration 008 procedure is present; there are no unreviewed
-- user functions or triggers that could change the application's data.
-- -----------------------------------------------------------------
IF OBJECT_ID('dbo.usp_KhoaKhuyenMaiChoDatPhong', 'P') IS NOT NULL
    PRINT 'PASS: Migration 008 booking-promotion lock procedure exists';
ELSE
BEGIN
    PRINT 'FAIL: dbo.usp_KhoaKhuyenMaiChoDatPhong is missing';
    SET @FailCount += 1;
END

DECLARE @PromotionLockDefinition NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID('dbo.usp_KhoaKhuyenMaiChoDatPhong', 'P'));
IF @PromotionLockDefinition IS NOT NULL
   AND LOWER(@PromotionLockDefinition) LIKE '%updlock%'
   AND LOWER(@PromotionLockDefinition) LIKE '%holdlock%'
   AND LOWER(@PromotionLockDefinition) LIKE '%rowlock%'
   AND LOWER(@PromotionLockDefinition) LIKE '%@@trancount%'
    PRINT 'PASS: Migration 008 procedure retains its transaction guard and serialization lock hints';
ELSE
BEGIN
    PRINT 'FAIL: Migration 008 procedure definition is unavailable or lacks its required transaction/lock guards';
    SET @FailCount += 1;
END

DECLARE @UnexpectedSqlObjectCount INT;
SELECT @UnexpectedSqlObjectCount =
    (SELECT COUNT(*) FROM sys.procedures WHERE is_ms_shipped = 0 AND schema_id = SCHEMA_ID('dbo') AND name <> 'usp_KhoaKhuyenMaiChoDatPhong') +
    (SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped = 0 AND schema_id = SCHEMA_ID('dbo') AND type IN ('FN', 'IF', 'TF', 'FS', 'FT')) +
    (SELECT COUNT(*) FROM sys.triggers tr JOIN sys.objects o ON o.object_id = tr.object_id WHERE tr.is_ms_shipped = 0 AND o.schema_id = SCHEMA_ID('dbo'));

IF @UnexpectedSqlObjectCount = 0
    PRINT 'PASS: no unreviewed dbo procedures, functions, or triggers found';
ELSE
BEGIN
    PRINT 'FAIL: unreviewed dbo procedures, functions, or triggers found:';
    SELECT 'PROCEDURE' AS ObjectType, name AS ObjectName FROM sys.procedures
    WHERE is_ms_shipped = 0 AND schema_id = SCHEMA_ID('dbo') AND name <> 'usp_KhoaKhuyenMaiChoDatPhong'
    UNION ALL
    SELECT type_desc, name FROM sys.objects
    WHERE is_ms_shipped = 0 AND schema_id = SCHEMA_ID('dbo') AND type IN ('FN', 'IF', 'TF', 'FS', 'FT')
    UNION ALL
    SELECT 'TRIGGER', o.name FROM sys.triggers tr JOIN sys.objects o ON o.object_id = tr.object_id
    WHERE tr.is_ms_shipped = 0 AND o.schema_id = SCHEMA_ID('dbo');
    SET @FailCount += 1;
END

-- -----------------------------------------------------------------
-- Summary
-- -----------------------------------------------------------------
IF @FailCount = 0
    PRINT '=== verify-schema.sql: ALL CHECKS PASSED ===';
ELSE
BEGIN
    PRINT '=== verify-schema.sql: ' + CAST(@FailCount AS VARCHAR) + ' CHECK(S) FAILED ===';
    RAISERROR('verify-schema.sql failed with %d failing check(s)', 16, 1, @FailCount);
END
GO
