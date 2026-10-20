-- Migration 007: chỉ mục cho các truy vấn thường dùng, không đổi bảng hay cột

-- Chỉ mục có điều kiện cần QUOTED_IDENTIFIER bật
SET QUOTED_IDENTIFIER ON;
GO

-- DAT_PHONG

-- Quét tự hủy đơn chờ thanh toán quá hạn
CREATE INDEX IX_DAT_PHONG_TrangThai_NgayTao ON DAT_PHONG (TrangThai, NgayTao);
GO

-- Quét chuyển đơn đã xác nhận sang hoàn tất
CREATE INDEX IX_DAT_PHONG_TrangThai_NgayTraPhong ON DAT_PHONG (TrangThai, NgayTraPhong);
GO

-- Danh sách đặt phòng của khách, mới nhất trước
CREATE INDEX IX_DAT_PHONG_MaTaiKhoanKhachHang_NgayTao ON DAT_PHONG (MaTaiKhoanKhachHang, NgayTao DESC);
GO

-- Thống kê đơn theo khách sạn và khoảng ngày tạo
CREATE INDEX IX_DAT_PHONG_MaKhachSan_NgayTao ON DAT_PHONG (MaKhachSan, NgayTao);
GO

-- Đếm số lần dùng mã khuyến mãi
CREATE INDEX IX_DAT_PHONG_MaKhuyenMai ON DAT_PHONG (MaKhuyenMai) WHERE MaKhuyenMai IS NOT NULL;
GO

-- CHI_TIET_DAT_PHONG

-- Tính phòng trống theo loại phòng
CREATE INDEX IX_CHI_TIET_DAT_PHONG_MaLoaiPhong ON CHI_TIET_DAT_PHONG (MaLoaiPhong);
GO

-- LOAI_PHONG

-- Tra cứu loại phòng của khách sạn theo trạng thái
CREATE INDEX IX_LOAI_PHONG_MaKhachSan_TrangThai ON LOAI_PHONG (MaKhachSan, TrangThai);
GO

-- KHACH_SAN

-- Tìm kiếm khách sạn công khai theo trạng thái
CREATE INDEX IX_KHACH_SAN_TrangThai ON KHACH_SAN (TrangThai);
GO

-- Danh sách khách sạn của chủ sở hữu
CREATE INDEX IX_KHACH_SAN_MaTaiKhoanSoHuu_NgayDangKy ON KHACH_SAN (MaTaiKhoanSoHuu, NgayDangKy DESC);
GO

-- THANH_TOAN

-- Tra cứu thanh toán theo đơn đặt phòng
CREATE INDEX IX_THANH_TOAN_MaDatPhong ON THANH_TOAN (MaDatPhong);
GO

-- Tra cứu thanh toán theo tiền tố mã giao dịch
CREATE INDEX IX_THANH_TOAN_MaGiaoDichDoiTac ON THANH_TOAN (MaGiaoDichDoiTac);
GO

-- Báo cáo doanh thu theo trạng thái và thời gian giao dịch
CREATE INDEX IX_THANH_TOAN_TrangThai_ThoiGianGiaoDich ON THANH_TOAN (TrangThai, ThoiGianGiaoDich);
GO

-- HOAN_TIEN

-- Tra cứu hoàn tiền theo thanh toán
CREATE INDEX IX_HOAN_TIEN_MaThanhToan ON HOAN_TIEN (MaThanhToan);
GO

-- Báo cáo hoàn tiền theo ngày
CREATE INDEX IX_HOAN_TIEN_TrangThai_NgayHoanTien ON HOAN_TIEN (TrangThai, NgayHoanTien);
GO

-- YEU_CAU_HO_TRO

-- Danh sách yêu cầu hỗ trợ của khách
CREATE INDEX IX_YEU_CAU_HO_TRO_MaTaiKhoanKhachHang_NgayTao ON YEU_CAU_HO_TRO (MaTaiKhoanKhachHang, NgayTao DESC);
GO
