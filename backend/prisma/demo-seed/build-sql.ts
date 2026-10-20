/** Sinh file database/seed/002_demo_data.sql chứa dữ liệu demo đầy đủ cho mọi bảng */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(__dirname, '../../../database/seed/002_demo_data.sql');
const LOCK = path.resolve(__dirname, '../../../database/seed/demo/images.lock.json');

// Mã băm bcrypt của mật khẩu "Demo@123" dùng cho mọi tài khoản demo
const DEMO_PASSWORD_HASH = '$2b$12$MAlf8CruNa5GKGgHh1UNreiwyEJtsUmHp8T8YU7rEVU4TT7RyxRpu';

// Hàm tiện ích
const q = (v: string | null | undefined) => (v === null || v === undefined ? 'NULL' : `N'${v.replace(/'/g, "''")}'`);
const n = (v: number | null | undefined) => (v === null || v === undefined ? 'NULL' : String(v));
const rows = (list: string[][]) => list.map((r) => `    (${r.join(', ')})`).join(',\n');

/** Bộ sinh số ngẫu nhiên cố định để SQL sinh ra ổn định giữa các lần chạy */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260927);
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

// Ảnh
interface LockedImage { key: string; group: string; url: string }
const images: LockedImage[] = JSON.parse(readFileSync(LOCK, 'utf8'));
const byGroup = (g: string) => images.filter((i) => i.group === g).map((i) => i.url);
const pools = {
  exterior: byGroup('exterior'),
  pool: byGroup('pool'),
  lobby: byGroup('lobby'),
  restaurant: byGroup('restaurant'),
  room: byGroup('room'),
  review: byGroup('review'),
};
for (const [g, list] of Object.entries(pools)) if (list.length === 0) throw new Error(`No locked images for ${g} — run seed:demo:images first`);
const cursor: Record<string, number> = {};
const nextImage = (g: keyof typeof pools) => {
  const i = cursor[g] ?? 0;
  cursor[g] = i + 1;
  return pools[g][i % pools[g].length];
};

// Dữ liệu tham chiếu
const CITIES = [
  ['Hồ Chí Minh', 'Hồ Chí Minh'], ['Hà Nội', 'Hà Nội'], ['Đà Nẵng', 'Đà Nẵng'],
  ['Nha Trang', 'Khánh Hòa'], ['Đà Lạt', 'Lâm Đồng'], ['Hội An', 'Quảng Nam'],
  ['Phú Quốc', 'Kiên Giang'], ['Hạ Long', 'Quảng Ninh'], ['Sa Pa', 'Lào Cai'],
  ['Huế', 'Thừa Thiên Huế'], ['Vũng Tàu', 'Bà Rịa - Vũng Tàu'],
] as const;

const AMENITIES = [
  ['Wi-Fi miễn phí', 'wifi'], ['Hồ bơi', 'pool'], ['Bãi đỗ xe', 'parking'], ['Nhà hàng', 'restaurant'],
  ['Phòng gym', 'gym'], ['Điều hòa nhiệt độ', 'ac'], ['Đưa đón sân bay', 'shuttle'], ['Spa & Massage', 'spa'],
  ['Bãi biển riêng', 'beach'], ['Quầy bar', 'bar'], ['Lễ tân 24/7', 'reception'], ['Bữa sáng miễn phí', 'breakfast'],
  ['Ban công', 'balcony'], ['Bồn tắm', 'bathtub'], ['TV màn hình phẳng', 'tv'], ['Minibar', 'minibar'],
  ['Két sắt an toàn', 'safe'], ['Máy sấy tóc', 'hairdryer'], ['Cho phép thú cưng', 'pet'], ['Khu vui chơi trẻ em', 'kids'],
] as const;

type Role = 'Khách hàng' | 'Chủ khách sạn' | 'Quản trị hệ thống';
interface Account { user: string; name: string; role: Role; status?: string; born?: string; gender?: string; ageDays: number }
const ACCOUNTS: Account[] = [
  { user: 'demo_admin', name: 'Nguyễn Hoàng Quân', role: 'Quản trị hệ thống', born: '1988-03-12', gender: 'Nam', ageDays: 720 },
  { user: 'demo_admin2', name: 'Trịnh Mai Anh', role: 'Quản trị hệ thống', born: '1992-11-02', gender: 'Nữ', ageDays: 540 },
  { user: 'demo_owner_minh', name: 'Trần Quang Minh', role: 'Chủ khách sạn', born: '1980-06-21', gender: 'Nam', ageDays: 650 },
  { user: 'demo_owner_lan', name: 'Lê Thị Ngọc Lan', role: 'Chủ khách sạn', born: '1984-09-15', gender: 'Nữ', ageDays: 640 },
  { user: 'demo_owner_hung', name: 'Phạm Văn Hùng', role: 'Chủ khách sạn', born: '1976-01-30', gender: 'Nam', ageDays: 610 },
  { user: 'demo_owner_thao', name: 'Võ Thu Thảo', role: 'Chủ khách sạn', born: '1987-12-08', gender: 'Nữ', ageDays: 590 },
  { user: 'demo_owner_khoa', name: 'Đặng Minh Khoa', role: 'Chủ khách sạn', born: '1990-04-19', gender: 'Nam', ageDays: 560 },
  ...([
    ['demo_kh_an', 'Nguyễn Văn An', 'Nam'], ['demo_kh_binh', 'Trần Thị Bình', 'Nữ'], ['demo_kh_cuong', 'Lê Minh Cường', 'Nam'],
    ['demo_kh_dung', 'Phạm Thùy Dung', 'Nữ'], ['demo_kh_giang', 'Hoàng Hương Giang', 'Nữ'], ['demo_kh_hai', 'Vũ Đức Hải', 'Nam'],
    ['demo_kh_hanh', 'Đỗ Mỹ Hạnh', 'Nữ'], ['demo_kh_hieu', 'Bùi Trung Hiếu', 'Nam'], ['demo_kh_huong', 'Ngô Thu Hương', 'Nữ'],
    ['demo_kh_khanh', 'Dương Quốc Khánh', 'Nam'], ['demo_kh_linh', 'Lý Khánh Linh', 'Nữ'], ['demo_kh_long', 'Mai Thành Long', 'Nam'],
    ['demo_kh_mai', 'Hồ Tuyết Mai', 'Nữ'], ['demo_kh_nam', 'Đinh Hoài Nam', 'Nam'], ['demo_kh_ngoc', 'Tạ Bảo Ngọc', 'Nữ'],
    ['demo_kh_phong', 'Châu Gia Phong', 'Nam'], ['demo_kh_quynh', 'Lâm Như Quỳnh', 'Nữ'], ['demo_kh_son', 'Kiều Thanh Sơn', 'Nam'],
    ['demo_kh_trang', 'Phan Huyền Trang', 'Nữ'], ['demo_kh_tuan', 'Cao Anh Tuấn', 'Nam'],
  ] as const).map(([user, name, gender], i): Account => ({
    user, name, role: 'Khách hàng', gender,
    // Một số khách hàng không điền thông tin hồ sơ tùy chọn
    born: i % 6 === 5 ? undefined : `${1975 + ((i * 7) % 26)}-${String(1 + ((i * 5) % 12)).padStart(2, '0')}-${String(1 + ((i * 11) % 27)).padStart(2, '0')}`,
    ageDays: 480 - i * 20,
  })),
  { user: 'demo_kh_bikhoa', name: 'Trương Minh Tâm', role: 'Khách hàng', status: 'Khóa', gender: 'Nam', born: '1995-07-07', ageDays: 300 },
];
const CUSTOMERS = ACCOUNTS.filter((a) => a.role === 'Khách hàng' && !a.status).map((a) => a.user);
const phoneOf = (i: number) => `09${String(10_000_000 + ((i * 7_919_117) % 89_999_999)).slice(0, 8)}`;

// Hồ sơ đối tác: đã duyệt và các trạng thái của khách
const APPLICATIONS = [
  ...ACCOUNTS.filter((a) => a.role === 'Chủ khách sạn').map((a) => ({ user: a.user, status: 'Đã duyệt', reason: null as string | null })),
  { user: 'demo_kh_ngoc', status: 'Chờ duyệt', reason: null },
  { user: 'demo_kh_phong', status: 'Chờ duyệt', reason: null },
  { user: 'demo_kh_son', status: 'Chờ duyệt', reason: null },
  { user: 'demo_kh_long', status: 'Từ chối', reason: 'Giấy phép kinh doanh đã hết hạn và mã số thuế không khớp với thông tin đăng ký. Vui lòng bổ sung bản cập nhật.' },
];

// Khách sạn và loại phòng
type RoomTpl = 'superior' | 'twin' | 'deluxe' | 'family' | 'suite' | 'villa';
const ROOM_TPL: Record<RoomTpl, { name: string; beds: number; cap: number; area: number; bed: string; mult: number; inv: number; amen: string[]; desc: string }> = {
  superior: { name: 'Phòng Superior', beds: 1, cap: 2, area: 24, bed: 'Giường đôi', mult: 1, inv: 10, amen: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'TV màn hình phẳng', 'Máy sấy tóc'], desc: 'Phòng tiêu chuẩn ấm cúng với giường đôi, bàn làm việc và phòng tắm vòi sen.' },
  twin: { name: 'Phòng Twin', beds: 2, cap: 2, area: 28, bed: 'Giường đơn', mult: 1.05, inv: 8, amen: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'TV màn hình phẳng', 'Két sắt an toàn'], desc: 'Hai giường đơn riêng biệt, phù hợp cho bạn bè hoặc đồng nghiệp đi công tác.' },
  deluxe: { name: 'Phòng Deluxe', beds: 1, cap: 2, area: 32, bed: 'Giường King', mult: 1.35, inv: 8, amen: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'TV màn hình phẳng', 'Minibar', 'Két sắt an toàn', 'Ban công'], desc: 'Phòng rộng rãi với giường King, ban công riêng và minibar.' },
  family: { name: 'Phòng Gia Đình', beds: 2, cap: 4, area: 42, bed: 'Giường đôi + giường đơn', mult: 1.7, inv: 6, amen: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'TV màn hình phẳng', 'Minibar', 'Bồn tắm'], desc: 'Không gian cho gia đình 4 người với một giường đôi và hai giường đơn.' },
  suite: { name: 'Suite', beds: 1, cap: 3, area: 60, bed: 'Giường King', mult: 2.5, inv: 3, amen: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'TV màn hình phẳng', 'Minibar', 'Két sắt an toàn', 'Bồn tắm', 'Ban công'], desc: 'Suite có phòng khách riêng, bồn tắm và tầm nhìn đẹp nhất của khách sạn.' },
  villa: { name: 'Villa Hồ Bơi Riêng', beds: 3, cap: 6, area: 120, bed: '2 giường King + 1 giường đơn', mult: 4, inv: 3, amen: ['Wi-Fi miễn phí', 'Điều hòa nhiệt độ', 'TV màn hình phẳng', 'Minibar', 'Két sắt an toàn', 'Bồn tắm', 'Ban công'], desc: 'Biệt thự riêng với hồ bơi, sân vườn và bếp nhỏ cho nhóm 6 khách.' },
};
const STAR_BASE: Record<number, number> = { 2: 450_000, 3: 700_000, 4: 1_200_000, 5: 2_200_000 };

interface Hotel {
  key: string; name: string; owner: string; city: string; province: string; address: string; stars: number;
  status: 'Hoạt động' | 'Chờ duyệt' | 'Đình chỉ' | 'Ngừng hoạt động'; resort: boolean; ageDays: number;
  rooms: Array<RoomTpl | [RoomTpl, string]>; amenities: string[]; desc: string; checkIn?: string; checkOut?: string;
}
const HOTELS: Hotel[] = [
  { key: 'H01', name: 'Lotus Central Hotel Sài Gòn', owner: 'demo_owner_minh', city: 'Hồ Chí Minh', province: 'Hồ Chí Minh', address: '68 Lê Thánh Tôn, Phường Bến Nghé, Quận 1', stars: 4, status: 'Hoạt động', resort: false, ageDays: 520, rooms: ['superior', 'deluxe', 'suite'], amenities: ['Wi-Fi miễn phí', 'Nhà hàng', 'Phòng gym', 'Lễ tân 24/7', 'Quầy bar', 'Bãi đỗ xe'], desc: 'Khách sạn 4 sao ngay trung tâm Quận 1, cách chợ Bến Thành 5 phút đi bộ, phù hợp cho cả du lịch và công tác.' },
  { key: 'H02', name: 'Bến Thành Garden Residence', owner: 'demo_owner_minh', city: 'Hồ Chí Minh', province: 'Hồ Chí Minh', address: '15 Lý Tự Trọng, Quận 1', stars: 3, status: 'Hoạt động', resort: false, ageDays: 470, rooms: ['superior', 'twin', 'family'], amenities: ['Wi-Fi miễn phí', 'Bữa sáng miễn phí', 'Lễ tân 24/7', 'Bãi đỗ xe'], desc: 'Căn hộ dịch vụ yên tĩnh giữa lòng thành phố, có bếp nhỏ và khu vườn trên sân thượng.' },
  { key: 'H03', name: 'Thảo Điền Riverside Villa', owner: 'demo_owner_lan', city: 'Hồ Chí Minh', province: 'Hồ Chí Minh', address: '21 Nguyễn Văn Hưởng, Thảo Điền, TP. Thủ Đức', stars: 5, status: 'Hoạt động', resort: true, ageDays: 430, rooms: ['deluxe', 'suite', 'villa'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Spa & Massage', 'Nhà hàng', 'Quầy bar', 'Đưa đón sân bay', 'Cho phép thú cưng'], desc: 'Khu biệt thự ven sông Sài Gòn với hồ bơi vô cực, spa và nhà hàng Pháp.', checkIn: '15:00', checkOut: '11:00' },
  { key: 'H04', name: 'Hồ Gươm Heritage Hotel', owner: 'demo_owner_hung', city: 'Hà Nội', province: 'Hà Nội', address: '12 Hàng Khay, Quận Hoàn Kiếm', stars: 4, status: 'Hoạt động', resort: false, ageDays: 500, rooms: ['superior', 'twin', 'deluxe', 'family'], amenities: ['Wi-Fi miễn phí', 'Nhà hàng', 'Lễ tân 24/7', 'Bữa sáng miễn phí', 'Đưa đón sân bay'], desc: 'Tòa nhà kiến trúc Pháp cổ nhìn ra hồ Hoàn Kiếm, gần phố cổ và nhà hát lớn.' },
  { key: 'H05', name: 'Tây Hồ Lakeview Suites', owner: 'demo_owner_hung', city: 'Hà Nội', province: 'Hà Nội', address: '88 Xuân Diệu, Quận Tây Hồ', stars: 5, status: 'Hoạt động', resort: false, ageDays: 450, rooms: ['deluxe', 'suite', 'family'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Phòng gym', 'Spa & Massage', 'Nhà hàng', 'Quầy bar'], desc: 'Căn suite cao cấp nhìn ra Hồ Tây, hồ bơi trong nhà và quầy bar trên tầng thượng.' },
  { key: 'H06', name: 'Phố Cổ Cozy Inn', owner: 'demo_owner_hung', city: 'Hà Nội', province: 'Hà Nội', address: '45 Hàng Bạc, Quận Hoàn Kiếm', stars: 2, status: 'Hoạt động', resort: false, ageDays: 380, rooms: ['superior', 'twin'], amenities: ['Wi-Fi miễn phí', 'Lễ tân 24/7'], desc: 'Nhà nghỉ nhỏ giá tốt ngay trong khu phố cổ, thuận tiện khám phá ẩm thực đường phố.' },
  { key: 'H07', name: 'Mỹ Khê Ocean Pearl Resort', owner: 'demo_owner_lan', city: 'Đà Nẵng', province: 'Đà Nẵng', address: '255 Võ Nguyên Giáp, Quận Ngũ Hành Sơn', stars: 5, status: 'Hoạt động', resort: true, ageDays: 490, rooms: ['deluxe', 'family', 'suite', 'villa'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Bãi biển riêng', 'Spa & Massage', 'Nhà hàng', 'Quầy bar', 'Khu vui chơi trẻ em', 'Đưa đón sân bay'], desc: 'Resort 5 sao sát bãi biển Mỹ Khê với bãi tắm riêng, hồ bơi vô cực và câu lạc bộ trẻ em.', checkIn: '15:00', checkOut: '12:00' },
  { key: 'H08', name: 'Sông Hàn Skyline Hotel', owner: 'demo_owner_lan', city: 'Đà Nẵng', province: 'Đà Nẵng', address: '36 Bạch Đằng, Quận Hải Châu', stars: 4, status: 'Hoạt động', resort: false, ageDays: 400, rooms: ['superior', 'deluxe', 'twin'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Nhà hàng', 'Quầy bar', 'Phòng gym'], desc: 'Khách sạn bên bờ sông Hàn, ngắm cầu Rồng phun lửa từ quầy bar tầng thượng.' },
  { key: 'H09', name: 'Sơn Trà Green Retreat', owner: 'demo_owner_khoa', city: 'Đà Nẵng', province: 'Đà Nẵng', address: 'Đường Hoàng Sa, Bán đảo Sơn Trà', stars: 4, status: 'Chờ duyệt', resort: true, ageDays: 12, rooms: ['deluxe', 'villa'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Spa & Massage'], desc: 'Khu nghỉ dưỡng sinh thái trên bán đảo Sơn Trà — đang chờ quản trị viên phê duyệt.' },
  { key: 'H10', name: 'Nha Trang Bay Horizon', owner: 'demo_owner_thao', city: 'Nha Trang', province: 'Khánh Hòa', address: '72 Trần Phú, Lộc Thọ', stars: 4, status: 'Hoạt động', resort: false, ageDays: 470, rooms: ['superior', 'deluxe', 'family'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Nhà hàng', 'Quầy bar', 'Bữa sáng miễn phí'], desc: 'Khách sạn đối diện biển Trần Phú, hồ bơi tầng thượng nhìn toàn cảnh vịnh Nha Trang.' },
  { key: 'H11', name: 'Vịnh Xanh Beach Resort', owner: 'demo_owner_thao', city: 'Nha Trang', province: 'Khánh Hòa', address: 'Bãi Dài, Cam Lâm', stars: 5, status: 'Hoạt động', resort: true, ageDays: 440, rooms: ['deluxe', 'suite', 'villa'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Bãi biển riêng', 'Spa & Massage', 'Nhà hàng', 'Đưa đón sân bay', 'Khu vui chơi trẻ em'], desc: 'Resort biệt lập trên Bãi Dài với villa hồ bơi riêng và dịch vụ đưa đón sân bay Cam Ranh.', checkIn: '14:00', checkOut: '12:00' },
  { key: 'H12', name: 'Đồi Thông Pine Hill Villa', owner: 'demo_owner_khoa', city: 'Đà Lạt', province: 'Lâm Đồng', address: '9 Trần Hưng Đạo, Phường 10', stars: 3, status: 'Hoạt động', resort: false, ageDays: 420, rooms: ['superior', 'family'], amenities: ['Wi-Fi miễn phí', 'Bãi đỗ xe', 'Bữa sáng miễn phí', 'Cho phép thú cưng'], desc: 'Biệt thự Pháp giữa đồi thông, lò sưởi và khu vườn hoa cẩm tú cầu.' },
  { key: 'H13', name: 'Langbiang Garden Lodge', owner: 'demo_owner_khoa', city: 'Đà Lạt', province: 'Lâm Đồng', address: '3 Nguyễn Du, Phường 9', stars: 4, status: 'Hoạt động', resort: false, ageDays: 360, rooms: ['superior', 'deluxe', 'suite'], amenities: ['Wi-Fi miễn phí', 'Nhà hàng', 'Spa & Massage', 'Bãi đỗ xe'], desc: 'Nhà nghỉ vườn yên tĩnh, bữa sáng với rau và dâu tây từ nông trại của khách sạn.' },
  { key: 'H14', name: 'Hoài River Heritage Hotel', owner: 'demo_owner_lan', city: 'Hội An', province: 'Quảng Nam', address: '101 Bạch Đằng, Phường Minh An', stars: 4, status: 'Hoạt động', resort: false, ageDays: 410, rooms: ['superior', 'deluxe', 'family'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Nhà hàng', 'Bữa sáng miễn phí', 'Đưa đón sân bay'], desc: 'Khách sạn phong cách nhà cổ bên sông Hoài, đi bộ 3 phút đến Chùa Cầu.' },
  { key: 'H15', name: 'An Bàng Coconut Homestay', owner: 'demo_owner_lan', city: 'Hội An', province: 'Quảng Nam', address: 'Thôn An Bàng, Cẩm An', stars: 3, status: 'Hoạt động', resort: false, ageDays: 330, rooms: [['superior', 'Phòng Vườn Dừa'], 'family'], amenities: ['Wi-Fi miễn phí', 'Bữa sáng miễn phí', 'Bãi đỗ xe', 'Cho phép thú cưng'], desc: 'Homestay giữa rặng dừa, cách biển An Bàng 200m, có xe đạp miễn phí.' },
  { key: 'H16', name: 'Dương Đông Sunset Resort', owner: 'demo_owner_thao', city: 'Phú Quốc', province: 'Kiên Giang', address: '118 Trần Hưng Đạo, Dương Đông', stars: 5, status: 'Hoạt động', resort: true, ageDays: 390, rooms: ['deluxe', 'family', 'villa'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Bãi biển riêng', 'Spa & Massage', 'Nhà hàng', 'Quầy bar', 'Đưa đón sân bay'], desc: 'Resort bãi Trường ngắm hoàng hôn đẹp nhất đảo, quầy bar trên cát và spa thảo dược.', checkIn: '15:00', checkOut: '12:00' },
  { key: 'H17', name: 'Hàm Ninh Fishing Village Lodge', owner: 'demo_owner_thao', city: 'Phú Quốc', province: 'Kiên Giang', address: 'Làng chài Hàm Ninh', stars: 3, status: 'Đình chỉ', resort: false, ageDays: 300, rooms: ['superior', 'twin'], amenities: ['Wi-Fi miễn phí', 'Nhà hàng'], desc: 'Nhà nghỉ làng chài — đang bị quản trị viên đình chỉ do nhiều khiếu nại về vệ sinh.' },
  { key: 'H18', name: 'Hạ Long Bay View Hotel', owner: 'demo_owner_minh', city: 'Hạ Long', province: 'Quảng Ninh', address: '9 Hạ Long, Bãi Cháy', stars: 4, status: 'Hoạt động', resort: false, ageDays: 350, rooms: ['superior', 'deluxe', 'family'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Nhà hàng', 'Quầy bar', 'Bãi đỗ xe'], desc: 'Tầm nhìn trọn vịnh Hạ Long, gần bến tàu du thuyền và cáp treo Nữ Hoàng.' },
  { key: 'H19', name: 'Sa Pa Cloud Valley Lodge', owner: 'demo_owner_khoa', city: 'Sa Pa', province: 'Lào Cai', address: '27 Mường Hoa, Thị xã Sa Pa', stars: 3, status: 'Hoạt động', resort: false, ageDays: 320, rooms: ['superior', 'deluxe', 'family'], amenities: ['Wi-Fi miễn phí', 'Nhà hàng', 'Bữa sáng miễn phí', 'Spa & Massage'], desc: 'Nhà nghỉ trên sườn đồi nhìn thung lũng Mường Hoa, bồn tắm lá thuốc người Dao đỏ.' },
  { key: 'H20', name: 'Kinh Thành Imperial Hotel', owner: 'demo_owner_hung', city: 'Huế', province: 'Thừa Thiên Huế', address: '5 Lê Lợi, Phường Vĩnh Ninh', stars: 4, status: 'Ngừng hoạt động', resort: false, ageDays: 600, rooms: ['superior', 'deluxe'], amenities: ['Wi-Fi miễn phí', 'Nhà hàng', 'Hồ bơi'], desc: 'Khách sạn bên sông Hương — chủ khách sạn đã ngừng kinh doanh, lịch sử đặt phòng được giữ lại.' },
  { key: 'H21', name: 'Bãi Sau Seaside Hotel', owner: 'demo_owner_minh', city: 'Vũng Tàu', province: 'Bà Rịa - Vũng Tàu', address: '160 Thùy Vân, Phường 8', stars: 3, status: 'Hoạt động', resort: false, ageDays: 300, rooms: ['superior', 'twin', 'family'], amenities: ['Wi-Fi miễn phí', 'Hồ bơi', 'Bãi đỗ xe', 'Nhà hàng'], desc: 'Khách sạn đối diện Bãi Sau, phù hợp cho chuyến đi cuối tuần từ TP. Hồ Chí Minh.' },
];

interface Room { key: string; hotel: Hotel; tpl: RoomTpl; name: string; price: number; inv: number; status: string }
const ROOMS: Room[] = [];
for (const h of HOTELS) {
  h.rooms.forEach((entry, i) => {
    const [tpl, customName] = Array.isArray(entry) ? entry : [entry, undefined];
    const t = ROOM_TPL[tpl];
    const view = h.resort && (tpl === 'deluxe' || tpl === 'suite') ? ' Hướng Biển' : '';
    ROOMS.push({
      key: `${h.key}-R${i + 1}`,
      hotel: h,
      tpl,
      name: customName ?? `${t.name}${view}`,
      price: Math.round((STAR_BASE[h.stars] * t.mult) / 10_000) * 10_000,
      inv: t.inv,
      status: 'Hoạt động',
    });
  });
}
// Loại phòng đã ngừng bán
ROOMS.find((r) => r.key === 'H04-R4')!.status = 'Ngừng bán';
// Tồn kho thấp cho kịch bản hết phòng
const SOLD_OUT_ROOM = ROOMS.find((r) => r.key === 'H07-R3')!;
SOLD_OUT_ROOM.inv = 2;
// Giai đoạn bảo trì đóng bán loại phòng
const CLOSED = { room: 'H05-R1', from: 40, to: 44 };

const RATE_FROM = -120;
const RATE_TO = 150;

// Khuyến mãi
const PROMOS = [
  ['CHAOMUNG10', 'Phần trăm', 10, 0, 500_000, 0, -160, 180, 'Hoạt động'],
  ['GIAM200K', 'Số tiền cố định', 200_000, 1_500_000, 0, 200, -60, 120, 'Hoạt động'],
  ['CUOITUAN15', 'Phần trăm', 15, 2_000_000, 800_000, 100, -30, 90, 'Hoạt động'],
  ['VIP25', 'Phần trăm', 25, 5_000_000, 2_000_000, 30, -45, 150, 'Hoạt động'],
  ['HETLUOT', 'Số tiền cố định', 100_000, 0, 0, 3, -160, 100, 'Hoạt động'],
  ['HETHAN20', 'Phần trăm', 20, 0, 1_000_000, 0, -120, -10, 'Hoạt động'],
  ['SAPTOI30', 'Phần trăm', 30, 1_000_000, 1_500_000, 50, 10, 60, 'Hoạt động'],
  ['TAMNGUNG', 'Phần trăm', 12, 0, 600_000, 0, -30, 60, 'Ngừng'],
] as const;

// Đặt phòng
type Scenario = 'completed' | 'current' | 'future' | 'cancel_refund' | 'cancel_unpaid' | 'expired' | 'expired_failed' | 'pending';
interface Booking {
  code: string; customer: string; room: Room; qty: number; checkIn: number; nights: number; scenario: Scenario;
  promo: string | null; createdDay: number; createdMinute: number; cancelHoursBefore: number | null;
  note: string | null; cancelReason: string | null; refundFails: boolean;
}
const sellable = ROOMS.filter((r) => r.hotel.status === 'Hoạt động' && r.status === 'Hoạt động');
const occupancy = new Map<string, number>();
const occKey = (room: Room, day: number) => `${room.key}@${day}`;
const holdsInventory = (s: Scenario) => s === 'completed' || s === 'current' || s === 'future' || s === 'pending';
const fits = (room: Room, checkIn: number, nights: number, qty: number) => {
  for (let d = checkIn; d < checkIn + nights; d++) {
    if (d < RATE_FROM || d >= RATE_TO) return false;
    if (room.key === CLOSED.room && d >= CLOSED.from && d <= CLOSED.to) return false;
    if ((occupancy.get(occKey(room, d)) ?? 0) + qty > room.inv) return false;
  }
  return true;
};
const reserve = (room: Room, checkIn: number, nights: number, qty: number) => {
  for (let d = checkIn; d < checkIn + nights; d++) occupancy.set(occKey(room, d), (occupancy.get(occKey(room, d)) ?? 0) + qty);
};

const NOTES = ['Nhận phòng muộn khoảng 22h.', 'Cho mình xin phòng tầng cao, yên tĩnh.', 'Cần thêm một giường phụ cho bé.', 'Kỷ niệm ngày cưới, mong khách sạn trang trí giúp.', 'Không hút thuốc, dị ứng lông vũ.', 'Đi chuyến bay đến lúc 6h sáng, xin nhận phòng sớm nếu được.'];
const CANCEL_REASONS = ['Thay đổi lịch công tác', 'Gia đình có việc đột xuất', 'Đặt nhầm ngày', 'Tìm được lựa chọn phù hợp hơn', 'Chuyến bay bị hủy'];

const BOOKINGS: Booking[] = [];
let seq = 0;
function addBooking(spec: Partial<Booking> & { scenario: Scenario; checkIn: number; nights: number }, fixedRoom?: Room, fixedQty?: number) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const room = fixedRoom ?? pick(sellable);
    const qty = fixedQty ?? (room.inv >= 6 && rand() < 0.25 ? 2 : 1);
    if (holdsInventory(spec.scenario) && !fits(room, spec.checkIn, spec.nights, qty)) continue;
    if (!holdsInventory(spec.scenario) && (spec.checkIn < RATE_FROM || spec.checkIn + spec.nights > RATE_TO)) continue;
    if (holdsInventory(spec.scenario)) reserve(room, spec.checkIn, spec.nights, qty);
    seq += 1;
    BOOKINGS.push({
      code: `DEMO-${String(seq).padStart(4, '0')}`,
      customer: spec.customer ?? pick(CUSTOMERS),
      room, qty,
      checkIn: spec.checkIn, nights: spec.nights, scenario: spec.scenario,
      promo: spec.promo ?? null,
      createdDay: spec.createdDay ?? spec.checkIn - between(3, 30),
      createdMinute: spec.createdMinute ?? between(7 * 60, 22 * 60),
      cancelHoursBefore: spec.cancelHoursBefore ?? null,
      note: spec.note !== undefined ? spec.note : rand() < 0.3 ? pick(NOTES) : null,
      cancelReason: spec.cancelReason ?? null,
      refundFails: spec.refundFails ?? false,
    });
    return;
  }
  throw new Error(`Could not place a ${spec.scenario} booking`);
}

// Các kịch bản cố định được xếp trước
addBooking({ scenario: 'future', checkIn: 20, nights: 3, customer: 'demo_kh_an', createdDay: -6, note: 'Tuần trăng mật, cần phòng tầng cao.' }, SOLD_OUT_ROOM, 1);
addBooking({ scenario: 'future', checkIn: 21, nights: 2, customer: 'demo_kh_giang', createdDay: -4 }, SOLD_OUT_ROOM, 1);
// Mã hết lượt dùng sau ba lượt sử dụng
for (const c of ['demo_kh_binh', 'demo_kh_hai', 'demo_kh_mai']) addBooking({ scenario: 'completed', checkIn: -between(20, 80), nights: 2, customer: c, promo: 'HETLUOT' });

// Lượt lưu trú tại khách sạn đã ngừng hoạt động hoặc bị đình chỉ
for (const key of ['H17-R1', 'H17-R2', 'H20-R1', 'H20-R2']) {
  const room = ROOMS.find((r) => r.key === key)!;
  addBooking({ scenario: 'completed', checkIn: -between(40, 100), nights: 2 }, room, 1);
}

const PROMO_FOR_PAID = ['CHAOMUNG10', 'GIAM200K', 'CUOITUAN15', 'VIP25'];
const promoOrNull = () => (rand() < 0.3 ? pick(PROMO_FOR_PAID) : null);
for (let i = 0; i < 31; i++) {
  const nights = between(1, 4);
  addBooking({ scenario: 'completed', checkIn: -between(nights + 1, 110), nights, promo: promoOrNull() });
}
for (let i = 0; i < 3; i++) addBooking({ scenario: 'current', checkIn: -between(0, 1), nights: between(2, 4), createdDay: -between(5, 25) });
for (let i = 0; i < 20; i++) {
  const checkIn = between(2, 110);
  addBooking({ scenario: 'future', checkIn, nights: between(1, 5), promo: promoOrNull(), createdDay: -between(1, 30) });
}
// Đơn hủy sau khi thanh toán, mỗi mức hoàn tiền một đơn
const cancelled: Array<[number, number, number, boolean]> = [
  // Cấu hình: ngày nhận, số đêm, giờ trước nhận phòng, cổng hoàn tiền lỗi
  [45, 3, 24 * 50, false], [30, 2, 24 * 35, false], [-15, 2, 24 * 6, false], [-40, 3, 72, true],
  [-25, 2, 30, false], [-8, 1, 36, false], [-50, 2, 10, false],
];
for (const [checkIn, , hours] of cancelled) if (checkIn * 24 - hours >= 0) throw new Error('cancellation would be in the future');
for (const [checkIn, nights, hours, fails] of cancelled) {
  addBooking({ scenario: 'cancel_refund', checkIn, nights, cancelHoursBefore: hours, refundFails: fails, cancelReason: pick(CANCEL_REASONS), createdDay: checkIn - Math.ceil(hours / 24) - between(2, 12) });
}
for (let i = 0; i < 4; i++) {
  const checkIn = between(-60, 60);
  addBooking({ scenario: 'cancel_unpaid', checkIn, nights: between(1, 3), cancelReason: rand() < 0.5 ? pick(CANCEL_REASONS) : null, createdDay: Math.min(-1, checkIn - between(5, 20)) });
}
for (let i = 0; i < 2; i++) {
  const checkIn = between(-30, 60);
  addBooking({ scenario: 'expired', checkIn, nights: between(1, 3), createdDay: Math.min(-1, checkIn - between(3, 15)) });
}
addBooking({ scenario: 'expired_failed', checkIn: between(10, 50), nights: 2, createdDay: -3 });
// Đơn chờ thanh toán sẽ tự hủy khi quá hạn
addBooking({ scenario: 'pending', checkIn: 14, nights: 2, customer: 'demo_kh_an', createdDay: 0 });
addBooking({ scenario: 'pending', checkIn: 30, nights: 3, customer: 'demo_kh_trang', createdDay: 0 });

// Đánh giá
const REVIEW_TEXT: Record<number, string[]> = {
  5: ['Phòng sạch sẽ, view đẹp, nhân viên rất nhiệt tình. Chắc chắn sẽ quay lại!', 'Kỳ nghỉ tuyệt vời, bữa sáng phong phú và hồ bơi rất đẹp.', 'Vị trí thuận tiện, check-in nhanh, phòng rộng hơn mong đợi.', 'Dịch vụ chu đáo, được nâng hạng phòng miễn phí. Rất hài lòng.'],
  4: ['Khách sạn tốt so với giá tiền, chỉ có thang máy hơi chậm giờ cao điểm.', 'Phòng đẹp, giường êm. Wi-Fi đôi lúc chập chờn.', 'Nhân viên thân thiện, bữa sáng ổn nhưng chưa đa dạng lắm.'],
  3: ['Tạm ổn, phòng hơi cũ so với hình trên web nhưng sạch sẽ.', 'Vị trí đẹp nhưng cách âm kém, buổi tối hơi ồn.'],
  2: ['Phòng có mùi ẩm, điều hòa kêu to. Mong khách sạn cải thiện.'],
  1: ['Rất thất vọng: đặt phòng hướng biển nhưng được xếp phòng hướng bãi đỗ xe, lễ tân không hỗ trợ.'],
};
const SPAM = 'Liên hệ Zalo 0909xxxxxx để đặt phòng giá rẻ hơn 50%!!! Không cần qua web.';
interface Review { booking: Booking; score: number; text: string | null; status: string; images: string[] }
const REVIEWS: Review[] = [];
const completed = BOOKINGS.filter((b) => b.scenario === 'completed');
completed.forEach((b, i) => {
  if (i % 4 === 3) return; // ~25% of stays never get reviewed
  const stars = b.room.hotel.stars;
  const score = i === 5 ? 1 : i === 11 ? 2 : stars >= 5 ? pick([5, 5, 4]) : stars === 4 ? pick([5, 4, 4, 3]) : pick([4, 3, 4]);
  let status = i % 7 === 2 ? 'Chờ duyệt' : 'Hiển thị';
  let text: string | null = pick(REVIEW_TEXT[score]);
  if (i === 8 || i === 17) { status = 'Vi phạm'; text = SPAM; }
  if (i === 14) status = 'Ẩn';
  if (i === 20) text = null;
  REVIEWS.push({ booking: b, score, text, status, images: [] });
});
// Ảnh của khách trong một số đánh giá
REVIEWS.filter((r) => r.status === 'Hiển thị').slice(0, 7).forEach((r, i) => {
  r.images = i % 3 === 0 ? [nextImage('review'), nextImage('review')] : [nextImage('review')];
});

// Yêu cầu hỗ trợ
const bookingOf = (user: string) => BOOKINGS.find((b) => b.customer === user && b.scenario !== 'pending');
const SUPPORT = [
  ['demo_kh_an', 'Hỗ trợ', 'Xuất hóa đơn VAT cho đặt phòng', 'Công ty mình cần hóa đơn VAT cho kỳ lưu trú này, thông tin: Công ty TNHH ABC, MST 0312345678.', 'Mới', true, -2],
  ['demo_kh_binh', 'Hỗ trợ', 'Muốn đổi ngày nhận phòng', 'Mình muốn lùi ngày nhận phòng thêm 2 ngày, có được giữ nguyên giá không?', 'Đang xử lý', true, -4],
  ['demo_kh_cuong', 'Khiếu nại', 'Phòng không đúng như mô tả', 'Phòng thực tế nhỏ hơn và không có ban công như trong hình.', 'Đã xử lý', true, -30],
  ['demo_kh_dung', 'Khiếu nại', 'Tiền hoàn chưa về tài khoản', 'Mình đã hủy phòng 5 ngày trước nhưng chưa nhận được tiền hoàn.', 'Đang xử lý', true, -6],
  ['demo_kh_giang', 'Hỗ trợ', 'Hỏi về chính sách hủy phòng', 'Nếu mình hủy trước 30 tiếng thì được hoàn bao nhiêu phần trăm?', 'Đã xử lý', false, -20],
  ['demo_kh_hai', 'Hỗ trợ', 'Không nhận được mã xác nhận', 'Thanh toán xong nhưng không thấy mã xác nhận đặt phòng.', 'Đã xử lý', true, -45],
  ['demo_kh_hanh', 'Khiếu nại', 'Nhân viên lễ tân thiếu thân thiện', 'Lễ tân ca tối trả lời cộc lốc khi mình hỏi về dịch vụ giặt ủi.', 'Mới', true, -1],
  ['demo_kh_hieu', 'Hỗ trợ', 'Yêu cầu giường phụ cho trẻ em', 'Gia đình mình có bé 5 tuổi, khách sạn có hỗ trợ giường phụ không?', 'Mới', false, -3],
  ['demo_kh_huong', 'Khiếu nại', 'Phòng có mùi ẩm mốc', 'Phòng có mùi ẩm mốc rất khó chịu, xin đổi phòng nhưng không được hỗ trợ.', 'Đã xử lý', true, -60],
  ['demo_kh_khanh', 'Hỗ trợ', 'Thanh toán bị trừ tiền nhưng đơn chưa xác nhận', 'Tài khoản đã bị trừ tiền nhưng trạng thái đơn vẫn là chờ thanh toán.', 'Đang xử lý', true, -2],
  ['demo_kh_linh', 'Hỗ trợ', 'Cập nhật số điện thoại liên hệ', 'Mình đổi số điện thoại, nhờ cập nhật vào đơn đặt phòng giúp.', 'Mới', true, -1],
  ['demo_kh_mai', 'Khiếu nại', 'Khuyến mãi không áp dụng được', 'Mã CUOITUAN15 báo không hợp lệ dù đơn của mình trên 2 triệu.', 'Đã xử lý', false, -12],
  ['demo_kh_nam', 'Hỗ trợ', 'Hỏi về dịch vụ đưa đón sân bay', 'Khách sạn có xe đón ở sân bay Đà Nẵng lúc 23h không?', 'Mới', false, -5],
  ['demo_kh_quynh', 'Khiếu nại', 'Bị tính thêm phí không báo trước', 'Khi trả phòng mình bị thu thêm phí dịch vụ 10% không được thông báo.', 'Đang xử lý', true, -8],
] as const;
const RESOLUTIONS: Record<string, string> = {
  'Phòng không đúng như mô tả': 'Đã xác minh với khách sạn, khách sạn cập nhật lại hình ảnh và hoàn 300.000đ phí chênh lệch cho quý khách.',
  'Hỏi về chính sách hủy phòng': 'Theo chính sách hủy của đơn: hủy trước ≥48 giờ hoàn 100%, từ 24 đến dưới 48 giờ hoàn 50%, dưới 24 giờ không hoàn tiền.',
  'Không nhận được mã xác nhận': 'Mã xác nhận hiển thị trong mục "Đặt phòng của tôi". Chúng tôi đã kiểm tra, đơn của quý khách đã được xác nhận thành công.',
  'Phòng có mùi ẩm mốc': 'Đã làm việc với khách sạn, khách sạn xin lỗi và tặng voucher giảm 20% cho lần lưu trú tiếp theo.',
  'Khuyến mãi không áp dụng được': 'Mã CUOITUAN15 yêu cầu tổng tiền phòng trước giảm giá từ 2.000.000đ; đơn của quý khách chưa đạt ngưỡng nên hệ thống từ chối đúng quy định.',
};

// Sinh câu lệnh SQL
const hotelImages: string[][] = [];
for (const h of HOTELS) {
  const gallery = [nextImage('exterior'), nextImage('lobby'), h.resort || h.amenities.includes('Hồ bơi') ? nextImage('pool') : nextImage('exterior'), nextImage('restaurant')];
  gallery.forEach((url, i) => hotelImages.push([q(h.key), q(url), i === 0 ? '1' : '0']));
}
const roomImages: string[][] = [];
for (const r of ROOMS) [nextImage('room'), nextImage('room')].forEach((url, i) => roomImages.push([q(r.key), q(url), i === 0 ? '1' : '0']));
// Thay ảnh placeholder của seed cũ bằng ảnh Cloudinary
const legacyHotelImages = Array.from({ length: 20 }, () => q(nextImage('exterior')));
const legacyRoomImages = Array.from({ length: 30 }, () => q(nextImage('room')));

const sql = `/* =====================================================================
   002_demo_data.sql — demo / test dataset (GENERATED — do not edit by hand)
   Source: backend/prisma/demo-seed/build-sql.ts  (npm run seed:demo:sql)
   Images: database/seed/demo/images.lock.json (Cloudinary, folders hotel-booking/hotels|room-types|reviews)

   Prerequisites: migrations 001-007 and database/seed/001_roles.sql.
   Load (the -f 65001 flag is REQUIRED so Vietnamese N'...' literals stay UTF-8):
     sqlcmd -S localhost -U sa -P <password> -d <database> -C -f 65001 -i database/seed/002_demo_data.sql

   Every demo account's password: Demo@123
     Admin:     demo_admin, demo_admin2
     Owners:    demo_owner_minh, demo_owner_lan, demo_owner_hung, demo_owner_thao, demo_owner_khoa
     Customers: demo_kh_an ... demo_kh_tuan  (demo_kh_bikhoa is locked)

   Dates are relative to the day this runs (UTC) and every total is computed
   here from QUY_PHONG_GIA / KHUYEN_MAI / CHI_TIET_CHINH_SACH_HUY. Idempotent:
   re-running inserts nothing twice and only extends the rate calendar.
   ===================================================================== */
SET NOCOUNT ON;
SET XACT_ABORT ON;
-- sqlcmd defaults QUOTED_IDENTIFIER to OFF, but 007_indexes.sql creates filtered
-- indexes, and any INSERT into those tables is rejected without these options.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON; -- the GhiChu concatenation relies on NULL + text = NULL
SET DATEFIRST 1; -- Monday = 1 → Friday = 5, Saturday = 6 (weekend rate premium)

BEGIN TRY
BEGIN TRANSACTION;

DECLARE @now DATETIME2 = SYSUTCDATETIME();
DECLARE @today DATE = CAST(@now AS DATE);
DECLARE @hash NVARCHAR(255) = N'${DEMO_PASSWORD_HASH}';

/* ---------------------------------------------------------- roles (same as 001_roles.sql) */
MERGE VAI_TRO AS t
USING (VALUES (N'Khách hàng', N'Người dùng đặt phòng trên nền tảng'),
              (N'Chủ khách sạn', N'Đối tác sở hữu và quản lý khách sạn trên nền tảng'),
              (N'Quản trị hệ thống', N'Quản trị viên vận hành nền tảng')) AS s (TenVaiTro, MoTa)
ON t.TenVaiTro = s.TenVaiTro
WHEN NOT MATCHED THEN INSERT (TenVaiTro, MoTa) VALUES (s.TenVaiTro, s.MoTa);

/* ---------------------------------------------------------- locations & amenities */
INSERT INTO DIA_PHUONG (TenThanhPho, TenTinh, QuocGia)
SELECT s.c, s.p, N'Việt Nam'
FROM (VALUES
${rows(CITIES.map(([c, p]) => [q(c), q(p)]))}
) AS s (c, p)
WHERE NOT EXISTS (SELECT 1 FROM DIA_PHUONG d WHERE d.TenThanhPho = s.c AND d.TenTinh = s.p);

INSERT INTO TIEN_NGHI (TenTienNghi, BieuTuong)
SELECT s.n, s.i
FROM (VALUES
${rows(AMENITIES.map(([name, icon]) => [q(name), q(icon)]))}
) AS s (n, i)
WHERE NOT EXISTS (SELECT 1 FROM TIEN_NGHI t WHERE t.TenTienNghi = s.n);

/* ---------------------------------------------------------- cancellation policy (backend uses the oldest active one) */
IF NOT EXISTS (SELECT 1 FROM CHINH_SACH_HUY WHERE TrangThai = N'Hoạt động')
BEGIN
    INSERT INTO CHINH_SACH_HUY (TenChinhSach, MoTa, TrangThai, NgayTao)
    VALUES (N'Hủy linh hoạt', N'Hủy trước 48 giờ hoàn 100%, trước 24 giờ hoàn 50%, sau đó không hoàn tiền.', N'Hoạt động', @now);
    DECLARE @newPolicy INT = SCOPE_IDENTITY();
    INSERT INTO CHI_TIET_CHINH_SACH_HUY (MaChinhSachHuy, SoGioTruocNhanPhong, TyLeHoanTien)
    VALUES (@newPolicy, 48, 100), (@newPolicy, 24, 50), (@newPolicy, 0, 0);
END;
DECLARE @policy INT = (SELECT TOP 1 MaChinhSachHuy FROM CHINH_SACH_HUY WHERE TrangThai = N'Hoạt động' ORDER BY MaChinhSachHuy);

/* ---------------------------------------------------------- accounts */
CREATE TABLE #acc (u NVARCHAR(100) PRIMARY KEY, name NVARCHAR(150), role NVARCHAR(100), status NVARCHAR(30), born DATE NULL, gender NVARCHAR(20) NULL, phone VARCHAR(20), ageDays INT);
INSERT INTO #acc VALUES
${rows(ACCOUNTS.map((a, i) => [q(a.user), q(a.name), q(a.role), q(a.status ?? 'Hoạt động'), a.born ? `'${a.born}'` : 'NULL', q(a.gender ?? null), `'${phoneOf(i + 1)}'`, n(a.ageDays)]))};

INSERT INTO TAI_KHOAN (MaVaiTro, TenDangNhap, Email, MatKhau, HoTen, SoDienThoai, NgaySinh, GioiTinh, AnhDaiDien, TrangThai, NgayTao, NgayCapNhat)
SELECT r.MaVaiTro, a.u, a.u + N'@example.com', @hash, a.name, a.phone, a.born, a.gender, NULL, a.status,
       DATEADD(DAY, -a.ageDays, @now), DATEADD(DAY, -a.ageDays, @now)
FROM #acc a JOIN VAI_TRO r ON r.TenVaiTro = a.role
WHERE NOT EXISTS (SELECT 1 FROM TAI_KHOAN t WHERE t.TenDangNhap = a.u);

DECLARE @admin INT = (SELECT MaTaiKhoan FROM TAI_KHOAN WHERE TenDangNhap = N'demo_admin');
DECLARE @admin2 INT = (SELECT MaTaiKhoan FROM TAI_KHOAN WHERE TenDangNhap = N'demo_admin2');

/* ---------------------------------------------------------- partner applications (UC03 / UC32) */
INSERT INTO HO_SO_DOI_TAC (MaTaiKhoan, SoCCCD, SoGiayPhepKinhDoanh, MaSoThue, TepGiayTo, TrangThaiDuyet, LyDoTuChoi, NgayNop, NgayDuyet, MaTaiKhoanDuyet)
SELECT t.MaTaiKhoan, s.cccd, s.gp, s.mst, s.tep, s.st, s.reason,
       CASE WHEN s.st = N'Chờ duyệt' THEN DATEADD(DAY, -s.i, @now) ELSE DATEADD(DAY, 1, t.NgayTao) END,
       CASE WHEN s.st = N'Chờ duyệt' THEN NULL ELSE DATEADD(DAY, 3, t.NgayTao) END,
       CASE WHEN s.st = N'Chờ duyệt' THEN NULL ELSE @admin END
FROM (VALUES
${rows(APPLICATIONS.map((a, i) => [q(a.user), `'0${String(79_100_000_000 + i * 1_234_567).slice(0, 11)}'`, `'GP-${String(410_000 + i * 37).padStart(6, '0')}'`, `'${String(3_100_000_000 + i * 97_531).slice(0, 10)}'`, q(`https://example.com/partner-docs/${a.user}.pdf`), q(a.status), q(a.reason), n(i + 1)]))}
) AS s (u, cccd, gp, mst, tep, st, reason, i)
JOIN TAI_KHOAN t ON t.TenDangNhap = s.u
WHERE NOT EXISTS (SELECT 1 FROM HO_SO_DOI_TAC h WHERE h.MaTaiKhoan = t.MaTaiKhoan AND h.SoGiayPhepKinhDoanh = s.gp);

/* ---------------------------------------------------------- hotels */
CREATE TABLE #hotel (k VARCHAR(10) PRIMARY KEY, name NVARCHAR(255), owner NVARCHAR(100), city NVARCHAR(150), province NVARCHAR(150), addr NVARCHAR(500), stars TINYINT, descr NVARCHAR(MAX), ci TIME, co TIME, status NVARCHAR(30), ageDays INT, id INT NULL);
INSERT INTO #hotel (k, name, owner, city, province, addr, stars, descr, ci, co, status, ageDays) VALUES
${rows(HOTELS.map((h) => [q(h.key), q(h.name), q(h.owner), q(h.city), q(h.province), q(h.address), n(h.stars), q(h.desc), `'${h.checkIn ?? '14:00'}'`, `'${h.checkOut ?? '12:00'}'`, q(h.status), n(h.ageDays)]))};

INSERT INTO KHACH_SAN (MaTaiKhoanSoHuu, MaDiaPhuong, MaTaiKhoanDuyet, TenKhachSan, DiaChiChiTiet, HangSao, MoTa, GioNhanPhong, GioTraPhong, TrangThai, NgayDangKy, NgayDuyet, NgayCapNhat)
SELECT o.MaTaiKhoan, d.MaDiaPhuong,
       CASE WHEN h.status = N'Chờ duyệt' THEN NULL ELSE @admin END,
       h.name, h.addr, h.stars, h.descr, h.ci, h.co, h.status,
       DATEADD(DAY, -h.ageDays, @now),
       CASE WHEN h.status = N'Chờ duyệt' THEN NULL ELSE DATEADD(DAY, -h.ageDays + 2, @now) END,
       CASE WHEN h.status = N'Chờ duyệt' THEN DATEADD(DAY, -h.ageDays, @now) ELSE DATEADD(DAY, -h.ageDays + 2, @now) END
FROM #hotel h
JOIN TAI_KHOAN o ON o.TenDangNhap = h.owner
JOIN DIA_PHUONG d ON d.TenThanhPho = h.city AND d.TenTinh = h.province
WHERE NOT EXISTS (SELECT 1 FROM KHACH_SAN k WHERE k.TenKhachSan = h.name);

UPDATE h SET id = k.MaKhachSan FROM #hotel h JOIN KHACH_SAN k ON k.TenKhachSan = h.name;

INSERT INTO HINH_ANH_KHACH_SAN (MaKhachSan, URL, AnhDaiDien)
SELECT h.id, s.url, s.cover
FROM (VALUES
${rows(hotelImages)}
) AS s (k, url, cover)
JOIN #hotel h ON h.k = s.k
WHERE NOT EXISTS (SELECT 1 FROM HINH_ANH_KHACH_SAN i WHERE i.MaKhachSan = h.id AND i.URL = s.url);

INSERT INTO KHACH_SAN_TIEN_NGHI (MaKhachSan, MaTienNghi)
SELECT h.id, t.MaTienNghi
FROM (VALUES
${rows(HOTELS.flatMap((h) => h.amenities.map((a) => [q(h.key), q(a)])))}
) AS s (k, amenity)
JOIN #hotel h ON h.k = s.k
JOIN TIEN_NGHI t ON t.TenTienNghi = s.amenity
WHERE NOT EXISTS (SELECT 1 FROM KHACH_SAN_TIEN_NGHI x WHERE x.MaKhachSan = h.id AND x.MaTienNghi = t.MaTienNghi);

/* ---------------------------------------------------------- room types */
CREATE TABLE #room (k VARCHAR(12) PRIMARY KEY, hk VARCHAR(10), name NVARCHAR(150), beds INT, cap INT, area DECIMAL(6,2), bed NVARCHAR(50), descr NVARCHAR(MAX), status NVARCHAR(30), price DECIMAL(14,2), inv INT, id INT NULL);
INSERT INTO #room (k, hk, name, beds, cap, area, bed, descr, status, price, inv) VALUES
${rows(ROOMS.map((r) => { const t = ROOM_TPL[r.tpl]; return [q(r.key), q(r.hotel.key), q(r.name), n(t.beds), n(t.cap), n(t.area), q(t.bed), q(t.desc), q(r.status), n(r.price), n(r.inv)]; }))};

INSERT INTO LOAI_PHONG (MaKhachSan, TenLoaiPhong, SoGiuong, SucChua, DienTich, LoaiGiuong, MoTa, TrangThai)
SELECT h.id, r.name, r.beds, r.cap, r.area, r.bed, r.descr, r.status
FROM #room r JOIN #hotel h ON h.k = r.hk
WHERE NOT EXISTS (SELECT 1 FROM LOAI_PHONG l WHERE l.MaKhachSan = h.id AND l.TenLoaiPhong = r.name);

UPDATE r SET id = l.MaLoaiPhong FROM #room r JOIN #hotel h ON h.k = r.hk JOIN LOAI_PHONG l ON l.MaKhachSan = h.id AND l.TenLoaiPhong = r.name;

INSERT INTO HINH_ANH_LOAI_PHONG (MaLoaiPhong, URL, LaAnhDaiDien)
SELECT r.id, s.url, s.cover
FROM (VALUES
${rows(roomImages)}
) AS s (k, url, cover)
JOIN #room r ON r.k = s.k
WHERE NOT EXISTS (SELECT 1 FROM HINH_ANH_LOAI_PHONG i WHERE i.MaLoaiPhong = r.id AND i.URL = s.url);

INSERT INTO LOAI_PHONG_TIEN_NGHI (MaLoaiPhong, MaTienNghi)
SELECT r.id, t.MaTienNghi
FROM (VALUES
${rows(ROOMS.flatMap((r) => ROOM_TPL[r.tpl].amen.map((a) => [q(r.key), q(a)])))}
) AS s (k, amenity)
JOIN #room r ON r.k = s.k
JOIN TIEN_NGHI t ON t.TenTienNghi = s.amenity
WHERE NOT EXISTS (SELECT 1 FROM LOAI_PHONG_TIEN_NGHI x WHERE x.MaLoaiPhong = r.id AND x.MaTienNghi = t.MaTienNghi);

/* ---------------------------------------------------------- rate calendar (QUY_PHONG_GIA), day ${RATE_FROM} .. ${RATE_TO - 1}
   Fri/Sat nights +20%, rounded to 10.000đ. One maintenance window is "Đóng bán". */
;WITH days AS (
    SELECT TOP (${RATE_TO - RATE_FROM}) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) + (${RATE_FROM - 1}) AS d
    FROM sys.all_objects a CROSS JOIN sys.all_objects b
)
INSERT INTO QUY_PHONG_GIA (MaLoaiPhong, NgayApDung, GiaPhong, SoLuongPhong, TrangThai)
SELECT r.id, DATEADD(DAY, days.d, @today),
       ROUND(r.price * CASE WHEN DATEPART(WEEKDAY, DATEADD(DAY, days.d, @today)) IN (5, 6) THEN 1.2 ELSE 1 END, -4),
       r.inv,
       CASE WHEN r.k = '${CLOSED.room}' AND days.d BETWEEN ${CLOSED.from} AND ${CLOSED.to} THEN N'Đóng bán' ELSE N'Mở bán' END
FROM #room r CROSS JOIN days
WHERE NOT EXISTS (SELECT 1 FROM QUY_PHONG_GIA x WHERE x.MaLoaiPhong = r.id AND x.NgayApDung = DATEADD(DAY, days.d, @today));

/* ---------------------------------------------------------- promotions (UC15 / UC39 / UC40) */
INSERT INTO KHUYEN_MAI (MaCode, LoaiGiamGia, GiaTriGiam, GiaTriDonToiThieu, MucGiamToiDa, SoLuongGioiHan, NgayBatDau, NgayKetThuc, PhamViApDung, TrangThai)
SELECT s.code, s.kind, s.val, s.minOrder, s.cap, s.lim, DATEADD(DAY, s.fromD, @today), DATEADD(DAY, s.toD, @today), N'Toàn hệ thống', s.st
FROM (VALUES
${rows(PROMOS.map(([code, kind, val, min, cap, lim, from, to, st]) => [`'${code}'`, q(kind), n(val), n(min), n(cap), n(lim), n(from), n(to), q(st)]))}
) AS s (code, kind, val, minOrder, cap, lim, fromD, toD, st)
WHERE NOT EXISTS (SELECT 1 FROM KHUYEN_MAI k WHERE k.MaCode = s.code);

/* ---------------------------------------------------------- bookings
   Totals follow bookings.service.ts: room total = qty × Σ nightly GiaPhong;
   discount per evaluatePromotion (percent capped by MucGiamToiDa when > 0, fixed capped
   at the total, only if total ≥ GiaTriDonToiThieu); payable = total − discount. */
CREATE TABLE #bk (code VARCHAR(20) PRIMARY KEY, cust NVARCHAR(100), rk VARCHAR(12), qty INT, ci INT, nights INT, scenario VARCHAR(20),
                  promo VARCHAR(50) NULL, createdDay INT, createdMin INT, cancelHours INT NULL, note NVARCHAR(MAX) NULL, cancelReason NVARCHAR(500) NULL, refundFails BIT,
                  created DATETIME2 NULL, total DECIMAL(14,2) NULL, discount DECIMAL(14,2) NULL, promoId INT NULL, id INT NULL);
INSERT INTO #bk (code, cust, rk, qty, ci, nights, scenario, promo, createdDay, createdMin, cancelHours, note, cancelReason, refundFails) VALUES
${rows(BOOKINGS.map((b) => [`'${b.code}'`, q(b.customer), q(b.room.key), n(b.qty), n(b.checkIn), n(b.nights), `'${b.scenario}'`, b.promo ? `'${b.promo}'` : 'NULL', n(b.createdDay), n(b.createdMinute), n(b.cancelHoursBefore), q(b.note), q(b.cancelReason), b.refundFails ? '1' : '0']))};

UPDATE b SET created = CASE WHEN b.scenario = 'pending' THEN @now
                            ELSE DATEADD(MINUTE, b.createdMin, CAST(DATEADD(DAY, b.createdDay, @today) AS DATETIME2)) END
FROM #bk b;
-- A cancellation must happen after the booking (and its payment) was created.
UPDATE b SET created = DATEADD(DAY, -2, DATEADD(HOUR, -b.cancelHours, CAST(DATEADD(DAY, b.ci, @today) AS DATETIME2)))
FROM #bk b
WHERE b.scenario = 'cancel_refund' AND b.created > DATEADD(HOUR, -b.cancelHours - 24, CAST(DATEADD(DAY, b.ci, @today) AS DATETIME2));

UPDATE b SET total = CASE WHEN x.c = b.nights THEN b.qty * x.s END
FROM #bk b JOIN #room r ON r.k = b.rk
CROSS APPLY (SELECT SUM(q.GiaPhong) AS s, COUNT(*) AS c FROM QUY_PHONG_GIA q
             WHERE q.MaLoaiPhong = r.id AND q.NgayApDung >= DATEADD(DAY, b.ci, @today) AND q.NgayApDung < DATEADD(DAY, b.ci + b.nights, @today)) x;

-- Same validity rules as evaluatePromotion(), judged on the day the booking was made.
UPDATE b SET promoId = k.MaKhuyenMai,
             discount = CASE WHEN k.LoaiGiamGia = N'Phần trăm'
                             THEN CASE WHEN k.MucGiamToiDa > 0 AND ROUND(b.total * k.GiaTriGiam / 100, 0) > k.MucGiamToiDa THEN k.MucGiamToiDa
                                       ELSE ROUND(b.total * k.GiaTriGiam / 100, 0) END
                             ELSE CASE WHEN k.GiaTriGiam > b.total THEN b.total ELSE k.GiaTriGiam END END
FROM #bk b JOIN KHUYEN_MAI k ON k.MaCode = b.promo
WHERE b.total >= k.GiaTriDonToiThieu
  AND k.TrangThai = N'Hoạt động'
  AND CAST(b.created AS DATE) BETWEEN k.NgayBatDau AND k.NgayKetThuc;
UPDATE #bk SET discount = 0 WHERE discount IS NULL;

IF EXISTS (SELECT 1 FROM #bk WHERE total IS NULL OR total <= 0)
    THROW 50001, 'Demo booking outside the generated rate calendar', 1;

INSERT INTO DAT_PHONG (MaXacNhanDatPhong, MaTaiKhoanKhachHang, MaKhachSan, MaKhuyenMai, MaChinhSachHuy, NgayNhanPhong, NgayTraPhong,
                       TongTienPhong, SoTienGiam, TongTienThanhToan, GhiChu, TrangThai, NgayTao, NgayCapNhat)
SELECT b.code, c.MaTaiKhoan, h.id, b.promoId, @policy,
       DATEADD(DAY, b.ci, @today), DATEADD(DAY, b.ci + b.nights, @today),
       b.total, b.discount, b.total - b.discount,
       CASE b.scenario
            WHEN 'cancel_refund' THEN CONCAT(b.note + N' | ', N'Khách hủy đặt phòng', N': ' + b.cancelReason)
            WHEN 'cancel_unpaid' THEN CONCAT(b.note + N' | ', N'Khách hủy đặt phòng', N': ' + b.cancelReason)
            WHEN 'expired' THEN CONCAT(b.note + N' | ', N'Tự động hủy do quá hạn thanh toán')
            WHEN 'expired_failed' THEN CONCAT(b.note + N' | ', N'Tự động hủy do quá hạn thanh toán')
            ELSE b.note END,
       CASE b.scenario WHEN 'completed' THEN N'Hoàn tất' WHEN 'current' THEN N'Đã xác nhận' WHEN 'future' THEN N'Đã xác nhận'
                       WHEN 'pending' THEN N'Chờ thanh toán' ELSE N'Đã hủy' END,
       b.created,
       CASE b.scenario
            WHEN 'completed' THEN CAST(DATEADD(DAY, b.ci + b.nights, @today) AS DATETIME2)
            WHEN 'cancel_refund' THEN DATEADD(HOUR, -b.cancelHours, CAST(DATEADD(DAY, b.ci, @today) AS DATETIME2))
            WHEN 'cancel_unpaid' THEN DATEADD(HOUR, 3, b.created)
            WHEN 'expired' THEN DATEADD(MINUTE, 16, b.created)
            WHEN 'expired_failed' THEN DATEADD(MINUTE, 16, b.created)
            WHEN 'pending' THEN b.created
            ELSE DATEADD(MINUTE, 8, b.created) END
FROM #bk b
JOIN TAI_KHOAN c ON c.TenDangNhap = b.cust
JOIN #room r ON r.k = b.rk
JOIN #hotel h ON h.k = r.hk
WHERE NOT EXISTS (SELECT 1 FROM DAT_PHONG d WHERE d.MaXacNhanDatPhong = b.code);

UPDATE b SET id = d.MaDatPhong FROM #bk b JOIN DAT_PHONG d ON d.MaXacNhanDatPhong = b.code;

INSERT INTO CHI_TIET_DAT_PHONG (MaDatPhong, MaLoaiPhong, SoLuongPhong)
SELECT b.id, r.id, b.qty
FROM #bk b JOIN #room r ON r.k = b.rk
WHERE NOT EXISTS (SELECT 1 FROM CHI_TIET_DAT_PHONG x WHERE x.MaDatPhong = b.id);

/* ---------------------------------------------------------- payments (VNPAY, same reference format as vnpay.ts) */
-- A failed first attempt before the successful one on some bookings, and on the expired one.
INSERT INTO THANH_TOAN (MaDatPhong, SoTien, PhuongThucThanhToan, MaGiaoDichDoiTac, TrangThai, ThoiGianGiaoDich)
SELECT b.id, b.total - b.discount, N'VNPAY', CONCAT('PAYDEMOF', REPLACE(b.code, '-', '')), N'Thất bại', DATEADD(MINUTE, 2, b.created)
FROM #bk b
WHERE (b.scenario = 'expired_failed' OR (b.scenario IN ('completed', 'future') AND b.id % 9 = 0))
  AND NOT EXISTS (SELECT 1 FROM THANH_TOAN t WHERE t.MaDatPhong = b.id AND t.TrangThai = N'Thất bại');

INSERT INTO THANH_TOAN (MaDatPhong, SoTien, PhuongThucThanhToan, MaGiaoDichDoiTac, TrangThai, ThoiGianGiaoDich)
SELECT b.id, b.total - b.discount, N'VNPAY',
       CONCAT('PAYDEMO', REPLACE(b.code, '-', ''), ':', 14000000 + b.id, ':', FORMAT(DATEADD(HOUR, 7, DATEADD(MINUTE, 6, b.created)), 'yyyyMMddHHmmss')),
       N'Thành công', DATEADD(MINUTE, 6, b.created)
FROM #bk b
WHERE b.scenario IN ('completed', 'current', 'future', 'cancel_refund')
  AND NOT EXISTS (SELECT 1 FROM THANH_TOAN t WHERE t.MaDatPhong = b.id AND t.TrangThai = N'Thành công');

/* ---------------------------------------------------------- refunds (tier = best CHI_TIET_CHINH_SACH_HUY row for the hours left) */
INSERT INTO HOAN_TIEN (MaThanhToan, SoTienHoan, LyDoHoanTien, MaGiaoDichDoiTac, TrangThai, NgayYeuCau, NgayHoanTien)
SELECT t.MaThanhToan,
       ROUND(t.SoTien * tier.TyLeHoanTien / 100, 0),
       CONCAT(N'Hủy đặt phòng — hoàn ', CAST(CAST(tier.TyLeHoanTien AS INT) AS NVARCHAR(3)), N'% theo chính sách hủy (', b.cancelHours, N'.0h trước nhận phòng)'),
       CONCAT('RFDEMO', REPLACE(b.code, '-', '')),
       CASE WHEN b.refundFails = 1 THEN N'Thất bại' ELSE N'Thành công' END,
       DATEADD(HOUR, -b.cancelHours, CAST(DATEADD(DAY, b.ci, @today) AS DATETIME2)),
       CASE WHEN b.refundFails = 1 THEN NULL ELSE DATEADD(MINUTE, 1, DATEADD(HOUR, -b.cancelHours, CAST(DATEADD(DAY, b.ci, @today) AS DATETIME2))) END
FROM #bk b
JOIN THANH_TOAN t ON t.MaDatPhong = b.id AND t.TrangThai = N'Thành công'
CROSS APPLY (SELECT TOP 1 c.TyLeHoanTien FROM CHI_TIET_CHINH_SACH_HUY c
             WHERE c.MaChinhSachHuy = @policy AND c.SoGioTruocNhanPhong <= b.cancelHours
             ORDER BY c.SoGioTruocNhanPhong DESC) tier
WHERE b.scenario = 'cancel_refund'
  AND ROUND(t.SoTien * tier.TyLeHoanTien / 100, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM HOAN_TIEN x WHERE x.MaThanhToan = t.MaThanhToan);

/* ---------------------------------------------------------- reviews (only on "Hoàn tất" stays, one per booking) */
INSERT INTO DANH_GIA (MaDatPhong, MaKhachHang, MaKhachSan, DiemDanhGia, NoiDung, TrangThai)
SELECT d.MaDatPhong, d.MaTaiKhoanKhachHang, d.MaKhachSan, s.score, s.txt, s.st
FROM (VALUES
${rows(REVIEWS.map((r) => [`'${r.booking.code}'`, n(r.score), q(r.text), q(r.status)]))}
) AS s (code, score, txt, st)
JOIN DAT_PHONG d ON d.MaXacNhanDatPhong = s.code AND d.TrangThai = N'Hoàn tất'
WHERE NOT EXISTS (SELECT 1 FROM DANH_GIA x WHERE x.MaDatPhong = d.MaDatPhong);

INSERT INTO HINH_ANH_DANH_GIA (MaDanhGia, URL)
SELECT g.MaDanhGia, s.url
FROM (VALUES
${rows(REVIEWS.flatMap((r) => r.images.map((url) => [`'${r.booking.code}'`, q(url)])))}
) AS s (code, url)
JOIN DAT_PHONG d ON d.MaXacNhanDatPhong = s.code
JOIN DANH_GIA g ON g.MaDatPhong = d.MaDatPhong
WHERE NOT EXISTS (SELECT 1 FROM HINH_ANH_DANH_GIA x WHERE x.MaDanhGia = g.MaDanhGia AND x.URL = s.url);

/* ---------------------------------------------------------- support requests (UC16 / UC38) */
INSERT INTO YEU_CAU_HO_TRO (MaTaiKhoanKhachHang, MaTaiKhoanXuLy, MaDatPhong, LoaiYeuCau, TieuDe, NoiDung, KetQuaXuLy, TrangThai, NgayTao, NgayXuLy)
SELECT c.MaTaiKhoan,
       CASE WHEN s.st = N'Mới' THEN NULL WHEN s.i % 2 = 0 THEN @admin ELSE @admin2 END,
       d.MaDatPhong, s.kind, s.title, s.body,
       CASE WHEN s.st = N'Đã xử lý' THEN s.result END,
       s.st,
       DATEADD(HOUR, 9 + s.i, CAST(DATEADD(DAY, s.dayOff, @today) AS DATETIME2)),
       CASE WHEN s.st = N'Đã xử lý' THEN DATEADD(HOUR, 30 + s.i, CAST(DATEADD(DAY, s.dayOff, @today) AS DATETIME2)) END
FROM (VALUES
${rows(SUPPORT.map(([user, kind, title, body, st, withBooking, day], i) => [q(user), q(kind), q(title), q(body), q(st), withBooking && bookingOf(user) ? `'${bookingOf(user)!.code}'` : 'NULL', q(RESOLUTIONS[title] ?? 'Đã hỗ trợ quý khách qua điện thoại và cập nhật thông tin theo yêu cầu.'), n(day), n(i)]))}
) AS s (u, kind, title, body, st, code, result, dayOff, i)
JOIN TAI_KHOAN c ON c.TenDangNhap = s.u
LEFT JOIN DAT_PHONG d ON d.MaXacNhanDatPhong = s.code AND d.MaTaiKhoanKhachHang = c.MaTaiKhoan
WHERE NOT EXISTS (SELECT 1 FROM YEU_CAU_HO_TRO y WHERE y.MaTaiKhoanKhachHang = c.MaTaiKhoan AND y.TieuDe = s.title);

/* ---------------------------------------------------------- replace placeholder (picsum.photos) images from the older discovery seed */
;WITH legacy AS (SELECT MaHinhAnh, ROW_NUMBER() OVER (ORDER BY MaHinhAnh) AS rn FROM HINH_ANH_KHACH_SAN WHERE URL LIKE N'https://picsum.photos/%'),
      pics AS (SELECT url, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn FROM (VALUES ${legacyHotelImages.map((u) => `(${u})`).join(', ')}) v (url))
UPDATE i SET URL = p.url
FROM HINH_ANH_KHACH_SAN i JOIN legacy l ON l.MaHinhAnh = i.MaHinhAnh JOIN pics p ON p.rn = ((l.rn - 1) % ${legacyHotelImages.length}) + 1;

;WITH legacy AS (SELECT MaHinhAnhLoaiPhong, ROW_NUMBER() OVER (ORDER BY MaHinhAnhLoaiPhong) AS rn FROM HINH_ANH_LOAI_PHONG WHERE URL LIKE N'https://picsum.photos/%'),
      pics AS (SELECT url, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn FROM (VALUES ${legacyRoomImages.map((u) => `(${u})`).join(', ')}) v (url))
UPDATE i SET URL = p.url
FROM HINH_ANH_LOAI_PHONG i JOIN legacy l ON l.MaHinhAnhLoaiPhong = i.MaHinhAnhLoaiPhong JOIN pics p ON p.rn = ((l.rn - 1) % ${legacyRoomImages.length}) + 1;

COMMIT TRANSACTION;

SELECT N'demo seed OK' AS status,
       (SELECT COUNT(*) FROM TAI_KHOAN WHERE TenDangNhap LIKE N'demo[_]%') AS demo_accounts,
       (SELECT COUNT(*) FROM #hotel) AS demo_hotels,
       (SELECT COUNT(*) FROM #room) AS demo_room_types,
       (SELECT COUNT(*) FROM DAT_PHONG WHERE MaXacNhanDatPhong LIKE 'DEMO-%') AS demo_bookings;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
`;

writeFileSync(OUT, sql, 'utf8');
const scen = BOOKINGS.reduce<Record<string, number>>((m, b) => ({ ...m, [b.scenario]: (m[b.scenario] ?? 0) + 1 }), {});
console.log(`[demo-sql] wrote ${path.relative(process.cwd(), OUT)}`);
console.log(`  accounts ${ACCOUNTS.length}, hotels ${HOTELS.length}, room types ${ROOMS.length}, bookings ${BOOKINGS.length}`, scen);
console.log(`  reviews ${REVIEWS.length} (${REVIEWS.filter((r) => r.images.length).length} with photos), support ${SUPPORT.length}, promos ${PROMOS.length}`);
