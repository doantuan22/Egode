import { test, expect, fx, newAccount, ROLES, login, todayVN, addDays, type Account } from '../support/fixtures';
import { simulateGateway } from '../support/payment';

let owner: Account;
let admin: Account;
let city: { id: number; name: string };
let hotel: { id: number; name: string };
let roomTypeName = '';
let checkIn = '';
let checkOut = '';
const PRICE = 400_000;

test.beforeAll(async () => {
  const today = await todayVN();
  checkIn = addDays(today, 15);
  checkOut = addDays(today, 16);
  owner = await newAccount(ROLES.partner);
  admin = await newAccount(ROLES.admin);
  const h = await fx('/hotel', { ownerId: owner.id, stars: 5, name: 'E2E Hotel Thanh Toán' });
  city = { id: h.cityId, name: h.cityName };
  hotel = { id: h.id, name: h.name };
  roomTypeName = 'Phòng Tiêu Chuẩn E2E';
  await fx('/room-type', { hotelId: hotel.id, name: roomTypeName, capacity: 2, price: PRICE, rooms: 2, fromOffset: 10, days: 15 });
});

test.afterAll(async () => {
  await fx('/cleanup');
});

const stayUrl = () => `/hotels/${hotel.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`;

test.describe('Zero-price booking', () => {
  test('a 100% promotion makes the total 0: confirmed on the spot, no payment row, the gateway is never visited', async ({ page }) => {
    const customer = await newAccount(ROLES.customer);
    const free = await fx('/promotion', { type: 'Phần trăm', value: 100, startKey: addDays(await todayVN(), -1), endKey: addDays(await todayVN(), 60) });
    await login(page, customer);
    const gateway = await simulateGateway(page, 'success');

    await page.goto(stayUrl());
    await page.getByRole('button', { name: `Tăng phòng ${roomTypeName}` }).click();
    const panel = page.locator('#dat-phong');
    await panel.getByPlaceholder('Nhập mã (nếu có)').fill(free.code);
    await panel.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(panel).toContainText('Khuyến mãi giảm');
    await panel.getByRole('button', { name: /Xác nhận đặt phòng/ }).click();

    await expect(page).toHaveURL(/\/payment\/result\?.*status=success/);
    await expect(page.getByText(/Đặt phòng thành công/).first()).toBeVisible();
    expect(gateway).toHaveLength(0);

    const row = await fx('/db/latest-booking', { customerId: customer.id });
    expect(row.TrangThai).toBe('Đã xác nhận');
    expect(Number(row.TongTienThanhToan)).toBe(0);
    expect(Number(row.SoTienGiam)).toBe(PRICE);
    expect(row.THANH_TOAN).toHaveLength(0);
  });
});

test.describe('Payment outcomes', () => {
  test('a declined card leaves the booking unpaid; paying again with a good card confirms it', async ({ page }) => {
    const customer = await newAccount(ROLES.customer);
    await login(page, customer);
    await page.goto(stayUrl());
    await page.getByRole('button', { name: `Tăng phòng ${roomTypeName}` }).click();
    await page.locator('#dat-phong').getByRole('button', { name: /Tạo đặt phòng/ }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);
    const bookingId = Number(new URL(page.url()).pathname.split('/').pop());

    // first attempt: the bank declines
    await page.unrouteAll();
    await simulateGateway(page, 'failed');
    await page.getByRole('button', { name: 'Thanh toán ngay' }).click();
    await expect(page).toHaveURL(/\/payment\/result\?.*status=(failed|failure|error)/);
    let row = await fx('/db/booking', { id: bookingId });
    expect(row.TrangThai).toBe('Chờ thanh toán');
    expect(row.THANH_TOAN.map((p: { TrangThai: string }) => p.TrangThai)).toEqual(['Thất bại']);

    // second attempt: succeeds
    await page.unrouteAll();
    await simulateGateway(page, 'success');
    await page.goto(`/bookings/${bookingId}`);
    await page.getByRole('button', { name: 'Thanh toán ngay' }).click();
    await expect(page).toHaveURL(/\/payment\/result\?.*status=success/);
    row = await fx('/db/booking', { id: bookingId });
    expect(row.TrangThai).toBe('Đã xác nhận');
    expect(row.THANH_TOAN.filter((p: { TrangThai: string }) => p.TrangThai === 'Thành công')).toHaveLength(1);
    expect(row.THANH_TOAN.filter((p: { TrangThai: string }) => p.TrangThai === 'Chờ xử lý')).toHaveLength(0);
  });
});

test.describe('Reviews after a finished stay, moderation, and what the public sees', () => {
  test('only reviews an admin made visible appear publicly; average and count follow moderation', async ({ page, browser }) => {
    const alice = await newAccount(ROLES.customer);
    const bob = await newAccount(ROLES.customer);
    const aliceStay = await fx('/completed-booking', { customerId: alice.id, hotelId: hotel.id });
    const bobStay = await fx('/completed-booking', { customerId: bob.id, hotelId: hotel.id });

    // --- Alice writes a 5-star review through the booking page
    await login(page, alice);
    await page.goto(`/bookings/${aliceStay.id}`);
    await page.getByRole('button', { name: '5 sao' }).click();
    await page.locator('#review-content').fill('Tuyệt vời, sẽ quay lại.');
    await page.getByRole('button', { name: 'Gửi đánh giá' }).click();
    await expect(page.getByText(/Cảm ơn bạn đã đánh giá/)).toBeVisible(); // the saved review, not the textarea

    // --- Bob writes a 1-star review
    const bobPage = await (await browser.newContext()).newPage();
    await login(bobPage, bob);
    await bobPage.goto(`/bookings/${bobStay.id}`);
    await bobPage.getByRole('button', { name: '1 sao' }).click();
    await bobPage.locator('#review-content').fill('Không như mong đợi.');
    await bobPage.getByRole('button', { name: 'Gửi đánh giá' }).click();
    await expect(bobPage.getByText(/Cảm ơn bạn đã đánh giá/)).toBeVisible();

    let reviews = await fx('/db/reviews', { hotelId: hotel.id });
    expect(reviews).toHaveLength(2);
    expect(reviews.map((r: { TrangThai: string }) => r.TrangThai)).toEqual(['Chờ duyệt', 'Chờ duyệt']);

    // --- the public sees nothing yet: no reviews, no average
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(stayUrl());
    await expect(guest.getByText('Tuyệt vời, sẽ quay lại.')).toHaveCount(0);
    await expect(guest.getByText('Không như mong đợi.')).toHaveCount(0);

    // --- the admin shows Alice's review and hides Bob's
    const adminPage = await (await browser.newContext()).newPage();
    await login(adminPage, admin);
    const [aliceReview, bobReview] = reviews as Array<{ MaDanhGia: number; DiemDanhGia: number }>;
    expect([aliceReview.DiemDanhGia, bobReview.DiemDanhGia]).toEqual([5, 1]);
    await adminPage.goto(`/admin/reviews/${aliceReview.MaDanhGia}`);
    const moderated = () => adminPage.waitForResponse((r) => r.url().includes('/admin/reviews/') && r.request().method() !== 'GET' && r.ok());
    await Promise.all([moderated(), adminPage.getByRole('button', { name: 'Duyệt (Hiển thị)' }).click()]);
    await adminPage.goto(`/admin/reviews/${bobReview.MaDanhGia}`);
    await Promise.all([moderated(), adminPage.getByRole('button', { name: 'Ẩn đánh giá' }).click()]);

    await expect.poll(async () => (await fx('/db/reviews', { hotelId: hotel.id })).map((r: { TrangThai: string }) => r.TrangThai)).toEqual(['Hiển thị', 'Ẩn']);
    reviews = await fx('/db/reviews', { hotelId: hotel.id });
    expect(reviews.map((r: { TrangThai: string }) => r.TrangThai)).toEqual(['Hiển thị', 'Ẩn']);

    // --- the public now sees only Alice's review, and the average/count count only visible reviews
    await guest.goto(stayUrl());
    await expect(guest.getByText('Tuyệt vời, sẽ quay lại.')).toBeVisible();
    await expect(guest.getByText('Không như mong đợi.')).toHaveCount(0);
    const api = await guest.request.get(`http://localhost:5100/api/hotels/${hotel.id}`);
    expect((await api.json()).data.DanhGia).toEqual({ DiemTrungBinh: 5, SoLuongDanhGia: 1 });
    const list = await guest.request.get(`http://localhost:5100/api/hotels?location=${encodeURIComponent(city.name)}&checkIn=${checkIn}&checkOut=${checkOut}&guests=2`);
    const found = (await list.json()).data.find((h: { MaKhachSan: number }) => h.MaKhachSan === hotel.id);
    expect(found).toMatchObject({ DiemTrungBinh: 5, SoLuongDanhGia: 1 });
  });
});
