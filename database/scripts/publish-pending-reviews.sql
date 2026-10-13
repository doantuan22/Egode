-- =====================================================================
-- One-off data fix: publish reviews that were written under the old
-- "admin must approve first" rule.
--
-- Reviews are now created straight as 'Hiển thị'. Rows left over from
-- before that change are still 'Chờ duyệt', so they stay invisible and
-- uncounted until an admin opens each one. This moves them to 'Hiển thị'
-- as well, so old and new reviews follow the same rule.
--
-- Only 'Chờ duyệt' rows are touched; 'Ẩn' and 'Vi phạm' (admin decisions)
-- are left alone. Safe to re-run: a second run updates 0 rows.
-- =====================================================================

SELECT TrangThai, COUNT(*) AS SoLuong FROM DANH_GIA GROUP BY TrangThai;

UPDATE DANH_GIA
SET TrangThai = N'Hiển thị'
WHERE TrangThai = N'Chờ duyệt';

SELECT TrangThai, COUNT(*) AS SoLuong FROM DANH_GIA GROUP BY TrangThai;
