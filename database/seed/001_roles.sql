-- Seed các vai trò nền tảng của VAI_TRO, chạy lại an toàn

MERGE VAI_TRO AS target
USING (VALUES
    (N'Khách hàng', N'Người dùng đặt phòng trên nền tảng'),
    (N'Chủ khách sạn', N'Đối tác sở hữu và quản lý khách sạn trên nền tảng'),
    (N'Quản trị hệ thống', N'Quản trị viên vận hành nền tảng')
) AS source (TenVaiTro, MoTa)
ON target.TenVaiTro = source.TenVaiTro
WHEN NOT MATCHED THEN
    INSERT (TenVaiTro, MoTa) VALUES (source.TenVaiTro, source.MoTa);
GO
