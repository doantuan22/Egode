-- Migration 006: thanh toán và hậu mãi

-- THANH_TOAN (Bảng 6.18)
CREATE TABLE THANH_TOAN (
    MaThanhToan            INT IDENTITY(1,1) NOT NULL,
    MaDatPhong             INT               NOT NULL,
    SoTien                 DECIMAL(14,2)     NOT NULL,
    PhuongThucThanhToan    NVARCHAR(50)      NOT NULL,
    MaGiaoDichDoiTac       VARCHAR(100)      NOT NULL,
    TrangThai              NVARCHAR(30)      NOT NULL,
    ThoiGianGiaoDich       DATETIME2         NOT NULL,
    CONSTRAINT PK_THANH_TOAN PRIMARY KEY (MaThanhToan),
    CONSTRAINT FK_THANH_TOAN_DAT_PHONG FOREIGN KEY (MaDatPhong)
        REFERENCES DAT_PHONG (MaDatPhong) ON DELETE NO ACTION,
    CONSTRAINT CK_THANH_TOAN_SoTien CHECK (SoTien > 0)
);
GO

-- HOAN_TIEN (Bảng 6.19)
CREATE TABLE HOAN_TIEN (
    MaHoanTien          INT IDENTITY(1,1) NOT NULL,
    MaThanhToan         INT               NOT NULL,
    SoTienHoan          DECIMAL(14,2)     NOT NULL,
    LyDoHoanTien        NVARCHAR(500)     NOT NULL,
    MaGiaoDichDoiTac    VARCHAR(100)      NOT NULL,
    TrangThai           NVARCHAR(30)      NOT NULL,
    NgayYeuCau          DATETIME2         NOT NULL,
    NgayHoanTien        DATETIME2         NULL,
    CONSTRAINT PK_HOAN_TIEN PRIMARY KEY (MaHoanTien),
    CONSTRAINT FK_HOAN_TIEN_THANH_TOAN FOREIGN KEY (MaThanhToan)
        REFERENCES THANH_TOAN (MaThanhToan) ON DELETE NO ACTION,
    CONSTRAINT CK_HOAN_TIEN_SoTienHoan CHECK (SoTienHoan >= 0),
    CONSTRAINT CK_HOAN_TIEN_NgayHoanTien CHECK (NgayHoanTien IS NULL OR NgayHoanTien >= NgayYeuCau)
);
GO

-- DANH_GIA (Bảng 6.20): mỗi đơn đặt phòng có tối đa một đánh giá
CREATE TABLE DANH_GIA (
    MaDanhGia       INT IDENTITY(1,1) NOT NULL,
    MaDatPhong      INT               NOT NULL,
    MaKhachHang     INT               NOT NULL,
    MaKhachSan      INT               NOT NULL,
    DiemDanhGia     TINYINT           NOT NULL,
    NoiDung         NVARCHAR(MAX)     NULL,
    TrangThai       NVARCHAR(30)      NOT NULL,
    CONSTRAINT PK_DANH_GIA PRIMARY KEY (MaDanhGia),
    CONSTRAINT UQ_DANH_GIA_MaDatPhong UNIQUE (MaDatPhong),
    CONSTRAINT FK_DANH_GIA_DAT_PHONG FOREIGN KEY (MaDatPhong)
        REFERENCES DAT_PHONG (MaDatPhong) ON DELETE NO ACTION,
    CONSTRAINT FK_DANH_GIA_TAI_KHOAN FOREIGN KEY (MaKhachHang)
        REFERENCES TAI_KHOAN (MaTaiKhoan) ON DELETE NO ACTION,
    CONSTRAINT FK_DANH_GIA_KHACH_SAN FOREIGN KEY (MaKhachSan)
        REFERENCES KHACH_SAN (MaKhachSan) ON DELETE NO ACTION,
    CONSTRAINT CK_DANH_GIA_DiemDanhGia CHECK (DiemDanhGia BETWEEN 1 AND 5)
);
GO

-- HINH_ANH_DANH_GIA (Bảng 6.21)
CREATE TABLE HINH_ANH_DANH_GIA (
    MaHinhAnhDanhGia  INT IDENTITY(1,1) NOT NULL,
    MaDanhGia         INT               NOT NULL,
    URL               NVARCHAR(500)     NOT NULL,
    CONSTRAINT PK_HINH_ANH_DANH_GIA PRIMARY KEY (MaHinhAnhDanhGia),
    CONSTRAINT FK_HINH_ANH_DANH_GIA_DANH_GIA FOREIGN KEY (MaDanhGia)
        REFERENCES DANH_GIA (MaDanhGia) ON DELETE NO ACTION
);
GO

-- YEU_CAU_HO_TRO (Bảng 6.22): người xử lý tham chiếu TAI_KHOAN
CREATE TABLE YEU_CAU_HO_TRO (
    MaYeuCauHoTro           INT IDENTITY(1,1) NOT NULL,
    MaTaiKhoanKhachHang     INT               NOT NULL,
    MaTaiKhoanXuLy          INT               NULL,
    MaDatPhong              INT               NULL,
    LoaiYeuCau              NVARCHAR(20)      NOT NULL,
    TieuDe                  NVARCHAR(255)     NOT NULL,
    NoiDung                 NVARCHAR(MAX)     NOT NULL,
    KetQuaXuLy               NVARCHAR(MAX)     NULL,
    TrangThai               NVARCHAR(30)      NOT NULL,
    NgayTao                 DATETIME2         NOT NULL,
    NgayXuLy                DATETIME2         NULL,
    CONSTRAINT PK_YEU_CAU_HO_TRO PRIMARY KEY (MaYeuCauHoTro),
    CONSTRAINT FK_YEU_CAU_HO_TRO_TAI_KHOAN_KhachHang FOREIGN KEY (MaTaiKhoanKhachHang)
        REFERENCES TAI_KHOAN (MaTaiKhoan) ON DELETE NO ACTION,
    CONSTRAINT FK_YEU_CAU_HO_TRO_TAI_KHOAN_XuLy FOREIGN KEY (MaTaiKhoanXuLy)
        REFERENCES TAI_KHOAN (MaTaiKhoan) ON DELETE NO ACTION,
    CONSTRAINT FK_YEU_CAU_HO_TRO_DAT_PHONG FOREIGN KEY (MaDatPhong)
        REFERENCES DAT_PHONG (MaDatPhong) ON DELETE NO ACTION,
    CONSTRAINT CK_YEU_CAU_HO_TRO_LoaiYeuCau CHECK (LoaiYeuCau IN (N'Hỗ trợ', N'Khiếu nại')),
    CONSTRAINT CK_YEU_CAU_HO_TRO_NgayXuLy CHECK (NgayXuLy IS NULL OR NgayXuLy >= NgayTao)
);
GO
