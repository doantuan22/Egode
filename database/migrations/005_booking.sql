-- Migration 005: đặt phòng gồm DAT_PHONG và CHI_TIET_DAT_PHONG

-- DAT_PHONG (Bảng 6.16)
CREATE TABLE DAT_PHONG (
    MaDatPhong             INT IDENTITY(1,1) NOT NULL,
    MaXacNhanDatPhong      VARCHAR(20)       NOT NULL,
    MaTaiKhoanKhachHang    INT               NOT NULL,
    MaKhachSan             INT               NOT NULL,
    MaKhuyenMai            INT               NULL,
    MaChinhSachHuy         INT               NOT NULL,
    NgayNhanPhong          DATE              NOT NULL,
    NgayTraPhong           DATE              NOT NULL,
    TongTienPhong          DECIMAL(14,2)     NOT NULL,
    SoTienGiam             DECIMAL(14,2)     NOT NULL,
    TongTienThanhToan      DECIMAL(14,2)     NOT NULL,
    GhiChu                 NVARCHAR(MAX)     NULL,
    TrangThai              NVARCHAR(30)      NOT NULL,
    NgayTao                DATETIME2         NOT NULL,
    NgayCapNhat            DATETIME2         NOT NULL,
    CONSTRAINT PK_DAT_PHONG PRIMARY KEY (MaDatPhong),
    CONSTRAINT UQ_DAT_PHONG_MaXacNhanDatPhong UNIQUE (MaXacNhanDatPhong),
    CONSTRAINT FK_DAT_PHONG_TAI_KHOAN FOREIGN KEY (MaTaiKhoanKhachHang)
        REFERENCES TAI_KHOAN (MaTaiKhoan) ON DELETE NO ACTION,
    CONSTRAINT FK_DAT_PHONG_KHACH_SAN FOREIGN KEY (MaKhachSan)
        REFERENCES KHACH_SAN (MaKhachSan) ON DELETE NO ACTION,
    CONSTRAINT FK_DAT_PHONG_KHUYEN_MAI FOREIGN KEY (MaKhuyenMai)
        REFERENCES KHUYEN_MAI (MaKhuyenMai) ON DELETE NO ACTION,
    CONSTRAINT FK_DAT_PHONG_CHINH_SACH_HUY FOREIGN KEY (MaChinhSachHuy)
        REFERENCES CHINH_SACH_HUY (MaChinhSachHuy) ON DELETE NO ACTION,
    CONSTRAINT CK_DAT_PHONG_NgayTraPhong CHECK (NgayTraPhong > NgayNhanPhong),
    CONSTRAINT CK_DAT_PHONG_TongTienPhong CHECK (TongTienPhong >= 0),
    CONSTRAINT CK_DAT_PHONG_SoTienGiam CHECK (SoTienGiam >= 0 AND SoTienGiam <= TongTienPhong),
    CONSTRAINT CK_DAT_PHONG_TongTienThanhToan CHECK (
        TongTienThanhToan >= 0 AND TongTienThanhToan = TongTienPhong - SoTienGiam
    ),
    CONSTRAINT CK_DAT_PHONG_NgayCapNhat CHECK (NgayCapNhat >= NgayTao)
);
GO

-- CHI_TIET_DAT_PHONG (Bảng 6.17)
CREATE TABLE CHI_TIET_DAT_PHONG (
    MaChiTietDatPhong  INT IDENTITY(1,1) NOT NULL,
    MaDatPhong         INT               NOT NULL,
    MaLoaiPhong        INT               NOT NULL,
    SoLuongPhong       INT               NOT NULL,
    CONSTRAINT PK_CHI_TIET_DAT_PHONG PRIMARY KEY (MaChiTietDatPhong),
    CONSTRAINT FK_CHI_TIET_DAT_PHONG_DAT_PHONG FOREIGN KEY (MaDatPhong)
        REFERENCES DAT_PHONG (MaDatPhong) ON DELETE NO ACTION,
    CONSTRAINT FK_CHI_TIET_DAT_PHONG_LOAI_PHONG FOREIGN KEY (MaLoaiPhong)
        REFERENCES LOAI_PHONG (MaLoaiPhong) ON DELETE NO ACTION,
    CONSTRAINT CK_CHI_TIET_DAT_PHONG_SoLuongPhong CHECK (SoLuongPhong >= 1)
);
GO
