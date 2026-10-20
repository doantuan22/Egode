/* Kiểm tra các quy tắc nghiệp vụ của dữ liệu demo, mỗi truy vấn phải trả về 0 vi phạm */
SET NOCOUNT ON;
DECLARE @today DATE = CAST(SYSUTCDATETIME() AS DATE);

SELECT 'overbooking (booked > SoLuongPhong on a night)' AS [check], COUNT(*) AS violations
FROM (
    SELECT q.MaQuyPhong
    FROM QUY_PHONG_GIA q
    JOIN CHI_TIET_DAT_PHONG c ON c.MaLoaiPhong = q.MaLoaiPhong
    JOIN DAT_PHONG d ON d.MaDatPhong = c.MaDatPhong AND d.TrangThai <> N'Đã hủy'
     AND q.NgayApDung >= d.NgayNhanPhong AND q.NgayApDung < d.NgayTraPhong
    GROUP BY q.MaQuyPhong, q.SoLuongPhong
    HAVING SUM(c.SoLuongPhong) > q.SoLuongPhong
) x
UNION ALL
SELECT 'promotion used beyond SoLuongGioiHan', COUNT(*)
FROM KHUYEN_MAI k
WHERE k.SoLuongGioiHan > 0
  AND (SELECT COUNT(*) FROM DAT_PHONG d WHERE d.MaKhuyenMai = k.MaKhuyenMai AND d.TrangThai <> N'Đã hủy') > k.SoLuongGioiHan
UNION ALL
SELECT 'review on a booking that is not Hoàn tất', COUNT(*)
FROM DANH_GIA g JOIN DAT_PHONG d ON d.MaDatPhong = g.MaDatPhong WHERE d.TrangThai <> N'Hoàn tất'
UNION ALL
SELECT 'review customer/hotel differs from its booking', COUNT(*)
FROM DANH_GIA g JOIN DAT_PHONG d ON d.MaDatPhong = g.MaDatPhong
WHERE g.MaKhachHang <> d.MaTaiKhoanKhachHang OR g.MaKhachSan <> d.MaKhachSan
UNION ALL
SELECT 'more than one successful payment per booking', COUNT(*)
FROM (SELECT MaDatPhong FROM THANH_TOAN WHERE TrangThai = N'Thành công' GROUP BY MaDatPhong HAVING COUNT(*) > 1) x
UNION ALL
SELECT 'successful payment amount <> TongTienThanhToan', COUNT(*)
FROM THANH_TOAN t JOIN DAT_PHONG d ON d.MaDatPhong = t.MaDatPhong
WHERE t.TrangThai = N'Thành công' AND t.SoTien <> d.TongTienThanhToan
UNION ALL
SELECT 'confirmed/completed booking without a successful payment', COUNT(*)
FROM DAT_PHONG d
WHERE d.TrangThai IN (N'Đã xác nhận', N'Hoàn tất') AND d.TongTienThanhToan > 0
  AND NOT EXISTS (SELECT 1 FROM THANH_TOAN t WHERE t.MaDatPhong = d.MaDatPhong AND t.TrangThai = N'Thành công')
UNION ALL
SELECT 'refund larger than the payment', COUNT(*)
FROM HOAN_TIEN h JOIN THANH_TOAN t ON t.MaThanhToan = h.MaThanhToan WHERE h.SoTienHoan > t.SoTien
UNION ALL
SELECT 'refund on a booking that is not Đã hủy', COUNT(*)
FROM HOAN_TIEN h JOIN THANH_TOAN t ON t.MaThanhToan = h.MaThanhToan JOIN DAT_PHONG d ON d.MaDatPhong = t.MaDatPhong
WHERE d.TrangThai <> N'Đã hủy'
UNION ALL
SELECT 'Đã xác nhận booking already checked out (lazy sweep would flip it)', COUNT(*)
FROM DAT_PHONG d WHERE d.TrangThai = N'Đã xác nhận' AND d.NgayTraPhong < @today
UNION ALL
SELECT 'Hoàn tất booking not yet checked out', COUNT(*)
FROM DAT_PHONG d WHERE d.TrangThai = N'Hoàn tất' AND d.NgayTraPhong >= @today
UNION ALL
SELECT 'booking line on a room type of another hotel', COUNT(*)
FROM CHI_TIET_DAT_PHONG c JOIN DAT_PHONG d ON d.MaDatPhong = c.MaDatPhong JOIN LOAI_PHONG l ON l.MaLoaiPhong = c.MaLoaiPhong
WHERE l.MaKhachSan <> d.MaKhachSan
UNION ALL
SELECT 'booking total <> qty * sum of nightly rates', COUNT(*)
FROM DAT_PHONG d
CROSS APPLY (SELECT SUM(c.SoLuongPhong * q.GiaPhong) AS s
             FROM CHI_TIET_DAT_PHONG c JOIN QUY_PHONG_GIA q ON q.MaLoaiPhong = c.MaLoaiPhong
              AND q.NgayApDung >= d.NgayNhanPhong AND q.NgayApDung < d.NgayTraPhong
             WHERE c.MaDatPhong = d.MaDatPhong) x
WHERE d.MaXacNhanDatPhong LIKE 'DEMO-%' AND d.TongTienPhong <> x.s
UNION ALL
SELECT 'support request linked to someone else''s booking', COUNT(*)
FROM YEU_CAU_HO_TRO y JOIN DAT_PHONG d ON d.MaDatPhong = y.MaDatPhong WHERE d.MaTaiKhoanKhachHang <> y.MaTaiKhoanKhachHang
UNION ALL
SELECT 'hotel owned by an account that is not Chủ khách sạn', COUNT(*)
FROM KHACH_SAN k JOIN TAI_KHOAN t ON t.MaTaiKhoan = k.MaTaiKhoanSoHuu JOIN VAI_TRO r ON r.MaVaiTro = t.MaVaiTro
WHERE r.TenVaiTro <> N'Chủ khách sạn'
UNION ALL
SELECT 'hotel with no cover image (active hotels)', COUNT(*)
FROM KHACH_SAN k WHERE k.TrangThai = N'Hoạt động'
  AND NOT EXISTS (SELECT 1 FROM HINH_ANH_KHACH_SAN i WHERE i.MaKhachSan = k.MaKhachSan AND i.AnhDaiDien = 1)
UNION ALL
SELECT 'image URL not hosted on Cloudinary', COUNT(*)
FROM (SELECT URL FROM HINH_ANH_KHACH_SAN UNION ALL SELECT URL FROM HINH_ANH_LOAI_PHONG UNION ALL SELECT URL FROM HINH_ANH_DANH_GIA) u
WHERE u.URL NOT LIKE N'https://res.cloudinary.com/%';
