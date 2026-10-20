-- Migration 008: thủ tục khóa khuyến mãi để giới hạn lượt dùng đúng khi đặt phòng đồng thời

CREATE OR ALTER PROCEDURE dbo.usp_KhoaKhuyenMaiChoDatPhong
    @MaCode VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Giao dịch do bên gọi quản lý để khóa được giữ đến khi ghi đơn
    BEGIN TRY
        IF @@TRANCOUNT = 0
            THROW 50010, N'usp_KhoaKhuyenMaiChoDatPhong phải được gọi bên trong một transaction đang mở.', 1;

        DECLARE @MaKhuyenMai       INT,
                @LoaiGiamGia       NVARCHAR(20),
                @GiaTriGiam        DECIMAL(14,2),
                @GiaTriDonToiThieu DECIMAL(14,2),
                @MucGiamToiDa      DECIMAL(14,2),
                @SoLuongGioiHan    INT,
                @NgayBatDau        DATE,
                @NgayKetThuc       DATE,
                @TrangThai         NVARCHAR(30),
                @DaDung            INT;

        -- Khóa trước, đọc và kiểm tra sau
        SELECT @MaKhuyenMai       = MaKhuyenMai,
               @LoaiGiamGia       = LoaiGiamGia,
               @GiaTriGiam        = GiaTriGiam,
               @GiaTriDonToiThieu = GiaTriDonToiThieu,
               @MucGiamToiDa      = MucGiamToiDa,
               @SoLuongGioiHan    = SoLuongGioiHan,
               @NgayBatDau        = NgayBatDau,
               @NgayKetThuc       = NgayKetThuc,
               @TrangThai         = TrangThai
        FROM KHUYEN_MAI WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE MaCode = @MaCode;

        IF @MaKhuyenMai IS NULL
            THROW 50011, N'Mã khuyến mãi không tồn tại', 1;

        -- Đơn đã hủy không tính vào giới hạn
        SELECT @DaDung = COUNT(*)
        FROM DAT_PHONG
        WHERE MaKhuyenMai = @MaKhuyenMai
          AND TrangThai <> N'Đã hủy';

        IF @SoLuongGioiHan > 0 AND @DaDung >= @SoLuongGioiHan
            THROW 50012, N'Mã khuyến mãi đã hết lượt sử dụng', 1;

        SELECT @MaKhuyenMai       AS MaKhuyenMai,
               @MaCode            AS MaCode,
               @LoaiGiamGia       AS LoaiGiamGia,
               @GiaTriGiam        AS GiaTriGiam,
               @GiaTriDonToiThieu AS GiaTriDonToiThieu,
               @MucGiamToiDa      AS MucGiamToiDa,
               @SoLuongGioiHan    AS SoLuongGioiHan,
               @NgayBatDau        AS NgayBatDau,
               @NgayKetThuc       AS NgayKetThuc,
               @TrangThai         AS TrangThai,
               @DaDung            AS DaDung;
    END TRY
    BEGIN CATCH
        -- Không rollback ở đây vì giao dịch thuộc bên gọi, ném lại lỗi nguyên vẹn
        THROW;
    END CATCH
END
GO
