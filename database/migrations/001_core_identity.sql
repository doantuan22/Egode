-- Migration 001: bảng danh tính gồm VAI_TRO, TAI_KHOAN, DIA_PHUONG, HO_SO_DOI_TAC

-- VAI_TRO (Bảng 6.1)
CREATE TABLE VAI_TRO (
    MaVaiTro   INT IDENTITY(1,1) NOT NULL,
    TenVaiTro  NVARCHAR(100)     NOT NULL,
    MoTa       NVARCHAR(255)     NOT NULL,
    CONSTRAINT PK_VAI_TRO PRIMARY KEY (MaVaiTro),
    CONSTRAINT UQ_VAI_TRO_TenVaiTro UNIQUE (TenVaiTro)
);
GO

-- TAI_KHOAN (Bảng 6.2)
CREATE TABLE TAI_KHOAN (
    MaTaiKhoan    INT IDENTITY(1,1) NOT NULL,
    MaVaiTro      INT               NOT NULL,
    TenDangNhap   NVARCHAR(100)     NOT NULL,
    Email         NVARCHAR(255)     NOT NULL,
    MatKhau       NVARCHAR(255)     NOT NULL,
    HoTen         NVARCHAR(150)     NOT NULL,
    SoDienThoai   VARCHAR(20)       NOT NULL,
    NgaySinh      DATE              NULL,
    GioiTinh      NVARCHAR(20)      NULL,
    AnhDaiDien    NVARCHAR(500)     NULL,
    TrangThai     NVARCHAR(30)      NOT NULL,
    NgayTao       DATETIME2         NOT NULL,
    NgayCapNhat   DATETIME2         NOT NULL,
    CONSTRAINT PK_TAI_KHOAN PRIMARY KEY (MaTaiKhoan),
    CONSTRAINT UQ_TAI_KHOAN_TenDangNhap UNIQUE (TenDangNhap),
    CONSTRAINT UQ_TAI_KHOAN_Email UNIQUE (Email),
    CONSTRAINT FK_TAI_KHOAN_VAI_TRO FOREIGN KEY (MaVaiTro)
        REFERENCES VAI_TRO (MaVaiTro) ON DELETE NO ACTION,
    CONSTRAINT CK_TAI_KHOAN_Email CHECK (Email LIKE '%_@_%.__%'),
    CONSTRAINT CK_TAI_KHOAN_MatKhau CHECK (LEN(MatKhau) > 0),
    CONSTRAINT CK_TAI_KHOAN_NgayCapNhat CHECK (NgayCapNhat >= NgayTao)
);
GO

-- DIA_PHUONG (Bảng 6.4)
CREATE TABLE DIA_PHUONG (
    MaDiaPhuong  INT IDENTITY(1,1) NOT NULL,
    TenThanhPho  NVARCHAR(150)     NOT NULL,
    TenTinh      NVARCHAR(150)     NOT NULL,
    QuocGia      NVARCHAR(100)     NOT NULL,
    CONSTRAINT PK_DIA_PHUONG PRIMARY KEY (MaDiaPhuong)
);
GO

-- HO_SO_DOI_TAC (Bảng 6.3 + G0-04: MaTaiKhoanDuyet)
CREATE TABLE HO_SO_DOI_TAC (
    MaHoSoDoiTac         INT IDENTITY(1,1) NOT NULL,
    MaTaiKhoan           INT               NOT NULL,
    SoCCCD               VARCHAR(20)       NOT NULL,
    SoGiayPhepKinhDoanh  VARCHAR(50)       NOT NULL,
    MaSoThue             VARCHAR(20)       NOT NULL,
    TepGiayTo            NVARCHAR(500)     NOT NULL,
    TrangThaiDuyet       NVARCHAR(20)      NOT NULL,
    LyDoTuChoi           NVARCHAR(500)     NULL,
    NgayNop              DATETIME2         NOT NULL,
    NgayDuyet            DATETIME2         NULL,
    MaTaiKhoanDuyet      INT               NULL,
    CONSTRAINT PK_HO_SO_DOI_TAC PRIMARY KEY (MaHoSoDoiTac),
    CONSTRAINT FK_HO_SO_DOI_TAC_TAI_KHOAN FOREIGN KEY (MaTaiKhoan)
        REFERENCES TAI_KHOAN (MaTaiKhoan) ON DELETE NO ACTION,
    CONSTRAINT FK_HO_SO_DOI_TAC_TAI_KHOAN_Duyet FOREIGN KEY (MaTaiKhoanDuyet)
        REFERENCES TAI_KHOAN (MaTaiKhoan) ON DELETE NO ACTION,
    CONSTRAINT CK_HO_SO_DOI_TAC_TrangThaiDuyet CHECK (TrangThaiDuyet IN (N'Chờ duyệt', N'Đã duyệt', N'Từ chối')),
    CONSTRAINT CK_HO_SO_DOI_TAC_NgayDuyet CHECK (NgayDuyet IS NULL OR NgayDuyet >= NgayNop)
);
GO
