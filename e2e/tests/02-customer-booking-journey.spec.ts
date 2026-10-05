import { test, expect, fx, newAccount, ROLES, login, todayVN, addDays, money, type Account } from '../support/fixtures';
import { simulateGateway } from '../support/payment';

/**
 * The main customer journey, end to end through the real UI:
 * search -> filter -> hotel -> guest count -> rooms -> quote -> promo -> booking -> payment -> result -> history -> cancel+refund.
 */
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
  checkOut = addDays(today, 12); // 2 nights
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
  const gateway = await simulateGateway(page, 'success');

  // ---- search from the home page (destination, dates, guests) through the real search box
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
  await page.getByRole('button', { name: 'Tăng khách' }).click(); // 2 -> 3 guests
  await page.getByRole('button', { name: 'Xong' }).click();
  await search.getByRole('button', { name: /Tìm kiếm/ }).click();

  // ---- results: both hotels; the guest count travelled with the search
  await expect(page).toHaveURL(/\/hotels\?/);
  expect(new URL(page.url()).searchParams.get('guests')).toBe('3');
  expect(new URL(page.url()).searchParams.get('location')).toBe(city.name);
  await expect(page.getByRole('link', { name: star4.name }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: star3.name }).first()).toBeVisible();

  // ---- filter "Từ 4 sao trở lên": the 3-star hotel disappears, the 4-star stays
  await page.getByRole('button', { name: 'Từ 4 sao trở lên' }).click();
  await expect(page.getByRole('link', { name: star3.name })).toHaveCount(0);
  await expect(page.getByRole('link', { name: star4.name }).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get('starRating')).toBe('4');

  // ---- hotel detail keeps the stay and the party size
  await page.getByRole('link', { name: star4.name }).first().click();
  await expect(page).toHaveURL(new RegExp(`/hotels/${star4.id}`));
  expect(new URL(page.url()).searchParams.get('guests')).toBe('3');
  await expect(page.getByRole('heading', { name: star4.name }).first()).toBeVisible();

  // ---- 3 guests do not fit one room for 2: capacity is explained and booking is blocked
  const addRoom = page.getByRole('button', { name: `Tăng phòng ${roomTypeName}` });
  await addRoom.click();
  const panel = page.locator('#dat-phong');
  await expect(panel).toContainText('chỉ chứa tối đa 2 khách');
  await expect(panel).toContainText('3 khách');
  await expect(panel.getByRole('button', { name: /Tạo đặt phòng/ })).toHaveCount(0); // no price, no way to book

  // ---- a second room: capacity 4 >= 3 guests, the quote is for 2 rooms x 2 nights
  await addRoom.click();
  await expect(panel).toContainText(money(PRICE * 2 * 2));
  await expect(panel.getByRole('button', { name: /Tạo đặt phòng/ })).toBeEnabled();

  // ---- a typed promo code is NOT applied by changing the quantity (#15); only "Áp dụng" applies it
  await panel.getByPlaceholder('Nhập mã (nếu có)').fill(promo.code);
  await page.getByRole('button', { name: `Giảm phòng ${roomTypeName}` }).click();
  await addRoom.click();
  await expect(panel).not.toContainText('Khuyến mãi giảm');
  await expect(panel.getByRole('button', { name: /Tạo đặt phòng/ })).toBeDisabled(); // typed but not applied
  await panel.getByRole('button', { name: 'Áp dụng' }).click();
  const total = PRICE * 2 * 2;
  const discount = total / 10;
  await expect(panel).toContainText('Khuyến mãi giảm');
  await expect(panel).toContainText(money(total - discount));

  // ---- create the booking, then pay at the (simulated) gateway
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
  await expect(page).toHaveURL(/\/payment\/result\?.*status=success/);
  await expect(page.getByText(/thành công/i).first()).toBeVisible();
  expect(gateway).toHaveLength(1);
  expect(gateway[0].amountVnd).toBe(total - discount);

  row = await fx('/db/booking', { id: bookingId });
  expect(row.TrangThai).toBe('Đã xác nhận');
  expect(row.THANH_TOAN).toHaveLength(1);
  expect(row.THANH_TOAN[0]).toMatchObject({ TrangThai: 'Thành công' });
  expect(Number(row.THANH_TOAN[0].SoTien)).toBe(total - discount);

  // ---- booking history lists it with the right state and total
  await page.goto('/bookings');
  await expect(page.getByText(star4.name).first()).toBeVisible();
  await expect(page.getByText('Đã xác nhận').first()).toBeVisible();

  // ---- cancel: refund per the booking's cancellation policy, through the (stand-in) gateway
  await page.goto(`/bookings/${bookingId}`);
  await page.getByRole('button', { name: 'Hủy đặt phòng này' }).click();
  await expect(page.getByText('Xác nhận hủy đặt phòng?')).toBeVisible();
  const previewText = (await page.getByText(/Dự kiến hoàn/).first().locator('xpath=..').innerText()).replace(/\s+/g, ' ');
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
  await expect(page.getByText('Đã hủy').first()).toBeVisible();

  row = await fx('/db/booking', { id: bookingId });
  expect(row.TrangThai).toBe('Đã hủy');
  const paid = Number(row.THANH_TOAN[0].SoTien);
  const refunds = row.THANH_TOAN[0].HOAN_TIEN as Array<{ SoTienHoan: string; TrangThai: string; NgayHoanTien: string | null; NgayYeuCau: string }>;
  if (refunds.length === 0) {
    // a 0 % tier: nothing is refunded and no gateway call is made
    expect(await fx('/gateway/calls')).toMatchObject({ calls: [] });
  } else {
    expect(refunds).toHaveLength(1);
    expect(refunds[0].TrangThai).toBe('Thành công');
    expect(refunds[0].NgayHoanTien).not.toBeNull();
    expect(Number(refunds[0].SoTienHoan)).toBeLessThanOrEqual(paid);
    // what the customer was told before confirming is what the server refunded
    expect(previewText).toContain(money(Number(refunds[0].SoTienHoan)));
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
