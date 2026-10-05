import { test, expect, fx, newAccount, ROLES, login, todayVN, addDays, type Account } from '../support/fixtures';

const API = 'http://localhost:5100/api';
let owner: Account;
let today = '';

test.beforeAll(async () => {
  today = await todayVN();
  owner = await newAccount(ROLES.partner);
});

test.afterAll(async () => {
  await fx('/gateway/mode', { mode: 'ok' });
  await fx('/cleanup');
});

test.describe('Refund lifecycle', () => {
  test('the gateway refuses the refund: the booking is still cancelled, the refund is "Thất bại", and the retry succeeds on the SAME refund row', async ({ page }) => {
    const h = await fx('/hotel', { ownerId: owner.id, name: 'E2E Hotel Hoàn Tiền' });
    const rt = await fx('/room-type', { hotelId: h.id, name: 'Phòng Hoàn Tiền', rooms: 2, price: 300_000, fromOffset: 20, days: 5 });
    const customer = await newAccount(ROLES.customer);
    const paid = await fx('/paid-booking-for', { customerId: customer.id, hotelId: h.id, roomTypeId: rt.id, checkIn: addDays(today, 22) });
    await fx('/gateway/mode', { mode: 'reject' });
    const callsBefore = (await fx('/gateway/calls')).calls.length; // the stand-in's log is shared by the whole run
    await login(page, customer);
    await page.goto(`/bookings/${paid.id}`);

    await page.getByRole('button', { name: 'Hủy đặt phòng này' }).click();
    await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
    await expect(page.getByText('Đã hủy').first()).toBeVisible();

    let row = await fx('/db/booking', { id: paid.id });
    expect((await fx('/gateway/calls')).calls).toHaveLength(callsBefore + 1); // the refusal really came from the gateway
    expect(row.TrangThai).toBe('Đã hủy'); // the cancellation is not undone by a gateway problem
    const refund = row.THANH_TOAN[0].HOAN_TIEN;
    expect(refund).toHaveLength(1);
    expect(refund[0]).toMatchObject({ TrangThai: 'Thất bại', NgayHoanTien: null });
    expect(Number(refund[0].SoTienHoan)).toBe(300_000); // 100 % tier, a month ahead
    const refundId = refund[0].MaHoanTien;
    const requestedAt = refund[0].NgayYeuCau;

    // the customer sees a retry; the gateway is back; one click finishes the SAME refund
    await fx('/gateway/mode', { mode: 'ok' });
    await page.reload();
    await page.getByRole('button', { name: /Thử lại/ }).click();
    await expect.poll(async () => (await fx('/db/booking', { id: paid.id })).THANH_TOAN[0].HOAN_TIEN[0].TrangThai).toBe('Thành công');

    row = await fx('/db/booking', { id: paid.id });
    const after = row.THANH_TOAN[0].HOAN_TIEN;
    expect(after).toHaveLength(1);
    expect(after[0].MaHoanTien).toBe(refundId);
    expect(after[0].NgayYeuCau).toBe(requestedAt); // the request date never moves
    expect(after[0].NgayHoanTien).not.toBeNull();
    expect(new Date(after[0].NgayHoanTien).getTime()).toBeGreaterThanOrEqual(new Date(requestedAt).getTime());
    await expect(page.getByRole('button', { name: /Thử lại/ })).toHaveCount(0);

    // retrying a finished refund moves no more money
    const calls = (await fx('/gateway/calls')).calls.length;
    const again = await page.request.post(`${API}/auth/refresh`, { headers: { Origin: 'http://localhost:5174' } });
    const token = (await again.json()).data.accessToken;
    const retry = await page.request.post(`${API}/payments/refunds/${refundId}/retry`, { headers: { Authorization: `Bearer ${token}` } });
    expect(retry.status()).toBe(200);
    expect((await fx('/gateway/calls')).calls.length).toBe(calls);
  });
});

test.describe('Inventory under contention and hold expiry', () => {
  test('two customers press "Tạo đặt phòng" for the LAST room at the same moment: exactly one booking exists', async ({ browser }) => {
    const h = await fx('/hotel', { ownerId: owner.id, name: 'E2E Hotel Phòng Cuối' });
    const rt = await fx('/room-type', { hotelId: h.id, name: 'Phòng Cuối Cùng', rooms: 1, price: 250_000, fromOffset: 12, days: 5 });
    const url = `/hotels/${h.id}?checkIn=${addDays(today, 13)}&checkOut=${addDays(today, 14)}&guests=2`;
    const players = [];
    for (let i = 0; i < 2; i++) {
      const customer = await newAccount(ROLES.customer);
      const page = await (await browser.newContext()).newPage();
      await login(page, customer);
      await page.goto(url);
      await page.getByRole('button', { name: 'Tăng phòng Phòng Cuối Cùng' }).click();
      await expect(page.locator('#dat-phong').getByRole('button', { name: /Tạo đặt phòng/ })).toBeEnabled();
      players.push({ page, customer });
    }

    // both are looking at an available room; fire both at once
    await Promise.all(players.map(({ page }) => page.locator('#dat-phong').getByRole('button', { name: /Tạo đặt phòng/ }).click()));
    await Promise.all(players.map(({ page }) => page.waitForLoadState('networkidle')));

    const bookings = await Promise.all(players.map(({ customer }) => fx('/db/latest-booking', { customerId: customer.id })));
    const created = bookings.filter(Boolean);
    expect(created).toHaveLength(1); // not 2: no oversell
    expect(created[0].CHI_TIET_DAT_PHONG.reduce((n: number, l: { SoLuongPhong: number }) => n + l.SoLuongPhong, 0)).toBe(1);

    const winner = players.find((p, i) => bookings[i]);
    const loser = players.find((p, i) => !bookings[i])!;
    await expect(winner!.page).toHaveURL(/\/bookings\/\d+/);
    await expect(loser.page).toHaveURL(/\/hotels\//); // stayed on the hotel page ...
    await expect(loser.page.getByRole('alert').first()).toBeVisible(); // ... with the reason shown
  });

  test('an unpaid booking holds the room for 15 minutes; after that the room is sellable again and the old booking is cancelled', async ({ page, browser }) => {
    const h = await fx('/hotel', { ownerId: owner.id, name: 'E2E Hotel Giữ Chỗ' });
    const rt = await fx('/room-type', { hotelId: h.id, name: 'Phòng Giữ Chỗ', rooms: 1, price: 250_000, fromOffset: 12, days: 5 });
    const url = `/hotels/${h.id}?checkIn=${addDays(today, 13)}&checkOut=${addDays(today, 14)}&guests=2`;
    const first = await newAccount(ROLES.customer);
    const second = await newAccount(ROLES.customer);

    // the first customer books and does not pay
    await login(page, first);
    await page.goto(url);
    await page.getByRole('button', { name: 'Tăng phòng Phòng Giữ Chỗ' }).click();
    await page.locator('#dat-phong').getByRole('button', { name: /Tạo đặt phòng/ }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);
    const heldId = Number(new URL(page.url()).pathname.split('/').pop());
    await expect(page.getByText(/Chờ thanh toán/).first()).toBeVisible();

    // within the hold the room is NOT available to anyone else
    const other = await (await browser.newContext()).newPage();
    await login(other, second);
    await other.goto(url);
    const roomStatus = await other.request.get(`${API}/hotels/${h.id}/rooms?checkIn=${addDays(today, 13)}&checkOut=${addDays(today, 14)}&guests=2`);
    expect((await roomStatus.json()).data.find((r: { MaLoaiPhong: number }) => r.MaLoaiPhong === rt.id).SoPhongConLai).toBe(0);

    // 16 minutes pass
    await fx('/backdate-booking', { id: heldId, minutes: 16 });
    await other.goto(url);
    await other.getByRole('button', { name: 'Tăng phòng Phòng Giữ Chỗ' }).click();
    await expect(other.locator('#dat-phong').getByRole('button', { name: /Tạo đặt phòng/ })).toBeEnabled();
    await other.locator('#dat-phong').getByRole('button', { name: /Tạo đặt phòng/ }).click();
    await expect(other).toHaveURL(/\/bookings\/\d+/);

    // the abandoned booking was cancelled by the system and the room is held by the new customer only
    expect((await fx('/db/booking', { id: heldId })).TrangThai).toBe('Đã hủy');
    await page.goto('/bookings');
    await expect(page.getByText('Đã hủy').first()).toBeVisible();
    const mine = await fx('/db/latest-booking', { customerId: second.id });
    expect(mine.TrangThai).toBe('Chờ thanh toán');
  });
});
