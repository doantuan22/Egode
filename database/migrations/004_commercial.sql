-- Migration 004: chính sách hủy và khuyến mãi

-- CHINH_SACH_HUY (Bảng 6.13): cấp hệ thống, không có MaDatPhong và MaKhachSan
CREATE TABLE CHINH_SACH_HUY (
    MaChinhSachHuy  INT IDENTITY(1,1) NOT NULL,
    TenChinhSach    NVARCHAR(150)     NOT NULL,
    MoTa            NVARCHAR(MAX)     NOT NULL,
    TrangThai       NVARCHAR(30)      NOT NULL,
    NgayTao         DATETIME2         NOT NULL,
    CONSTRAINT PK_CHINH_SACH_HUY PRIMARY KEY (MaChinhSachHuy)
);
GO

-- CHI_TIET_CHINH_SACH_HUY (Bảng 6.14)
CREATE TABLE CHI_TIET_CHINH_SACH_HUY (
    MaChiTietChinhSach     INT IDENTITY(1,1) NOT NULL,
    MaChinhSachHuy         INT               NOT NULL,
    SoGioTruocNhanPhong    INT               NOT NULL,
    TyLeHoanTien           DECIMAL(5,2)      NOT NULL,
    CONSTRAINT PK_CHI_TIET_CHINH_SACH_HUY PRIMARY KEY (MaChiTietChinhSach),
    CONSTRAINT FK_CHI_TIET_CHINH_SACH_HUY_CHINH_SACH_HUY FOREIGN KEY (MaChinhSachHuy)
        REFERENCES CHINH_SACH_HUY (MaChinhSachHuy) ON DELETE NO ACTION,
    CONSTRAINT CK_CHI_TIET_CHINH_SACH_HUY_SoGio CHECK (SoGioTruocNhanPhong >= 0),
    CONSTRAINT CK_CHI_TIET_CHINH_SACH_HUY_TyLe CHECK (TyLeHoanTien BETWEEN 0 AND 100)
);
GO

-- KHUYEN_MAI (Bảng 6.15): không có bảng KHUYEN_MAI_KHACH_SAN
CREATE TABLE KHUYEN_MAI (
    MaKhuyenMai         INT IDENTITY(1,1) NOT NULL,
    MaCode               VARCHAR(50)       NOT NULL,
    LoaiGiamGia          NVARCHAR(20)      NOT NULL,
    GiaTriGiam           DECIMAL(14,2)     NOT NULL,
    GiaTriDonToiThieu    DECIMAL(14,2)     NOT NULL,
    MucGiamToiDa         DECIMAL(14,2)     NOT NULL,
    SoLuongGioiHan       INT               NOT NULL,
    NgayBatDau           DATE              NOT NULL,
    NgayKetThuc          DATE              NOT NULL,
    PhamViApDung         NVARCHAR(20)      NOT NULL,
    TrangThai            NVARCHAR(30)      NOT NULL,
    CONSTRAINT PK_KHUYEN_MAI PRIMARY KEY (MaKhuyenMai),
    CONSTRAINT UQ_KHUYEN_MAI_MaCode UNIQUE (MaCode),
    CONSTRAINT CK_KHUYEN_MAI_LoaiGiamGia CHECK (LoaiGiamGia IN (N'Phần trăm', N'Số tiền cố định')),
    CONSTRAINT CK_KHUYEN_MAI_GiaTriGiam CHECK (GiaTriGiam > 0),
    CONSTRAINT CK_KHUYEN_MAI_GiaTriDonToiThieu CHECK (GiaTriDonToiThieu >= 0),
    CONSTRAINT CK_KHUYEN_MAI_MucGiamToiDa CHECK (MucGiamToiDa >= 0),
    CONSTRAINT CK_KHUYEN_MAI_SoLuongGioiHan CHECK (SoLuongGioiHan >= 0),
    CONSTRAINT CK_KHUYEN_MAI_NgayKetThuc CHECK (NgayKetThuc >= NgayBatDau),
    CONSTRAINT CK_KHUYEN_MAI_PhamViApDung CHECK (PhamViApDung IN (N'Toàn hệ thống', N'Theo phạm vi'))
);
GO
