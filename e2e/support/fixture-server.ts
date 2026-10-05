/**
 * E2E fixture server. Runs INSIDE the backend package (cwd = backend, so its .env / Prisma client / test factories
 * resolve exactly as they do for the Vitest suite) against the SQL Server test database, and gives the Playwright specs:
 *   - controlled test data (accounts, hotels, room types + stock, promotions, a completed stay) and read-back of the rows
 *     a spec wants to verify ("SQL verification"),
 *   - a cleanup that removes everything this run created, including rows made through the UI by `e2e_` accounts.
 * It is NOT part of the application: the application under test is the real built frontend + the real backend process.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getPrismaClient } from '../../backend/src/config/prisma';
import {
  createTestAccount,
  createTestCancellationPolicy,
  createTestBookingDirect,
  createTestDiaPhuong,
  createTestHotel,
  createTestPayment,
  createTestPromotion,
  createTestRoomType,
  deleteTestAccount,
  deleteTestDiaPhuong,
  deleteTestHotel,
  deleteTestPromotion,
  deleteTestCancellationPolicy,
} from '../../backend/src/test/factories';
import { addDaysToDateKey, businessToday } from '../../backend/src/common/utils/stay-dates';
import { ROLE_NAMES } from '../../backend/src/common/constants/roles';

const PORT = Number(process.env.E2E_FIXTURE_PORT ?? 5191);
const prisma = () => getPrismaClient();

const created = {
  accounts: new Set<number>(),
  hotels: new Set<number>(),
  cities: new Set<number>(),
  promotions: new Set<number>(),
  policies: new Set<number>(),
};

// The ids of admins a spec locked are kept on disk, so even a hard-killed run is repaired by the next start.
const LOCK_FILE = path.resolve(__dirname, '../.locked-admins.json');
const lockedAdmins = new Set<number>(fs.existsSync(LOCK_FILE) ? (JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as number[]) : []);
const persistLocked = () => (lockedAdmins.size > 0 ? fs.writeFileSync(LOCK_FILE, JSON.stringify([...lockedAdmins])) : fs.rmSync(LOCK_FILE, { force: true }));
async function restoreAdmins(): Promise<void> {
  if (lockedAdmins.size > 0) await prisma().tAI_KHOAN.updateMany({ where: { MaTaiKhoan: { in: [...lockedAdmins] } }, data: { TrangThai: 'Hoạt động' } });
  lockedAdmins.clear();
  persistLocked();
}
void restoreAdmins(); // start-up repair of a previous crashed run
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(signal, () => void restoreAdmins().finally(() => process.exit(0)));

const dateAt = (key: string) => new Date(`${key}T00:00:00Z`);

type Handler = (body: Record<string, any>) => Promise<unknown>;

const routes: Record<string, Handler> = {
  '/today': async () => ({ today: businessToday() }),

  '/account': async (b) => {
    const role = (b.role as string | undefined) ?? ROLE_NAMES.CUSTOMER;
    const made = await createTestAccount({ role: role as never, password: b.password, status: b.status });
    created.accounts.add(made.account.MaTaiKhoan);
    return { id: made.account.MaTaiKhoan, email: made.account.Email, username: made.account.TenDangNhap, password: made.plainPassword, name: made.account.HoTen };
  },

  '/city': async () => {
    const city = await createTestDiaPhuong();
    created.cities.add(city.MaDiaPhuong);
    return { id: city.MaDiaPhuong, name: city.TenThanhPho };
  },

  '/hotel': async (b) => {
    let cityId = b.cityId as number | undefined;
    let cityName = b.cityName as string | undefined;
    if (!cityId) {
      const city = await createTestDiaPhuong();
      created.cities.add(city.MaDiaPhuong);
      cityId = city.MaDiaPhuong;
      cityName = city.TenThanhPho;
    } else if (!cityName) {
      cityName = (await prisma().dIA_PHUONG.findUniqueOrThrow({ where: { MaDiaPhuong: cityId } })).TenThanhPho;
    }
    const hotel = await createTestHotel(b.ownerId, cityId, { status: b.status });
    created.hotels.add(hotel.MaKhachSan);
    await prisma().kHACH_SAN.update({
      where: { MaKhachSan: hotel.MaKhachSan },
      data: { HangSao: b.stars ?? 3, ...(b.name ? { TenKhachSan: b.name } : {}) },
    });
    return { id: hotel.MaKhachSan, cityId, cityName, name: b.name ?? hotel.TenKhachSan };
  },

  /** A room type with stock/price rows for `days` nights starting `fromOffset` days from the Vietnam "today". */
  '/room-type': async (b) => {
    const roomType = await createTestRoomType(b.hotelId);
    await prisma().lOAI_PHONG.update({
      where: { MaLoaiPhong: roomType.MaLoaiPhong },
      data: { ...(b.name ? { TenLoaiPhong: b.name } : {}), SucChua: b.capacity ?? 2 },
    });
    const start = addDaysToDateKey(businessToday(), b.fromOffset ?? 1);
    const rows = Array.from({ length: b.days ?? 10 }, (_, i) => ({
      MaLoaiPhong: roomType.MaLoaiPhong,
      NgayApDung: dateAt(addDaysToDateKey(start, i)),
      GiaPhong: b.price ?? 500000,
      SoLuongPhong: b.rooms ?? 3,
      TrangThai: 'Mở bán',
    }));
    await prisma().qUY_PHONG_GIA.createMany({ data: rows });
    return { id: roomType.MaLoaiPhong, name: b.name ?? roomType.TenLoaiPhong };
  },

  '/promotion': async (b) => {
    const promo = await createTestPromotion({
      loaiGiamGia: b.type,
      giaTriGiam: b.value,
      giaTriDonToiThieu: b.minOrder,
      mucGiamToiDa: b.maxDiscount,
      soLuongGioiHan: b.limit,
      ngayBatDau: b.startKey ? dateAt(b.startKey) : undefined,
      ngayKetThuc: b.endKey ? dateAt(b.endKey) : undefined,
    });
    created.promotions.add(promo.MaKhuyenMai);
    return { id: promo.MaKhuyenMai, code: promo.MaCode };
  },

  /** A finished stay (check-out in the past, status "Hoàn tất") so the customer can review it. */
  '/completed-booking': async (b) => {
    const policy = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }]);
    created.policies.add(policy.MaChinhSachHuy);
    const today = businessToday();
    const booking = await createTestBookingDirect(b.customerId, b.hotelId, policy.MaChinhSachHuy, dateAt(addDaysToDateKey(today, -5)), dateAt(addDaysToDateKey(today, -3)), {
      trangThai: 'Hoàn tất',
    });
    return { id: booking.MaDatPhong };
  },

  /** A confirmed, paid booking created directly (check-in far ahead), for revenue/analytics checks. */
  '/paid-booking': async (b) => {
    const policy = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }]);
    created.policies.add(policy.MaChinhSachHuy);
    const today = businessToday();
    const booking = await createTestBookingDirect(b.customerId, b.hotelId, policy.MaChinhSachHuy, dateAt(addDaysToDateKey(today, 30)), dateAt(addDaysToDateKey(today, 31)), {
      trangThai: 'Đã xác nhận',
      tongTienPhong: b.amount,
    });
    await createTestPayment(booking.MaDatPhong, b.amount, 'Thành công', `E2E${booking.MaDatPhong}:14000001:20300101000000`); // txnRef:transactionNo:payDate, like a real VNPAY payment
    return { id: booking.MaDatPhong };
  },

  /** A confirmed, paid booking with a real room line for `checkIn` (1 night), used to look at booking pages. */
  '/paid-booking-for': async (b) => {
    const policy = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 100 }]);
    created.policies.add(policy.MaChinhSachHuy);
    const booking = await createTestBookingDirect(b.customerId, b.hotelId, policy.MaChinhSachHuy, dateAt(b.checkIn), dateAt(addDaysToDateKey(b.checkIn, 1)), {
      trangThai: 'Đã xác nhận',
      tongTienPhong: 300000,
    });
    await prisma().cHI_TIET_DAT_PHONG.create({ data: { MaDatPhong: booking.MaDatPhong, MaLoaiPhong: b.roomTypeId, SoLuongPhong: 1 } });
    await createTestPayment(booking.MaDatPhong, 300000, 'Thành công', `E2E${booking.MaDatPhong}:14000001:20300101000000`);
    return { id: booking.MaDatPhong };
  },

  /** Locks every active admin except `keep` so a spec can run with a known, tiny admin set; restored by /admin/restore. */
  '/admin/isolate': async (b) => {
    const others = await prisma().tAI_KHOAN.findMany({
      where: { TrangThai: 'Hoạt động', VAI_TRO: { TenVaiTro: ROLE_NAMES.ADMIN }, MaTaiKhoan: { notIn: b.keep } },
      select: { MaTaiKhoan: true },
    });
    for (const a of others) lockedAdmins.add(a.MaTaiKhoan);
    persistLocked();
    await prisma().tAI_KHOAN.updateMany({ where: { MaTaiKhoan: { in: others.map((a) => a.MaTaiKhoan) } }, data: { TrangThai: 'Khóa' } });
    return { locked: others.length };
  },
  '/admin/restore': async () => {
    await restoreAdmins();
    return { ok: true };
  },

  /** Moves a pending booking's creation time into the past, as if `minutes` had gone by (lazy expiry then applies). */
  '/backdate-booking': async (b) => {
    await prisma().dAT_PHONG.update({ where: { MaDatPhong: b.id }, data: { NgayTao: new Date(Date.now() - b.minutes * 60_000) } });
    return { ok: true };
  },

  '/db/booking': async (b) => {
    const booking = await prisma().dAT_PHONG.findUniqueOrThrow({
      where: { MaDatPhong: b.id },
      include: { THANH_TOAN: { include: { HOAN_TIEN: true } }, CHI_TIET_DAT_PHONG: true, CHINH_SACH_HUY: { include: { CHI_TIET_CHINH_SACH_HUY: true } } },
    });
    return JSON.parse(JSON.stringify(booking));
  },

  '/db/latest-booking': async (b) => {
    const booking = await prisma().dAT_PHONG.findFirst({
      where: { MaTaiKhoanKhachHang: b.customerId },
      orderBy: { MaDatPhong: 'desc' },
      include: { THANH_TOAN: { include: { HOAN_TIEN: true } }, CHI_TIET_DAT_PHONG: true, CHINH_SACH_HUY: { include: { CHI_TIET_CHINH_SACH_HUY: true } } },
    });
    return JSON.parse(JSON.stringify(booking));
  },

  '/db/hotel': async (b) => {
    const hotel = b.id
      ? await prisma().kHACH_SAN.findUnique({ where: { MaKhachSan: b.id } })
      : await prisma().kHACH_SAN.findFirst({ where: { TenKhachSan: b.name }, orderBy: { MaKhachSan: 'desc' } });
    if (hotel) created.hotels.add(hotel.MaKhachSan);
    return hotel ? { ...JSON.parse(JSON.stringify(hotel)), GioNhanPhong: hotel.GioNhanPhong.toISOString().slice(11, 16), GioTraPhong: hotel.GioTraPhong.toISOString().slice(11, 16) } : null;
  },

  '/db/stock': async (b) => {
    const rows = await prisma().qUY_PHONG_GIA.findMany({ where: { MaLoaiPhong: b.roomTypeId }, orderBy: { NgayApDung: 'asc' } });
    return rows.map((r) => ({ date: r.NgayApDung.toISOString().slice(0, 10), rooms: r.SoLuongPhong, price: Number(r.GiaPhong), status: r.TrangThai }));
  },

  '/db/account': async (b) => {
    const account = await prisma().tAI_KHOAN.findFirst({ where: b.email ? { Email: b.email } : { MaTaiKhoan: b.id }, include: { VAI_TRO: true } });
    if (account) created.accounts.add(account.MaTaiKhoan);
    return account && { id: account.MaTaiKhoan, status: account.TrangThai, role: account.VAI_TRO.TenVaiTro, email: account.Email };
  },

  '/set-account-status': async (b) => {
    await prisma().tAI_KHOAN.update({ where: { MaTaiKhoan: b.id }, data: { TrangThai: b.status } });
    return { ok: true };
  },

  '/db/partner-application': async (b) => {
    const account = await prisma().tAI_KHOAN.findFirst({ where: { Email: b.email } });
    if (!account) return null;
    created.accounts.add(account.MaTaiKhoan);
    const application = await prisma().hO_SO_DOI_TAC.findFirst({ where: { MaTaiKhoan: account.MaTaiKhoan }, orderBy: { MaHoSoDoiTac: 'desc' } });
    return application && { id: application.MaHoSoDoiTac, status: application.TrangThaiDuyet, reason: application.LyDoTuChoi };
  },

  '/db/room-type': async (b) => {
    const rt = await prisma().lOAI_PHONG.findFirst({ where: { MaKhachSan: b.hotelId, TenLoaiPhong: b.name } });
    return rt && { id: rt.MaLoaiPhong, status: rt.TrangThai };
  },

  '/db/reviews': async (b) => JSON.parse(JSON.stringify(await prisma().dANH_GIA.findMany({ where: { MaKhachSan: b.hotelId }, orderBy: { MaDanhGia: 'asc' } }))),

  '/db/active-admins': async () => ({ count: await prisma().tAI_KHOAN.count({ where: { TrangThai: 'Hoạt động', VAI_TRO: { TenVaiTro: ROLE_NAMES.ADMIN } } }) }),

  '/cleanup': async () => {
    await cleanup();
    return { ok: true };
  },
};

async function cleanup(): Promise<void> {
  await restoreAdmins(); // never leave the shared test DB without its admins
  const db = prisma();
  // Accounts made through the UI (register form) use the e2e_ e-mail prefix.
  for (const account of await db.tAI_KHOAN.findMany({ where: { Email: { startsWith: 'e2e_' } }, select: { MaTaiKhoan: true } })) created.accounts.add(account.MaTaiKhoan);
  const accountIds = [...created.accounts];
  // Hotels owned by those accounts (created through the UI by an owner), and their cities are the factory's.
  for (const hotel of await db.kHACH_SAN.findMany({ where: { MaTaiKhoanSoHuu: { in: accountIds } }, select: { MaKhachSan: true } })) created.hotels.add(hotel.MaKhachSan);

  const hotelIds = [...created.hotels];
  const bookingIds = (
    await db.dAT_PHONG.findMany({ where: { OR: [{ MaKhachSan: { in: hotelIds } }, { MaTaiKhoanKhachHang: { in: accountIds } }] }, select: { MaDatPhong: true } })
  ).map((b) => b.MaDatPhong);
  await db.hOAN_TIEN.deleteMany({ where: { THANH_TOAN: { MaDatPhong: { in: bookingIds } } } });
  await db.tHANH_TOAN.deleteMany({ where: { MaDatPhong: { in: bookingIds } } });
  await db.cHI_TIET_DAT_PHONG.deleteMany({ where: { MaDatPhong: { in: bookingIds } } });
  await db.hINH_ANH_DANH_GIA.deleteMany({ where: { DANH_GIA: { OR: [{ MaKhachSan: { in: hotelIds } }, { MaKhachHang: { in: accountIds } }] } } });
  await db.dANH_GIA.deleteMany({ where: { OR: [{ MaKhachSan: { in: hotelIds } }, { MaKhachHang: { in: accountIds } }] } });
  await db.dAT_PHONG.deleteMany({ where: { MaDatPhong: { in: bookingIds } } });
  for (const id of hotelIds) await deleteTestHotel(id);
  for (const id of created.promotions) await deleteTestPromotion(id);
  for (const id of created.policies) await deleteTestCancellationPolicy(id);
  // Applications a tracked admin reviewed must go before that admin (FK), whoever applied.
  await db.hO_SO_DOI_TAC.deleteMany({ where: { OR: [{ MaTaiKhoan: { in: accountIds } }, { MaTaiKhoanDuyet: { in: accountIds } }] } });
  for (const id of accountIds) await deleteTestAccount(id);
  // deleteTestAccount swallows FK errors: verify, so a leftover can never go unnoticed
  const left = await db.tAI_KHOAN.count({ where: { MaTaiKhoan: { in: accountIds } } });
  if (left > 0) throw new Error(`cleanup left ${left} test account(s) behind`);
  for (const id of created.cities) await deleteTestDiaPhuong(id);
  for (const set of Object.values(created)) set.clear();
}

const readBody = (req: http.IncomingMessage): Promise<Record<string, any>> =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });

const server = http.createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') return send(200, { ok: true });


    const handler = routes[url.pathname];
    if (!handler) return send(404, { error: `no fixture route ${url.pathname}` });
    send(200, { data: await handler(await readBody(req)) });
  } catch (error) {
    console.error('[fixture-server]', error);
    send(500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, () => console.log(`E2E fixture server on ${PORT}`));
