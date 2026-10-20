-- Migration 003: quỹ phòng gồm LOAI_PHONG, HINH_ANH_LOAI_PHONG, LOAI_PHONG_TIEN_NGHI, QUY_PHONG_GIA

-- LOAI_PHONG (Bảng 6.9)
CREATE TABLE LOAI_PHONG (
    MaLoaiPhong    INT IDENTITY(1,1) NOT NULL,
    MaKhachSan     INT               NOT NULL,
    TenLoaiPhong   NVARCHAR(150)     NOT NULL,
    SoGiuong       INT               NOT NULL,
    SucChua        INT               NOT NULL,
    DienTich       DECIMAL(6,2)      NOT NULL,
    LoaiGiuong     NVARCHAR(50)      NOT NULL,
    MoTa           NVARCHAR(MAX)     NULL,
    TrangThai      NVARCHAR(30)      NOT NULL,
    CONSTRAINT PK_LOAI_PHONG PRIMARY KEY (MaLoaiPhong),
    CONSTRAINT FK_LOAI_PHONG_KHACH_SAN FOREIGN KEY (MaKhachSan)
        REFERENCES KHACH_SAN (MaKhachSan) ON DELETE NO ACTION,
    CONSTRAINT CK_LOAI_PHONG_SucChua CHECK (SucChua >= 1),
    CONSTRAINT CK_LOAI_PHONG_DienTich CHECK (DienTich > 0)
);
GO

-- HINH_ANH_LOAI_PHONG (Bảng 6.10)
CREATE TABLE HINH_ANH_LOAI_PHONG (
    MaHinhAnhLoaiPhong  INT IDENTITY(1,1) NOT NULL,
    MaLoaiPhong         INT               NOT NULL,
    URL                 NVARCHAR(500)     NOT NULL,
    LaAnhDaiDien        BIT               NOT NULL,
    CONSTRAINT PK_HINH_ANH_LOAI_PHONG PRIMARY KEY (MaHinhAnhLoaiPhong),
    CONSTRAINT FK_HINH_ANH_LOAI_PHONG_LOAI_PHONG FOREIGN KEY (MaLoaiPhong)
        REFERENCES LOAI_PHONG (MaLoaiPhong) ON DELETE NO ACTION
);
GO

-- LOAI_PHONG_TIEN_NGHI (Bảng 6.11, khóa chính ghép)
CREATE TABLE LOAI_PHONG_TIEN_NGHI (
    MaLoaiPhong  INT NOT NULL,
    MaTienNghi   INT NOT NULL,
    CONSTRAINT PK_LOAI_PHONG_TIEN_NGHI PRIMARY KEY (MaLoaiPhong, MaTienNghi),
    CONSTRAINT FK_LOAI_PHONG_TIEN_NGHI_LOAI_PHONG FOREIGN KEY (MaLoaiPhong)
        REFERENCES LOAI_PHONG (MaLoaiPhong) ON DELETE NO ACTION,
    CONSTRAINT FK_LOAI_PHONG_TIEN_NGHI_TIEN_NGHI FOREIGN KEY (MaTienNghi)
        REFERENCES TIEN_NGHI (MaTienNghi) ON DELETE NO ACTION
);
GO

-- QUY_PHONG_GIA (Bảng 6.12): mỗi loại phòng chỉ có một bản ghi mỗi ngày áp dụng
CREATE TABLE QUY_PHONG_GIA (
    MaQuyPhong     INT IDENTITY(1,1) NOT NULL,
    MaLoaiPhong    INT               NOT NULL,
    NgayApDung     DATE              NOT NULL,
    GiaPhong       DECIMAL(14,2)     NOT NULL,
    SoLuongPhong   INT               NOT NULL,
    TrangThai      NVARCHAR(30)      NOT NULL,
    CONSTRAINT PK_QUY_PHONG_GIA PRIMARY KEY (MaQuyPhong),
    CONSTRAINT FK_QUY_PHONG_GIA_LOAI_PHONG FOREIGN KEY (MaLoaiPhong)
        REFERENCES LOAI_PHONG (MaLoaiPhong) ON DELETE NO ACTION,
    CONSTRAINT CK_QUY_PHONG_GIA_GiaPhong CHECK (GiaPhong >= 0),
    CONSTRAINT CK_QUY_PHONG_GIA_SoLuongPhong CHECK (SoLuongPhong >= 0),
    CONSTRAINT UQ_QUY_PHONG_GIA_MaLoaiPhong_NgayApDung UNIQUE (MaLoaiPhong, NgayApDung)
);
GO
