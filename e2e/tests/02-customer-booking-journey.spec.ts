import { test, expect, fx, newAccount, ROLES, login, todayVN, addDays, money, type Account } from '../support/fixtures';

/** Hành trình đặt phòng của khách từ tìm kiếm đến hủy và hoàn tiền */
const PRICE = 500_000;
let owner: Account;
let customer: Account;
let city: { id: number; name: string };
let star4: { id: number; name: string };
let star3: { id: number; name: string };
let roomTypeName = '';
let promo: { id: number; code: string };
let checkIn = '';
let checkOut = '';

test.beforeAll(async () => {
  const today = await todayVN();
  checkIn = addDays(today, 10);
  checkOut = addDays(today, 12);
  owner = await newAccount(ROLES.partner);
  customer = await newAccount(ROLES.customer);
  const four = await fx('/hotel', { ownerId: owner.id, stars: 4, name: 'E2E Hotel Bốn Sao' });
  city = { id: four.cityId, name: four.cityName };
  star4 = { id: four.id, name: four.name };
  const three = await fx('/hotel', { ownerId: owner.id, stars: 3, cityId: city.id, name: 'E2E Hotel Ba Sao' });
  star3 = { id: three.id, name: three.name };
  roomTypeName = 'Phòng Đôi E2E';
  await fx('/room-type', { hotelId: star4.id, name: roomTypeName, capacity: 2, price: PRICE, rooms: 3, fromOffset: 5, days: 20 });
  await fx('/room-type', { hotelId: star3.id, name: 'Phòng Ba Sao', capacity: 2, price: PRICE, rooms: 3, fromOffset: 5, days: 20 });
  promo = await fx('/promotion', { type: 'Phần trăm', value: 10, startKey: addDays(today, -1), endKey: addDays(today, 60) });
});

test.afterAll(async () => {
  await fx('/cleanup');
});

const pickDay = async (page: import('@playwright/test').Page, key: string) => {
  await page.locator(`td[data-day="${key}"] button`).first().click();
};

test('search -> filter -> hotel -> guests -> rooms -> promo -> booking -> payment -> result -> history -> cancel and refund', async ({ page }) => {
  await login(page, customer);

  // Tìm kiếm từ trang chủ
  await page.goto('/');
  const search = page.locator('form.travel-search').first();
  await search.getByRole('button', { name: /Điểm đến/ }).click();
  await page.getByRole('combobox', { name: 'Điểm đến' }).fill(city.name);
  await page.getByRole('option', { name: city.name }).click();
  await search.getByRole('button', { name: /Ngày lưu trú|Nhận & trả phòng/ }).click();
  await pickDay(page, checkIn);
  await pickDay(page, checkOut);
  await page.getByRole('button', { name: 'Xong' }).click();
  await search.getByRole('button', { name: /Số khách/ }).click();
  await page.getByRole('button', { name: 'Tăng khách' }).click();
  await page.getByRole('button', { name: 'Xong' }).click();
  await search.getByRole('button', { name: /Tìm kiếm/ }).click();

  // Kết quả có cả hai khách sạn và số khách đi kèm
  await expect(page).toHaveURL(/\/hotels\?/);
  expect(new URL(page.url()).searchParams.get('guests')).toBe('3');
  expect(new URL(page.url()).searchParams.get('location')).toBe(city.name);
  await expect(page.getByRole('link', { name: star4.name }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: star3.name }).first()).toBeVisible();

  // Lọc từ 4 sao trở lên, khách sạn 3 sao biến mất
  await page.getByRole('button', { name: 'Từ 4 sao trở lên' }).click();
  await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect(page.getByRole('link', { name: star3.name })).toHaveCount(0);
  await expect(page.getByRole('link', { name: star4.name }).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get('starRating')).toBe('4');

  // Trang chi tiết giữ ngày ở và số khách
  await page.getByRole('link', { name: star4.name }).first().click();
  await expect(page).toHaveURL(new RegExp(`/hotels/${star4.id}`));
  expect(new URL(page.url()).searchParams.get('guests')).toBe('3');
  await expect(page.getByRole('heading', { name: star4.name }).first()).toBeVisible();

  // 3 khách không vừa một phòng 2 người nên bị chặn đặt
  const addRoom = page.getByRole('button', { name: `Tăng phòng ${roomTypeName}` });
  await addRoom.click();
  const panel = page.locator('#dat-phong');
  await expect(panel).toContainText('chỉ chứa tối đa 2 khách');
  await expect(panel).toContainText('3 khách');
  await expect(panel.getByRole('button', { name: /Tạo đặt phòng/ })).toHaveCount(0);

  // Thêm phòng thứ hai để đủ sức chứa
  await addRoom.click();
  await expect(panel).toContainText(money(PRICE * 2 * 2));
  await expect(panel.getByRole('button', { name: /Tạo đặt phòng/ })).toBeEnabled();

  // Mã khuyến mãi chỉ áp dụng khi bấm Áp dụng
  await panel.getByPlaceholder('Nhập hoặc chọn mã').fill(promo.code);
  await page.getByRole('button', { name: `Giảm phòng ${roomTypeName}` }).click();
  await addRoom.click();
  await expect(panel).not.toContainText('Khuyến mãi giảm');
  await expect(panel.getByRole('button', { name: /Tạo đặt phòng/ })).toBeDisabled();
  await panel.getByRole('button', { name: 'Áp dụng' }).click();
  const total = PRICE * 2 * 2;
  const discount = total / 10;
  await expect(panel).toContainText('Khuyến mãi giảm');
  await expect(panel).toContainText(money(total - discount));

  // Tạo đơn rồi thanh toán giả lập
  await panel.getByRole('button', { name: /Tạo đặt phòng/ }).click();
  await expect(page).toHaveURL(/\/bookings\/\d+/);
  const bookingId = Number(new URL(page.url()).pathname.split('/').pop());
  let row = await fx('/db/booking', { id: bookingId });
  expect(row.TrangThai).toBe('Chờ thanh toán');
  expect(Number(row.TongTienPhong)).toBe(total);
  expect(Number(row.SoTienGiam)).toBe(discount);
  expect(Number(row.TongTienThanhToan)).toBe(total - discount);
  expect(row.CHI_TIET_DAT_PHONG.reduce((n: number, l: { SoLuongPhong: number }) => n + l.SoLuongPhong, 0)).toBe(2);
  expect(row.THANH_TOAN).toHaveLength(0);

  await page.getByRole('button', { name: 'Thanh toán ngay' }).click();
  const payDialog = page.getByRole('dialog');
  await expect(payDialog).toContainText('Đang xử lý thanh toán');
  await expect(payDialog.getByRole('button', { name: 'Xem kết quả' })).toHaveCount(0);
  await expect(payDialog).toContainText('Thanh toán thành công!');
  await expect(payDialog).toContainText(money(total - discount));
  await expect(page).toHaveURL(/\/payment\/result\?.*status=success/);
  await expect(page.getByText(/thành công/i).first()).toBeVisible();

  row = await fx('/db/booking', { id: bookingId });
  expect(row.TrangThai).toBe('Đã xác nhận');
  expect(row.THANH_TOAN).toHaveLength(1);
  expect(row.THANH_TOAN[0]).toMatchObject({ TrangThai: 'Thành công' });
  expect(Number(row.THANH_TOAN[0].SoTien)).toBe(total - discount);
  expect(row.THANH_TOAN[0].PhuongThucThanhToan).toBe('VNPAY (mô phỏng)');
  expect(row.THANH_TOAN[0].MaGiaoDichDoiTac).toMatch(/^[^:]+:\d+:\d{14}$/);

  // Lịch sử đặt phòng hiện đúng trạng thái và tổng tiền
  await page.goto('/bookings');
  await expect(page.getByText(star4.name).first()).toBeVisible();
  await expect(page.getByText('Đã xác nhận').first()).toBeVisible();

  // Hủy đơn và hoàn tiền theo chính sách hủy
  await page.goto(`/bookings/${bookingId}`);
  await page.getByRole('button', { name: 'Hủy đặt phòng này' }).click();
  await expect(page.getByText('Xác nhận hủy đặt phòng?')).toBeVisible();
  const previewText = (await page.getByText(/Dự kiến hoàn/).first().locator('xpath=..').innerText()).replace(/\s+/g, ' ');
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
  const refundDialog = page.getByRole('dialog');
  await expect(refundDialog).toContainText('Đang xử lý hủy đặt phòng và hoàn tiền');
  await expect(refundDialog).toContainText(/Hủy đặt phòng thành công|Đã hủy, hoàn tiền chưa hoàn tất/);
  const resultText = (await refundDialog.innerText()).replace(/\s+/g, ' ');
  await refundDialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(page.getByText('Đã hủy').first()).toBeVisible();

  row = await fx('/db/booking', { id: bookingId });
  expect(row.TrangThai).toBe('Đã hủy');
  const paid = Number(row.THANH_TOAN[0].SoTien);
  const refunds = row.THANH_TOAN[0].HOAN_TIEN as Array<{ SoTienHoan: string; TrangThai: string; NgayHoanTien: string | null; NgayYeuCau: string }>;
  if (refunds.length === 0) {
    // Mức 0% thì không hoàn tiền và hộp thoại báo rõ
    expect(resultText).toContain('không được hoàn tiền');
  } else {
    expect(refunds).toHaveLength(1);
    expect(refunds[0].TrangThai).toBe('Thành công');
    expect(refunds[0].NgayHoanTien).not.toBeNull();
    expect(Number(refunds[0].SoTienHoan)).toBeLessThanOrEqual(paid);
    // Số tiền khách được báo trước bằng số tiền máy chủ hoàn
    expect(previewText).toContain(money(Number(refunds[0].SoTienHoan)));
    // Thông báo cuối nêu số tiền hoàn và phương thức thanh toán gốc
    expect(resultText).toContain(money(Number(refunds[0].SoTienHoan)));
    expect(resultText).toContain('đã được hoàn về phương thức thanh toán ban đầu (VNPAY (mô phỏng))');
    expect(new Date(refunds[0].NgayHoanTien!).getTime()).toBeGreaterThanOrEqual(new Date(refunds[0].NgayYeuCau).getTime());
  }
});

test('a guest can search and look at rooms and prices, but is asked to sign in before booking', async ({ page }) => {
  await page.goto(`/hotels/${star4.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`);
  await expect(page.getByRole('heading', { name: star4.name }).first()).toBeVisible();
  await page.getByRole('button', { name: `Tăng phòng ${roomTypeName}` }).click();
  const panel = page.locator('#dat-phong');
  await expect(panel).toContainText(money(PRICE * 2));
  await expect(panel.getByRole('button', { name: /Tạo đặt phòng/ })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Đăng nhập để đặt phòng' }).click();
  await expect(page).toHaveURL(/\/login/);
});
