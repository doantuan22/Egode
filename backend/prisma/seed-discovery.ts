/** Seed dữ liệu demo cho tìm kiếm, chi tiết khách sạn, phòng, giá và tồn kho */
import { getPrismaClient, disconnectPrisma } from '../src/config/prisma';
import { hashPassword } from '../src/common/utils/password';
import { ROLE_NAMES } from '../src/common/constants/roles';
import { ACCOUNT_STATUS } from '../src/common/constants/account-status';
import {
  HOTEL_STATUS,
  ROOM_TYPE_STATUS,
  ROOM_RATE_STATUS,
  BOOKING_STATUS,
} from '../src/common/constants/hotel-status';

const prisma = getPrismaClient();

const addDays = (base: Date, days: number): Date => {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};
const today = addDays(new Date(), 0);
const isWeekendNight = (date: Date) => [5, 6].includes(date.getUTCDay());

async function getRoleId(name: string): Promise<number> {
  const role = await prisma.vAI_TRO.findUnique({ where: { TenVaiTro: name } });
  if (!role) throw new Error(`Role "${name}" not seeded — run database/seed/001_roles.sql first`);
  return role.MaVaiTro;
}

async function ensureAccount(params: {
  tenDangNhap: string;
  email: string;
  hoTen: string;
  role: string;
  soDienThoai: string;
}): Promise<number> {
  const existing = await prisma.tAI_KHOAN.findUnique({ where: { TenDangNhap: params.tenDangNhap } });
  if (existing) return existing.MaTaiKhoan;

  const roleId = await getRoleId(params.role);
  const account = await prisma.tAI_KHOAN.create({
    data: {
      TenDangNhap: params.tenDangNhap,
      Email: params.email,
      MatKhau: await hashPassword('Seed@12345'),
      HoTen: params.hoTen,
      SoDienThoai: params.soDienThoai,
      TrangThai: ACCOUNT_STATUS.ACTIVE,
      NgayTao: new Date(),
      NgayCapNhat: new Date(),
      VAI_TRO: { connect: { MaVaiTro: roleId } },
    },
  });
  return account.MaTaiKhoan;
}

async function ensureDiaPhuong(tenThanhPho: string, tenTinh: string, quocGia = 'Việt Nam'): Promise<number> {
  const existing = await prisma.dIA_PHUONG.findFirst({ where: { TenThanhPho: tenThanhPho, TenTinh: tenTinh } });
  if (existing) return existing.MaDiaPhuong;
  const created = await prisma.dIA_PHUONG.create({ data: { TenThanhPho: tenThanhPho, TenTinh: tenTinh, QuocGia: quocGia } });
  return created.MaDiaPhuong;
}

async function ensureTienNghi(tenTienNghi: string, bieuTuong: string): Promise<number> {
  const existing = await prisma.tIEN_NGHI.findUnique({ where: { TenTienNghi: tenTienNghi } });
  if (existing) return existing.MaTienNghi;
  const created = await prisma.tIEN_NGHI.create({ data: { TenTienNghi: tenTienNghi, BieuTuong: bieuTuong } });
  return created.MaTienNghi;
}

async function ensureChinhSachHuy(tenChinhSach: string): Promise<number> {
  const existing = await prisma.cHINH_SACH_HUY.findFirst({ where: { TenChinhSach: tenChinhSach } });
  if (existing) return existing.MaChinhSachHuy;
  const created = await prisma.cHINH_SACH_HUY.create({
    data: {
      TenChinhSach: tenChinhSach,
      MoTa: 'Chính sách hủy tiêu chuẩn cho dữ liệu demo M2',
      TrangThai: 'Hoạt động',
      NgayTao: new Date(),
    },
  });
  await prisma.cHI_TIET_CHINH_SACH_HUY.createMany({
    data: [
      { MaChinhSachHuy: created.MaChinhSachHuy, SoGioTruocNhanPhong: 48, TyLeHoanTien: 100 },
      { MaChinhSachHuy: created.MaChinhSachHuy, SoGioTruocNhanPhong: 24, TyLeHoanTien: 50 },
      { MaChinhSachHuy: created.MaChinhSachHuy, SoGioTruocNhanPhong: 0, TyLeHoanTien: 0 },
    ],
  });
  return created.MaChinhSachHuy;
}

interface RoomTypeSeed {
  tenLoaiPhong: string;
  soGiuong: number;
  sucChua: number;
  dienTich: number;
  loaiGiuong: string;
  moTa: string;
  giaCoBan: number;
  soLuongPhong: number;
  images: string[];
  amenities: string[];
}

interface HotelSeed {
  tenKhachSan: string;
  city: string;
  diaChiChiTiet: string;
  hangSao: number;
  moTa: string;
  images: string[];
  amenities: string[];
  roomTypes: RoomTypeSeed[];
}

async function ensureHotel(seed: HotelSeed, ownerId: number, adminId: number, diaPhuongId: number): Promise<number> {
  const existing = await prisma.kHACH_SAN.findFirst({ where: { TenKhachSan: seed.tenKhachSan } });
  let hotelId: number;

  if (existing) {
    hotelId = existing.MaKhachSan;
  } else {
    const now = new Date();
    const created = await prisma.kHACH_SAN.create({
      data: {
        TenKhachSan: seed.tenKhachSan,
        DiaChiChiTiet: seed.diaChiChiTiet,
        HangSao: seed.hangSao,
        MoTa: seed.moTa,
        GioNhanPhong: new Date('1970-01-01T14:00:00Z'),
        GioTraPhong: new Date('1970-01-01T12:00:00Z'),
        TrangThai: HOTEL_STATUS.ACTIVE,
        NgayDangKy: now,
        NgayDuyet: now,
        NgayCapNhat: now,
        TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: { connect: { MaTaiKhoan: ownerId } },
        TAI_KHOAN_KHACH_SAN_MaTaiKhoanDuyetToTAI_KHOAN: { connect: { MaTaiKhoan: adminId } },
        DIA_PHUONG: { connect: { MaDiaPhuong: diaPhuongId } },
      },
    });
    hotelId = created.MaKhachSan;

    await prisma.hINH_ANH_KHACH_SAN.createMany({
      data: seed.images.map((url, i) => ({ MaKhachSan: hotelId, URL: url, AnhDaiDien: i === 0 })),
    });
  }

  // Gắn các tiện nghi còn thiếu
  for (const amenityName of seed.amenities) {
    const amenity = await prisma.tIEN_NGHI.findUnique({ where: { TenTienNghi: amenityName } });
    if (!amenity) continue;
    const link = await prisma.kHACH_SAN_TIEN_NGHI.findUnique({
      where: { MaKhachSan_MaTienNghi: { MaKhachSan: hotelId, MaTienNghi: amenity.MaTienNghi } },
    });
    if (!link) {
      await prisma.kHACH_SAN_TIEN_NGHI.create({ data: { MaKhachSan: hotelId, MaTienNghi: amenity.MaTienNghi } });
    }
  }

  for (const rt of seed.roomTypes) {
    await ensureRoomType(hotelId, rt);
  }

  return hotelId;
}

async function ensureRoomType(hotelId: number, seed: RoomTypeSeed): Promise<number> {
  const existing = await prisma.lOAI_PHONG.findFirst({
    where: { MaKhachSan: hotelId, TenLoaiPhong: seed.tenLoaiPhong },
  });
  let roomTypeId: number;

  if (existing) {
    roomTypeId = existing.MaLoaiPhong;
  } else {
    const created = await prisma.lOAI_PHONG.create({
      data: {
        MaKhachSan: hotelId,
        TenLoaiPhong: seed.tenLoaiPhong,
        SoGiuong: seed.soGiuong,
        SucChua: seed.sucChua,
        DienTich: seed.dienTich,
        LoaiGiuong: seed.loaiGiuong,
        MoTa: seed.moTa,
        TrangThai: ROOM_TYPE_STATUS.ACTIVE,
      },
    });
    roomTypeId = created.MaLoaiPhong;

    await prisma.hINH_ANH_LOAI_PHONG.createMany({
      data: seed.images.map((url, i) => ({ MaLoaiPhong: roomTypeId, URL: url, LaAnhDaiDien: i === 0 })),
    });
  }

  for (const amenityName of seed.amenities) {
    const amenity = await prisma.tIEN_NGHI.findUnique({ where: { TenTienNghi: amenityName } });
    if (!amenity) continue;
    const link = await prisma.lOAI_PHONG_TIEN_NGHI.findUnique({
      where: { MaLoaiPhong_MaTienNghi: { MaLoaiPhong: roomTypeId, MaTienNghi: amenity.MaTienNghi } },
    });
    if (!link) {
      await prisma.lOAI_PHONG_TIEN_NGHI.create({ data: { MaLoaiPhong: roomTypeId, MaTienNghi: amenity.MaTienNghi } });
    }
  }

  // Tạo giá và tồn kho cho 45 ngày tới
  for (let i = 0; i < 45; i++) {
    const date = addDays(today, i);
    const gia = Math.round(seed.giaCoBan * (isWeekendNight(date) ? 1.15 : 1));
    await prisma.qUY_PHONG_GIA.upsert({
      where: { MaLoaiPhong_NgayApDung: { MaLoaiPhong: roomTypeId, NgayApDung: date } },
      update: { GiaPhong: gia, SoLuongPhong: seed.soLuongPhong, TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE },
      create: {
        MaLoaiPhong: roomTypeId,
        NgayApDung: date,
        GiaPhong: gia,
        SoLuongPhong: seed.soLuongPhong,
        TrangThai: ROOM_RATE_STATUS.OPEN_FOR_SALE,
      },
    });
  }

  return roomTypeId;
}

async function ensureBooking(params: {
  maXacNhan: string;
  customerId: number;
  hotelId: number;
  roomTypeId: number;
  policyId: number;
  checkIn: Date;
  checkOut: Date;
  soLuongPhong: number;
  trangThai: string;
  giaMotDem: number;
}): Promise<void> {
  const nights = Math.round((params.checkOut.getTime() - params.checkIn.getTime()) / 86_400_000);
  const tongTienPhong = params.giaMotDem * nights * params.soLuongPhong;

  const existing = await prisma.dAT_PHONG.findUnique({ where: { MaXacNhanDatPhong: params.maXacNhan } });
  if (existing) {
    // Dời ngày đặt phòng về hôm nay mỗi lần chạy lại
    await prisma.dAT_PHONG.update({
      where: { MaDatPhong: existing.MaDatPhong },
      data: {
        NgayNhanPhong: params.checkIn,
        NgayTraPhong: params.checkOut,
        TongTienPhong: tongTienPhong,
        SoTienGiam: 0,
        TongTienThanhToan: tongTienPhong,
        TrangThai: params.trangThai,
        NgayCapNhat: new Date(),
      },
    });
    await prisma.cHI_TIET_DAT_PHONG.updateMany({
      where: { MaDatPhong: existing.MaDatPhong, MaLoaiPhong: params.roomTypeId },
      data: { SoLuongPhong: params.soLuongPhong },
    });
    return;
  }

  const booking = await prisma.dAT_PHONG.create({
    data: {
      MaXacNhanDatPhong: params.maXacNhan,
      TAI_KHOAN: { connect: { MaTaiKhoan: params.customerId } },
      KHACH_SAN: { connect: { MaKhachSan: params.hotelId } },
      CHINH_SACH_HUY: { connect: { MaChinhSachHuy: params.policyId } },
      NgayNhanPhong: params.checkIn,
      NgayTraPhong: params.checkOut,
      TongTienPhong: tongTienPhong,
      SoTienGiam: 0,
      TongTienThanhToan: tongTienPhong,
      TrangThai: params.trangThai,
      NgayTao: new Date(),
      NgayCapNhat: new Date(),
    },
  });

  await prisma.cHI_TIET_DAT_PHONG.create({
    data: {
      MaDatPhong: booking.MaDatPhong,
      MaLoaiPhong: params.roomTypeId,
      SoLuongPhong: params.soLuongPhong,
    },
  });
}

/** Seed đặt phòng dùng chung cho test tồn kho và CLI */
export async function seedDiscovery(): Promise<void> {
  console.log('[seed-discovery] Ensuring accounts...');
  const ownerId = await ensureAccount({
    tenDangNhap: 'seed_owner',
    email: 'seed_owner@example.com',
    hoTen: 'Demo Hotel Owner',
    role: ROLE_NAMES.PARTNER,
    soDienThoai: '0900000001',
  });
  const adminId = await ensureAccount({
    tenDangNhap: 'seed_admin',
    email: 'seed_admin@example.com',
    hoTen: 'Demo Platform Admin',
    role: ROLE_NAMES.ADMIN,
    soDienThoai: '0900000002',
  });
  const customerId = await ensureAccount({
    tenDangNhap: 'seed_customer',
    email: 'seed_customer@example.com',
    hoTen: 'Demo Customer',
    role: ROLE_NAMES.CUSTOMER,
    soDienThoai: '0900000003',
  });

  console.log('[seed-discovery] Ensuring địa phương...');
  const hcmId = await ensureDiaPhuong('Hồ Chí Minh', 'Hồ Chí Minh');
  const hanoiId = await ensureDiaPhuong('Hà Nội', 'Hà Nội');
  const danangId = await ensureDiaPhuong('Đà Nẵng', 'Đà Nẵng');

  console.log('[seed-discovery] Ensuring tiện nghi...');
  const amenities = [
    ['Wi-Fi miễn phí', 'wifi'],
    ['Hồ bơi', 'pool'],
    ['Bãi đỗ xe', 'parking'],
    ['Nhà hàng', 'restaurant'],
    ['Phòng gym', 'gym'],
    ['Điều hòa nhiệt độ', 'ac'],
    ['Đưa đón sân bay', 'shuttle'],
    ['Spa & Massage', 'spa'],
  ] as const;
  for (const [name, icon] of amenities) await ensureTienNghi(name, icon);

  console.log('[seed-discovery] Ensuring chính sách hủy...');
  const policyId = await ensureChinhSachHuy('Hủy linh hoạt (demo)');

  console.log('[seed-discovery] Ensuring khách sạn + loại phòng + quỹ phòng giá...');
  const img = (seedName: string, n: number) => `https://picsum.photos/seed/${seedName}-${n}/800/600`;

  const hotels: HotelSeed[] = [
    {
      tenKhachSan: 'Grand Saigon Hotel',
      city: 'hcm',
      diaChiChiTiet: '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh',
      hangSao: 5,
      moTa: 'Khách sạn 5 sao ngay trung tâm Quận 1, gần phố đi bộ Nguyễn Huệ.',
      images: [img('grand-saigon', 1), img('grand-saigon', 2), img('grand-saigon', 3)],
      amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Nhà hàng', 'Phòng gym', 'Spa & Massage', 'Đưa đón sân bay'],
      roomTypes: [
        {
          tenLoaiPhong: 'Standard',
          soGiuong: 1,
          sucChua: 2,
          dienTich: 24,
          loaiGiuong: 'Giường đôi',
          moTa: 'Phòng tiêu chuẩn view thành phố.',
          giaCoBan: 900000,
          soLuongPhong: 6,
          images: [img('grand-saigon-standard', 1)],
          amenities: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ'],
        },
        {
          tenLoaiPhong: 'Deluxe',
          soGiuong: 1,
          sucChua: 3,
          dienTich: 32,
          loaiGiuong: 'Giường King',
          moTa: 'Phòng cao cấp view sông Sài Gòn.',
          giaCoBan: 1500000,
          soLuongPhong: 4,
          images: [img('grand-saigon-deluxe', 1)],
          amenities: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'Hồ bơi'],
        },
        {
          tenLoaiPhong: 'Suite',
          soGiuong: 2,
          sucChua: 4,
          dienTich: 48,
          loaiGiuong: 'Giường King + Sofa bed',
          moTa: 'Suite hạng sang với phòng khách riêng biệt.',
          giaCoBan: 2800000,
          soLuongPhong: 2,
          images: [img('grand-saigon-suite', 1)],
          amenities: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'Spa & Massage'],
        },
      ],
    },
    {
      tenKhachSan: 'Saigon Riverside Inn',
      city: 'hcm',
      diaChiChiTiet: '45 Đường Tôn Đức Thắng, Quận 1, TP. Hồ Chí Minh',
      hangSao: 3,
      moTa: 'Khách sạn 3 sao giá tốt, view sông, gần bến Bạch Đằng.',
      images: [img('riverside-inn', 1), img('riverside-inn', 2)],
      amenities: ['Wi-Fi miễn phí', 'Bãi đỗ xe', 'Nhà hàng'],
      roomTypes: [
        {
          tenLoaiPhong: 'Standard',
          soGiuong: 1,
          sucChua: 2,
          dienTich: 20,
          loaiGiuong: 'Giường đôi',
          moTa: 'Phòng tiêu chuẩn gọn gàng, tiện nghi cơ bản.',
          giaCoBan: 500000,
          soLuongPhong: 8,
          images: [img('riverside-standard', 1)],
          amenities: ['Wi-Fi miễn phí'],
        },
        {
          tenLoaiPhong: 'Deluxe',
          soGiuong: 1,
          sucChua: 3,
          dienTich: 26,
          loaiGiuong: 'Giường Queen',
          moTa: 'Phòng rộng rãi hơn, view sông.',
          giaCoBan: 750000,
          soLuongPhong: 3,
          images: [img('riverside-deluxe', 1)],
          amenities: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ'],
        },
      ],
    },
    {
      tenKhachSan: 'Hanoi Boutique Residence',
      city: 'hanoi',
      diaChiChiTiet: '12 Phố Hàng Bạc, Hoàn Kiếm, Hà Nội',
      hangSao: 4,
      moTa: 'Khách sạn boutique phong cách Đông Dương giữa lòng phố cổ Hà Nội.',
      images: [img('hanoi-boutique', 1), img('hanoi-boutique', 2)],
      amenities: ['Wi-Fi miễn phí', 'Nhà hàng', 'Điều hòa nhiệt độ', 'Đưa đón sân bay'],
      roomTypes: [
        {
          tenLoaiPhong: 'Standard',
          soGiuong: 1,
          sucChua: 2,
          dienTich: 22,
          loaiGiuong: 'Giường đôi',
          moTa: 'Phòng phong cách cổ điển, gần Hồ Gươm.',
          giaCoBan: 700000,
          soLuongPhong: 5,
          images: [img('hanoi-standard', 1)],
          amenities: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ'],
        },
        {
          tenLoaiPhong: 'Deluxe',
          soGiuong: 1,
          sucChua: 3,
          dienTich: 30,
          loaiGiuong: 'Giường King',
          moTa: 'Phòng cao cấp view phố cổ.',
          giaCoBan: 1100000,
          soLuongPhong: 3,
          images: [img('hanoi-deluxe', 1)],
          amenities: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'Nhà hàng'],
        },
      ],
    },
    {
      tenKhachSan: 'Da Nang Beach Resort',
      city: 'danang',
      diaChiChiTiet: '99 Đường Võ Nguyên Giáp, Ngũ Hành Sơn, Đà Nẵng',
      hangSao: 5,
      moTa: 'Resort 5 sao mặt biển Mỹ Khê, đầy đủ tiện ích nghỉ dưỡng.',
      images: [img('danang-resort', 1), img('danang-resort', 2), img('danang-resort', 3)],
      amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Nhà hàng', 'Spa & Massage', 'Phòng gym', 'Bãi đỗ xe'],
      roomTypes: [
        {
          tenLoaiPhong: 'Deluxe',
          soGiuong: 1,
          sucChua: 3,
          dienTich: 35,
          loaiGiuong: 'Giường King',
          moTa: 'Phòng view biển, ban công riêng.',
          giaCoBan: 1800000,
          soLuongPhong: 5,
          images: [img('danang-deluxe', 1)],
          amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Điều hòa nhiệt độ'],
        },
        {
          tenLoaiPhong: 'Suite',
          soGiuong: 2,
          sucChua: 4,
          dienTich: 55,
          loaiGiuong: 'Giường King + Sofa bed',
          moTa: 'Suite view biển trọn vẹn, bồn tắm riêng.',
          giaCoBan: 3200000,
          soLuongPhong: 2,
          images: [img('danang-suite', 1)],
          amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Spa & Massage'],
        },
      ],
    },
  ];

  const cityMap: Record<string, number> = { hcm: hcmId, hanoi: hanoiId, danang: danangId };
  const hotelIds: Record<string, number> = {};
  for (const hotel of hotels) {
    hotelIds[hotel.tenKhachSan] = await ensureHotel(hotel, ownerId, adminId, cityMap[hotel.city]);
  }

  console.log('[seed-discovery] Ensuring sample bookings (for availability scenarios)...');
  const grandSaigonId = hotelIds['Grand Saigon Hotel'];
  const grandSaigonStandard = await prisma.lOAI_PHONG.findFirstOrThrow({
    where: { MaKhachSan: grandSaigonId, TenLoaiPhong: 'Standard' },
  });
  const danangResortId = hotelIds['Da Nang Beach Resort'];
  const danangSuite = await prisma.lOAI_PHONG.findFirstOrThrow({
    where: { MaKhachSan: danangResortId, TenLoaiPhong: 'Suite' },
  });
  const danangDeluxe = await prisma.lOAI_PHONG.findFirstOrThrow({
    where: { MaKhachSan: danangResortId, TenLoaiPhong: 'Deluxe' },
  });

  // Đặt một phần: 4/6 phòng Standard bị giữ
  await ensureBooking({
    maXacNhan: 'SEED-BOOK-001',
    customerId,
    hotelId: grandSaigonId,
    roomTypeId: grandSaigonStandard.MaLoaiPhong,
    policyId,
    checkIn: addDays(today, 5),
    checkOut: addDays(today, 7),
    soLuongPhong: 4,
    trangThai: BOOKING_STATUS.CONFIRMED,
    giaMotDem: 900000,
  });

  // Hết phòng: toàn bộ phòng Suite bị giữ
  await ensureBooking({
    maXacNhan: 'SEED-BOOK-002',
    customerId,
    hotelId: danangResortId,
    roomTypeId: danangSuite.MaLoaiPhong,
    policyId,
    checkIn: addDays(today, 10),
    checkOut: addDays(today, 12),
    soLuongPhong: 2,
    trangThai: BOOKING_STATUS.CONFIRMED,
    giaMotDem: 3200000,
  });

  // Đơn đã hủy không làm giảm số phòng trống
  await ensureBooking({
    maXacNhan: 'SEED-BOOK-003',
    customerId,
    hotelId: danangResortId,
    roomTypeId: danangDeluxe.MaLoaiPhong,
    policyId,
    checkIn: addDays(today, 10),
    checkOut: addDays(today, 12),
    soLuongPhong: 5,
    trangThai: BOOKING_STATUS.CANCELLED,
    giaMotDem: 1800000,
  });

  console.log('[seed-discovery] Done.');
  console.log(`[seed-discovery] Hotels: ${Object.keys(hotelIds).join(', ')}`);
  console.log(`[seed-discovery] Date window seeded: ${today.toISOString().slice(0, 10)} .. ${addDays(today, 44).toISOString().slice(0, 10)}`);
}

const isDirectExecution = process.argv[1]?.replaceAll('\\', '/').endsWith('/prisma/seed-discovery.ts');

if (isDirectExecution) {
  seedDiscovery()
    .catch((err) => {
      console.error('[seed-discovery] FAILED:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
