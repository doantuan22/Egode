-- Chuyển các đánh giá Chờ duyệt cũ sang Hiển thị, chạy lại an toàn

SELECT TrangThai, COUNT(*) AS SoLuong FROM DANH_GIA GROUP BY TrangThai;

UPDATE DANH_GIA
SET TrangThai = N'Hiển thị'
WHERE TrangThai = N'Chờ duyệt';

SELECT TrangThai, COUNT(*) AS SoLuong FROM DANH_GIA GROUP BY TrangThai;
