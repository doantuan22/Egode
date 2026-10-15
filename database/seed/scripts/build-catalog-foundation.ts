import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { hashPassword } from '../../../backend/src/common/utils/password';

const CATALOG_DIR = path.resolve(__dirname, '../catalog');
mkdirSync(CATALOG_DIR, { recursive: true });

// 1. LOCATIONS
const LOCATIONS = [
  { city: 'Hồ Chí Minh', province: 'Hồ Chí Minh', country: 'Việt Nam' },
  { city: 'Hà Nội', province: 'Hà Nội', country: 'Việt Nam' },
  { city: 'Đà Nẵng', province: 'Đà Nẵng', country: 'Việt Nam' },
  { city: 'Nha Trang', province: 'Khánh Hòa', country: 'Việt Nam' },
  { city: 'Đà Lạt', province: 'Lâm Đồng', country: 'Việt Nam' },
  { city: 'Hội An', province: 'Quảng Nam', country: 'Việt Nam' },
  { city: 'Phú Quốc', province: 'Kiên Giang', country: 'Việt Nam' },
  { city: 'Hạ Long', province: 'Quảng Ninh', country: 'Việt Nam' },
  { city: 'Sa Pa', province: 'Lào Cai', country: 'Việt Nam' },
  { city: 'Huế', province: 'Thừa Thiên Huế', country: 'Việt Nam' },
  { city: 'Vũng Tàu', province: 'Bà Rịa - Vũng Tàu', country: 'Việt Nam' },
];

// 2. MASTER AMENITIES
const AMENITIES = [
  { name: 'Wi-Fi miễn phí', icon: 'wifi' },
  { name: 'Hồ bơi', icon: 'pool' },
  { name: 'Bãi đỗ xe', icon: 'parking' },
  { name: 'Nhà hàng', icon: 'restaurant' },
  { name: 'Phòng gym', icon: 'gym' },
  { name: 'Điều hòa nhiệt độ', icon: 'ac' },
  { name: 'Đưa đón sân bay', icon: 'shuttle' },
  { name: 'Spa & Massage', icon: 'spa' },
  { name: 'Bãi biển riêng', icon: 'beach' },
  { name: 'Quầy bar', icon: 'bar' },
  { name: 'Lễ tân 24/7', icon: 'reception' },
  { name: 'Bữa sáng miễn phí', icon: 'breakfast' },
  { name: 'Ban công', icon: 'balcony' },
  { name: 'Bồn tắm', icon: 'bathtub' },
  { name: 'TV màn hình phẳng', icon: 'tv' },
  { name: 'Minibar', icon: 'minibar' },
  { name: 'Két sắt an toàn', icon: 'safe' },
  { name: 'Máy sấy tóc', icon: 'hairdryer' },
  { name: 'Cho phép thú cưng', icon: 'pet' },
  { name: 'Khu vui chơi trẻ em', icon: 'kids' },
];

// 3. ACCOUNTS
const ACCOUNTS = [
  // 4 System Admins
  { user: 'admin.nguyen', name: 'Nguyễn Minh Tuấn', email: 'admin.tuan@egode.vn', role: 'Quản trị hệ thống', gender: 'Nam', dob: '1985-04-12', phone: '0912111001', status: 'Hoạt động', pass: 'Admin#Egode2026@Tuan' },
  { user: 'admin.hoang', name: 'Hoàng Mai Linh', email: 'admin.linh@egode.vn', role: 'Quản trị hệ thống', gender: 'Nữ', dob: '1990-09-25', phone: '0912111002', status: 'Hoạt động', pass: 'Admin#Egode2026@Linh' },
  { user: 'admin.tran', name: 'Trần Quang Khải', email: 'admin.khai@egode.vn', role: 'Quản trị hệ thống', gender: 'Nam', dob: '1988-11-18', phone: '0912111003', status: 'Hoạt động', pass: 'Admin#Egode2026@Khai' },
  { user: 'admin.le', name: 'Lê Thu Trang', email: 'admin.trang@egode.vn', role: 'Quản trị hệ thống', gender: 'Nữ', dob: '1993-02-08', phone: '0912111004', status: 'Hoạt động', pass: 'Admin#Egode2026@Trang' },

  // 10 Hotel Owners
  { user: 'owner.phamminh', name: 'Phạm Minh Châu', email: 'phamminh.chau@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nam', dob: '1978-06-15', phone: '0983111011', status: 'Hoạt động', pass: 'Partner#Egode2026@Chau' },
  { user: 'owner.vuminh', name: 'Vũ Minh Khang', email: 'vuminh.khang@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nam', dob: '1982-10-20', phone: '0983111012', status: 'Hoạt động', pass: 'Partner#Egode2026@Khang' },
  { user: 'owner.dangtuan', name: 'Đặng Anh Tuấn', email: 'dang.tuan@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nam', dob: '1975-03-30', phone: '0983111013', status: 'Hoạt động', pass: 'Partner#Egode2026@Tuan' },
  { user: 'owner.nguyenthuy', name: 'Nguyễn Bích Thủy', email: 'nguyen.thuy@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nữ', dob: '1984-12-14', phone: '0983111014', status: 'Hoạt động', pass: 'Partner#Egode2026@Thuy' },
  { user: 'owner.tranlong', name: 'Trần Bảo Long', email: 'tran.long@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nam', dob: '1980-07-22', phone: '0983111015', status: 'Hoạt động', pass: 'Partner#Egode2026@Long' },
  { user: 'owner.lexuan', name: 'Lê Xuân Hùng', email: 'le.xuanhung@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nam', dob: '1986-05-19', phone: '0983111016', status: 'Hoạt động', pass: 'Partner#Egode2026@Hung' },
  { user: 'owner.doanthi', name: 'Đoàn Hồng Mai', email: 'doan.hongmai@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nữ', dob: '1983-08-05', phone: '0983111017', status: 'Hoạt động', pass: 'Partner#Egode2026@Mai' },
  { user: 'owner.nguyenquoc', name: 'Nguyễn Quốc Đạt', email: 'nguyen.quocdat@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nam', dob: '1979-01-11', phone: '0983111018', status: 'Hoạt động', pass: 'Partner#Egode2026@Dat' },
  { user: 'owner.phanvan', name: 'Phan Thanh Vân', email: 'phan.thanhvan@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nữ', dob: '1987-09-02', phone: '0983111019', status: 'Hoạt động', pass: 'Partner#Egode2026@Van' },
  { user: 'owner.buitrung', name: 'Bùi Trung Kiên', email: 'bui.trungkien@egode-partner.vn', role: 'Chủ khách sạn', gender: 'Nam', dob: '1981-11-28', phone: '0983111020', status: 'Hoạt động', pass: 'Partner#Egode2026@Kien' },

  // 6 Verified Customers
  { user: 'khach.namle', name: 'Lê Hoàng Nam', email: 'nam.lehoang@gmail.com', role: 'Khách hàng', gender: 'Nam', dob: '1994-03-15', phone: '0905222001', status: 'Hoạt động', pass: 'Customer#Egode2026@Nam' },
  { user: 'khach.phuonganh', name: 'Đỗ Phương Anh', email: 'phuonganh.do@gmail.com', role: 'Khách hàng', gender: 'Nữ', dob: '1996-07-22', phone: '0905222002', status: 'Hoạt động', pass: 'Customer#Egode2026@Anh' },
  { user: 'khach.ducthinh', name: 'Vũ Đức Thịnh', email: 'thinh.vuduc@gmail.com', role: 'Khách hàng', gender: 'Nam', dob: '1991-10-05', phone: '0905222003', status: 'Hoạt động', pass: 'Customer#Egode2026@Thinh' },
  { user: 'khach.thuyduong', name: 'Trần Thùy Dương', email: 'duong.tranthuy@gmail.com', role: 'Khách hàng', gender: 'Nữ', dob: '1998-12-19', phone: '0905222004', status: 'Hoạt động', pass: 'Customer#Egode2026@Duong' },
  { user: 'khach.minhtri', name: 'Phạm Minh Trí', email: 'tri.phamminh@gmail.com', role: 'Khách hàng', gender: 'Nam', dob: '1989-04-30', phone: '0905222005', status: 'Hoạt động', pass: 'Customer#Egode2026@Tri' },
  { user: 'khach.ngocmai', name: 'Nguyễn Ngọc Mai', email: 'mai.nguyenngoc@gmail.com', role: 'Khách hàng', gender: 'Nữ', dob: '1995-08-14', phone: '0905222006', status: 'Hoạt động', pass: 'Customer#Egode2026@Mai' },
];

async function main() {
  console.log('Generating distinct bcrypt hashes for accounts...');
  const accountsHashed = await Promise.all(
    ACCOUNTS.map(async (a) => {
      const passwordHash = await hashPassword(a.pass);
      const { pass, ...safe } = a;
      return { ...safe, passwordHash };
    })
  );

  // 4. PARTNER APPLICATIONS (for the 10 owners)
  const PARTNER_APPLICATIONS = ACCOUNTS.filter((a) => a.role === 'Chủ khách sạn').map((a, i) => ({
    user: a.user,
    cccd: `0${String(79_100_000_000 + i * 1_472_583).slice(0, 11)}`,
    license: `GPKD-${String(450_000 + i * 83).padStart(6, '0')}`,
    taxCode: `03${String(1_000_000_00 + i * 93_175).slice(0, 8)}`,
    docUrl: `https://storage.egode.vn/partner-kyc/${a.user}-registration.pdf`,
    status: 'Đã duyệt',
    reason: null,
  }));

  // 5. POLICIES & PROMOTIONS
  const POLICIES = {
    cancellationPolicy: {
      name: 'Chính sách hủy linh hoạt tiêu chuẩn',
      description: 'Hủy trước 48 giờ hoàn 100%, từ 24 đến dưới 48 giờ hoàn 50%, dưới 24 giờ không hoàn tiền.',
      status: 'Hoạt động',
      tiers: [
        { hours: 48, rate: 100 },
        { hours: 24, rate: 50 },
        { hours: 0, rate: 0 },
      ],
    },
    promotions: [
      { code: 'CHAOMUNG2026', type: 'Phần trăm', value: 10, minOrder: 500000, maxDiscount: 300000, limit: 500, startDays: -30, endDays: 180, scope: 'Toàn hệ thống', status: 'Hoạt động' },
      { code: 'GIAM200K', type: 'Số tiền cố định', value: 200000, minOrder: 1500000, maxDiscount: 200000, limit: 300, startDays: -15, endDays: 120, scope: 'Toàn hệ thống', status: 'Hoạt động' },
      { code: 'CUOITUAN15', type: 'Phần trăm', value: 15, minOrder: 2000000, maxDiscount: 600000, limit: 200, startDays: -10, endDays: 90, scope: 'Toàn hệ thống', status: 'Hoạt động' },
      { code: 'VIPHOTEL25', type: 'Phần trăm', value: 25, minOrder: 4000000, maxDiscount: 1500000, limit: 100, startDays: -5, endDays: 150, scope: 'Toàn hệ thống', status: 'Hoạt động' },
    ],
  };

  writeFileSync(path.join(CATALOG_DIR, 'locations.json'), JSON.stringify(LOCATIONS, null, 2) + '\n');
  writeFileSync(path.join(CATALOG_DIR, 'amenities.json'), JSON.stringify(AMENITIES, null, 2) + '\n');
  writeFileSync(path.join(CATALOG_DIR, 'accounts.json'), JSON.stringify(accountsHashed, null, 2) + '\n');
  writeFileSync(path.join(CATALOG_DIR, 'partner-applications.json'), JSON.stringify(PARTNER_APPLICATIONS, null, 2) + '\n');
  writeFileSync(path.join(CATALOG_DIR, 'policies.json'), JSON.stringify(POLICIES, null, 2) + '\n');

  console.log('Catalog foundation files written successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
