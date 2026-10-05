import { test, expect, fx, newAccount, ROLES, login, todayVN, addDays, type Account } from '../support/fixtures';

/**
 * Business time is Asia/Ho_Chi_Minh, whatever the visitor's browser clock says. The same assertions run in two browser
 * time zones, one far behind Vietnam and one far ahead, so that at ANY hour of the day at least one of them has a local
 * calendar date different from the Vietnamese date — a UI that used the browser's date would fail one of them.
 */
const API = 'http://localhost:5100/api';
let owner: Account;
let hotel: { id: number; name: string };
let roomTypeId = 0;
let roomTypeName = '';
let today = '';

test.beforeAll(async () => {
  today = await todayVN();
  owner = await newAccount(ROLES.partner);
  const h = await fx('/hotel', { ownerId: owner.id, stars: 4, name: 'E2E Hotel Múi Giờ' });
  hotel = { id: h.id, name: h.name };
  roomTypeName = 'Phòng Múi Giờ E2E';
  const rt = await fx('/room-type', { hotelId: hotel.id, name: roomTypeName, capacity: 2, price: 300_000, rooms: 5, fromOffset: 0, days: 20 });
  roomTypeId = rt.id;
});

test.afterAll(async () => {
  await fx('/cleanup');
});

for (const timezoneId of ['Pacific/Honolulu', 'Pacific/Kiritimati']) {
  test.describe(`browser time zone ${timezoneId}`, () => {
    test.use({ timezoneId });

    test('the calendar starts at the Vietnamese today, and a stay that begins today books fine', async ({ page, playwright }) => {
      const customer = await newAccount(ROLES.customer);
      await login(page, customer);
      await page.goto(`/hotels/${hotel.id}?checkIn=${addDays(today, 3)}&checkOut=${addDays(today, 4)}&guests=2`);

      // open the stay's date editor: yesterday (VN) is disabled, today (VN) is selectable
      await page.locator('form.travel-search').first().getByRole('button', { name: /Nhận & trả phòng/ }).click();
      await expect(page.locator(`td[data-day="${today}"] button`).first()).toBeEnabled();
      await expect(page.locator(`td[data-day="${addDays(today, -1)}"] button`).first()).toBeDisabled();

      // the backend agrees: check-in today is accepted, check-in yesterday is refused, no row is created for it
      const api = await playwright.request.newContext();
      const token = (await (await api.post(`${API}/auth/login`, { data: { identifier: customer.email, MatKhau: customer.password } })).json()).data.accessToken;
      const headers = { Authorization: `Bearer ${token}` };
      const rooms = [{ maLoaiPhong: roomTypeId, soLuong: 1 }];
      const yesterday = await api.post(`${API}/hotels/${hotel.id}/bookings`, { headers, data: { checkIn: addDays(today, -1), checkOut: today, guests: 2, rooms } });
      expect(yesterday.status()).toBe(400);
      const todays = await api.post(`${API}/hotels/${hotel.id}/bookings`, { headers, data: { checkIn: today, checkOut: addDays(today, 1), guests: 2, rooms } });
      expect(todays.status()).toBe(201);
      const created = (await todays.json()).data;
      const row = await fx('/db/booking', { id: created.MaDatPhong });
      expect(row.NgayNhanPhong.slice(0, 10)).toBe(today);
      expect(row.NgayTraPhong.slice(0, 10)).toBe(addDays(today, 1));
    });

    test('check-in / check-out time of the hotel show as 14:00 / 12:00 on the booking page and the cancellation preview follows the check-in INSTANT', async ({ page }) => {
      const customer = await newAccount(ROLES.customer);
      const stayDay = addDays(today, 6);
      const paid = await fx('/paid-booking-for', { customerId: customer.id, hotelId: hotel.id, roomTypeId, checkIn: stayDay });
      await login(page, customer);
      await page.goto(`/bookings/${paid.id}`);

      await expect(page.getByText(/14:00/).first()).toBeVisible();
      await expect(page.getByText(/12:00/).first()).toBeVisible();

      // the server's own check-in instant is stayDay 14:00 Vietnam time = 07:00 UTC, in every browser time zone
      const detail = await (await page.request.post(`${API}/auth/refresh`, { headers: { Origin: 'http://localhost:5174' } })).json();
      const booking = await (await page.request.get(`${API}/bookings/${paid.id}`, { headers: { Authorization: `Bearer ${detail.data.accessToken}` } })).json();
      expect(booking.data.ThoiDiemNhanPhong).toBe(`${stayDay}T07:00:00.000Z`);
      expect(booking.data.ThoiDiemTraPhong).toBe(`${addDays(stayDay, 1)}T05:00:00.000Z`);
    });
  });
}

test.describe('promotion boundaries are Vietnamese calendar days (inclusive)', () => {
  test('a promotion that starts today and ends today works now; one that ended yesterday or starts tomorrow does not', async ({ page }) => {
    const customer = await newAccount(ROLES.customer);
    const onlyToday = await fx('/promotion', { type: 'Phần trăm', value: 10, startKey: today, endKey: today });
    const ended = await fx('/promotion', { type: 'Phần trăm', value: 10, startKey: addDays(today, -10), endKey: addDays(today, -1) });
    const notYet = await fx('/promotion', { type: 'Phần trăm', value: 10, startKey: addDays(today, 1), endKey: addDays(today, 30) });
    await login(page, customer);
    await page.goto(`/hotels/${hotel.id}?checkIn=${addDays(today, 8)}&checkOut=${addDays(today, 9)}&guests=2`);
    await page.getByRole('button', { name: `Tăng phòng ${roomTypeName}` }).click();
    const panel = page.locator('#dat-phong');
    const apply = async (code: string) => {
      await panel.getByPlaceholder('Nhập mã (nếu có)').fill(code);
      await panel.getByRole('button', { name: 'Áp dụng' }).click();
    };

    await apply(onlyToday.code);
    await expect(panel).toContainText('Khuyến mãi giảm');
    await expect(panel.getByRole('button', { name: /Tạo đặt phòng/ })).toBeEnabled();

    await apply(ended.code);
    await expect(panel.getByRole('alert')).toContainText(ended.code); // removed again, with the reason
    await expect(panel).not.toContainText('Khuyến mãi giảm');

    await apply(notYet.code);
    await expect(panel.getByRole('alert')).toContainText(notYet.code);
    await expect(panel).not.toContainText('Khuyến mãi giảm');
  });
});
