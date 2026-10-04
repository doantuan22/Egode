import { getPrismaClient } from '../config/prisma';
import { hashPassword } from '../common/utils/password';
import { ACCOUNT_STATUS } from '../common/constants/account-status';
import { ROLE_NAMES, RoleName } from '../common/constants/roles';
import { HOTEL_STATUS, ROOM_TYPE_STATUS, BOOKING_STATUS } from '../common/constants/hotel-status';
import { PROMOTION_STATUS, DISCOUNT_TYPE, CANCELLATION_POLICY_STATUS } from '../common/constants/commercial';
import { PAYMENT_STATUS, PAYMENT_METHOD, REFUND_STATUS } from '../common/constants/payment';

let roleIdCache: Map<string, number> | null = null;

export const getRoleId = async (roleName: RoleName): Promise<number> => {
  if (!roleIdCache) {
    const prisma = getPrismaClient();
    const roles = await prisma.vAI_TRO.findMany();
    roleIdCache = new Map(roles.map((r) => [r.TenVaiTro, r.MaVaiTro]));
  }
  const id = roleIdCache.get(roleName);
  if (!id) {
    throw new Error(
      `Role "${roleName}" not seeded — run database/seed/001_roles.sql against the test database first`
    );
  }
  return id;
};

let counter = 0;
// Date.now() alone can collide when test files run in parallel processes;
// mix in randomness + a per-module counter to keep TenDangNhap/Email unique.
const unique = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${++counter}`;

export interface TestAccountOptions {
  role?: RoleName;
  status?: string;
  password?: string;
}

export const createTestAccount = async (options: TestAccountOptions = {}) => {
  const prisma = getPrismaClient();
  const suffix = unique();
  const plainPassword = options.password ?? 'Test@12345';
  const roleId = await getRoleId(options.role ?? ROLE_NAMES.CUSTOMER);

  const account = await prisma.tAI_KHOAN.create({
    data: {
      TenDangNhap: `testuser_${suffix}`,
      Email: `test_${suffix}@example.com`,
      MatKhau: await hashPassword(plainPassword),
      HoTen: 'Test User',
      SoDienThoai: '0900000000',
      NgaySinh: new Date('1995-01-01'),
      GioiTinh: 'Khác',
      AnhDaiDien: '',
      TrangThai: options.status ?? ACCOUNT_STATUS.ACTIVE,
      NgayTao: new Date(),
      NgayCapNhat: new Date(),
      VAI_TRO: { connect: { MaVaiTro: roleId } },
    },
  });

  return { account, plainPassword };
};

export const deleteTestAccount = async (maTaiKhoan: number): Promise<void> => {
  const prisma = getPrismaClient();
  await prisma.hO_SO_DOI_TAC.deleteMany({ where: { MaTaiKhoan: maTaiKhoan } });
  await prisma.tAI_KHOAN.delete({ where: { MaTaiKhoan: maTaiKhoan } }).catch(() => undefined);
};

export const createTestDiaPhuong = async () => {
  const prisma = getPrismaClient();
  const suffix = unique();
  return prisma.dIA_PHUONG.create({
    data: { TenThanhPho: `TestCity_${suffix}`, TenTinh: `TestProvince_${suffix}`, QuocGia: 'Việt Nam' },
  });
};

export interface TestHotelOptions {
  status?: string;
  /** Marks a non-active hotel as one an admin approved before (sets NgayDuyet). */
  approved?: boolean;
}

export const createTestHotel = async (
  ownerId: number,
  maDiaPhuong: number,
  options: TestHotelOptions = {}
) => {
  const prisma = getPrismaClient();
  const suffix = unique();
  const now = new Date();
  return prisma.kHACH_SAN.create({
    data: {
      TenKhachSan: `Test Hotel ${suffix}`,
      DiaChiChiTiet: '1 Test Street',
      HangSao: 3,
      MoTa: 'Test hotel',
      GioNhanPhong: new Date('1970-01-01T14:00:00Z'),
      GioTraPhong: new Date('1970-01-01T12:00:00Z'),
      TrangThai: options.status ?? HOTEL_STATUS.ACTIVE,
      NgayDangKy: now,
      // A hotel that is live was approved at some point (real data always carries NgayDuyet).
      ...((options.status ?? HOTEL_STATUS.ACTIVE) === HOTEL_STATUS.ACTIVE || options.approved ? { NgayDuyet: now } : {}),
      NgayCapNhat: now,
      TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: { connect: { MaTaiKhoan: ownerId } },
      DIA_PHUONG: { connect: { MaDiaPhuong: maDiaPhuong } },
    },
  });
};

export const createTestRoomType = async (maKhachSan: number) => {
  const prisma = getPrismaClient();
  const suffix = unique();
  return prisma.lOAI_PHONG.create({
    data: {
      MaKhachSan: maKhachSan,
      TenLoaiPhong: `Test Room ${suffix}`,
      SoGiuong: 1,
      SucChua: 2,
      DienTich: 20,
      LoaiGiuong: 'Giường đôi',
      MoTa: 'Test room type',
      TrangThai: ROOM_TYPE_STATUS.ACTIVE,
    },
  });
};

/** Cascading cleanup for a hotel created via createTestHotel (room types, images, rates, amenities). */
export const deleteTestHotel = async (maKhachSan: number): Promise<void> => {
  const prisma = getPrismaClient();
  const roomTypes = await prisma.lOAI_PHONG.findMany({ where: { MaKhachSan: maKhachSan }, select: { MaLoaiPhong: true } });
  const roomTypeIds = roomTypes.map((r) => r.MaLoaiPhong);

  if (roomTypeIds.length > 0) {
    await prisma.qUY_PHONG_GIA.deleteMany({ where: { MaLoaiPhong: { in: roomTypeIds } } });
    await prisma.hINH_ANH_LOAI_PHONG.deleteMany({ where: { MaLoaiPhong: { in: roomTypeIds } } });
    await prisma.lOAI_PHONG_TIEN_NGHI.deleteMany({ where: { MaLoaiPhong: { in: roomTypeIds } } });
    await prisma.lOAI_PHONG.deleteMany({ where: { MaLoaiPhong: { in: roomTypeIds } } });
  }
  await prisma.hINH_ANH_KHACH_SAN.deleteMany({ where: { MaKhachSan: maKhachSan } });
  await prisma.kHACH_SAN_TIEN_NGHI.deleteMany({ where: { MaKhachSan: maKhachSan } });
  await prisma.kHACH_SAN.delete({ where: { MaKhachSan: maKhachSan } }).catch(() => undefined);
};

export const deleteTestDiaPhuong = async (maDiaPhuong: number): Promise<void> => {
  const prisma = getPrismaClient();
  await prisma.dIA_PHUONG.delete({ where: { MaDiaPhuong: maDiaPhuong } }).catch(() => undefined);
};

export const createTestAmenity = async () => {
  const prisma = getPrismaClient();
  const suffix = unique();
  return prisma.tIEN_NGHI.create({ data: { TenTienNghi: `TestAmenity_${suffix}`, BieuTuong: 'icon' } });
};

export const deleteTestAmenity = async (maTienNghi: number): Promise<void> => {
  const prisma = getPrismaClient();
  await prisma.tIEN_NGHI.delete({ where: { MaTienNghi: maTienNghi } }).catch(() => undefined);
};

export interface TestPromotionOptions {
  loaiGiamGia?: string;
  giaTriGiam?: number;
  giaTriDonToiThieu?: number;
  mucGiamToiDa?: number;
  soLuongGioiHan?: number;
  ngayBatDau?: Date;
  ngayKetThuc?: Date;
  trangThai?: string;
}

export const createTestPromotion = async (options: TestPromotionOptions = {}) => {
  const prisma = getPrismaClient();
  const suffix = unique();
  const today = new Date();
  const in30Days = new Date(Date.now() + 30 * 86400000);
  return prisma.kHUYEN_MAI.create({
    data: {
      MaCode: `TEST_${suffix}`.slice(0, 50).toUpperCase(),
      LoaiGiamGia: options.loaiGiamGia ?? DISCOUNT_TYPE.PERCENT,
      GiaTriGiam: options.giaTriGiam ?? 10,
      GiaTriDonToiThieu: options.giaTriDonToiThieu ?? 0,
      MucGiamToiDa: options.mucGiamToiDa ?? 0,
      SoLuongGioiHan: options.soLuongGioiHan ?? 0,
      NgayBatDau: options.ngayBatDau ?? today,
      NgayKetThuc: options.ngayKetThuc ?? in30Days,
      PhamViApDung: 'Toàn hệ thống',
      TrangThai: options.trangThai ?? PROMOTION_STATUS.ACTIVE,
    },
  });
};

export const deleteTestPromotion = async (maKhuyenMai: number): Promise<void> => {
  const prisma = getPrismaClient();
  await prisma.kHUYEN_MAI.delete({ where: { MaKhuyenMai: maKhuyenMai } }).catch(() => undefined);
};

/**
 * A CHINH_SACH_HUY dedicated to one test — NOT the system-wide "oldest
 * active" default that createBooking resolves (see M5 report §6 /
 * cancellation-policies.repository.ts findActiveDefault). Attached directly
 * to a test booking's MaChinhSachHuy so tier-selection tests get exact,
 * known thresholds regardless of whatever the seeded default policy is.
 */
export const createTestCancellationPolicy = async (
  tiers: Array<{ soGioTruocNhanPhong: number; tyLeHoanTien: number }>
) => {
  const prisma = getPrismaClient();
  const suffix = unique();
  const policy = await prisma.cHINH_SACH_HUY.create({
    data: {
      TenChinhSach: `Test Policy ${suffix}`,
      MoTa: 'Test cancellation policy',
      TrangThai: CANCELLATION_POLICY_STATUS.ACTIVE,
      NgayTao: new Date(),
    },
  });
  await prisma.cHI_TIET_CHINH_SACH_HUY.createMany({
    data: tiers.map((t) => ({
      MaChinhSachHuy: policy.MaChinhSachHuy,
      SoGioTruocNhanPhong: t.soGioTruocNhanPhong,
      TyLeHoanTien: t.tyLeHoanTien,
    })),
  });
  return policy;
};

export const deleteTestCancellationPolicy = async (maChinhSachHuy: number): Promise<void> => {
  const prisma = getPrismaClient();
  await prisma.cHI_TIET_CHINH_SACH_HUY.deleteMany({ where: { MaChinhSachHuy: maChinhSachHuy } });
  await prisma.cHINH_SACH_HUY.delete({ where: { MaChinhSachHuy: maChinhSachHuy } }).catch(() => undefined);
};

export interface TestBookingOptions {
  maKhuyenMai?: number | null;
  tongTienPhong?: number;
  soTienGiam?: number;
  trangThai?: string;
  ngayTao?: Date;
  ghiChu?: string | null;
}

/**
 * Inserts a DAT_PHONG row directly (bypassing POST /hotels/:id/bookings) so
 * payment/cancellation/refund tests can set up an exact starting state
 * (a specific TrangThai, a backdated NgayTao to simulate a timed-out hold,
 * a specific MaChinhSachHuy) without depending on real QUY_PHONG_GIA
 * inventory or the M5 pricing/locking flow — mirrors the direct-DB-insert
 * pattern already used for the M5 "cancelled booking" fixture (see
 * bookings.test.ts line ~245).
 */
export const createTestBookingDirect = async (
  maTaiKhoanKhachHang: number,
  maKhachSan: number,
  maChinhSachHuy: number,
  ngayNhanPhong: Date,
  ngayTraPhong: Date,
  options: TestBookingOptions = {}
) => {
  const prisma = getPrismaClient();
  const suffix = unique();
  const now = options.ngayTao ?? new Date();
  const tongTienPhong = options.tongTienPhong ?? 1_000_000;
  const soTienGiam = options.soTienGiam ?? 0;
  return prisma.dAT_PHONG.create({
    data: {
      MaXacNhanDatPhong: `TST${suffix}`.slice(0, 20),
      TAI_KHOAN: { connect: { MaTaiKhoan: maTaiKhoanKhachHang } },
      KHACH_SAN: { connect: { MaKhachSan: maKhachSan } },
      ...(options.maKhuyenMai ? { KHUYEN_MAI: { connect: { MaKhuyenMai: options.maKhuyenMai } } } : {}),
      CHINH_SACH_HUY: { connect: { MaChinhSachHuy: maChinhSachHuy } },
      NgayNhanPhong: ngayNhanPhong,
      NgayTraPhong: ngayTraPhong,
      TongTienPhong: tongTienPhong,
      SoTienGiam: soTienGiam,
      TongTienThanhToan: tongTienPhong - soTienGiam,
      GhiChu: options.ghiChu ?? null,
      TrangThai: options.trangThai ?? BOOKING_STATUS.PENDING_PAYMENT,
      NgayTao: now,
      NgayCapNhat: now,
    },
  });
};

export const createTestPayment = async (
  maDatPhong: number,
  soTien: number,
  trangThai: string = PAYMENT_STATUS.SUCCESS,
  maGiaoDichDoiTac?: string,
  thoiGianGiaoDich?: Date
) => {
  const prisma = getPrismaClient();
  const suffix = unique();
  return prisma.tHANH_TOAN.create({
    data: {
      MaDatPhong: maDatPhong,
      SoTien: soTien,
      PhuongThucThanhToan: PAYMENT_METHOD.VNPAY,
      MaGiaoDichDoiTac: maGiaoDichDoiTac ?? `TESTPAY_${suffix}`,
      TrangThai: trangThai,
      ThoiGianGiaoDich: thoiGianGiaoDich ?? new Date(),
    },
  });
};

export const createTestRefund = async (
  maThanhToan: number,
  soTienHoan: number,
  trangThai: string = REFUND_STATUS.SUCCESS,
  ngayHoanTien?: Date | null,
  ngayYeuCau?: Date
) => {
  const prisma = getPrismaClient();
  const suffix = unique();
  const requested = ngayYeuCau ?? new Date();
  return prisma.hOAN_TIEN.create({
    data: {
      MaThanhToan: maThanhToan,
      SoTienHoan: soTienHoan,
      LyDoHoanTien: 'Test refund',
      MaGiaoDichDoiTac: `TESTREFUND_${suffix}`,
      TrangThai: trangThai,
      NgayYeuCau: requested,
      NgayHoanTien: ngayHoanTien === undefined ? requested : ngayHoanTien,
    },
  });
};
