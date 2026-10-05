import { test, expect, fx, newAccount, ROLES, login, todayVN, addDays, uniq, type Account } from '../support/fixtures';

/**
 * Partner / owner lifecycle through the real UI:
 * register as a partner -> apply (mandatory confirmation) -> admin approves -> owner creates a hotel (Chờ duyệt, not public)
 * -> admin approves -> owner creates a room type and sets inventory/price -> a customer books -> the inventory floor is enforced.
 */
const API = 'http://localhost:5100/api';
let admin: Account;
let city: { id: number; name: string };

test.beforeAll(async () => {
  admin = await newAccount(ROLES.admin);
  city = await fx('/city');
});

test.afterAll(async () => {
  await fx('/cleanup');
});

test('partner registration -> approval -> hotel (Chờ duyệt) -> approval -> room type -> inventory and its floor', async ({ page, browser, playwright }) => {
  const today = await todayVN();
  const id = uniq();
  const email = `e2e_${id}@example.com`;
  const password = 'Partner-Passw0rd!';
  const hotelName = `E2E Khách sạn ${id}`;
  const roomName = `Phòng Deluxe ${id}`;

  // ---- 1. register as a partner: the form continues to the partner application
  await page.goto('/register');
  await page.locator('input[name="register-intent"][value="partner"]').check({ force: true });
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.locator('#register-HoTen').fill('E2E Đối Tác');
  await page.locator('#register-TenDangNhap').fill(id.replace(/[^a-z0-9_]/gi, '').slice(0, 30));
  await page.locator('#register-Email').fill(email);
  await page.locator('#register-SoDienThoai').fill('0912345678');
  await page.locator('#register-MatKhau').fill(password);
  await page.locator('#register-confirmMatKhau').fill(password);
  await page.locator('#register-DongYDieuKhoan').check();
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/partner\/apply/);

  // ---- 2. the application: the confirmation is mandatory (#16), the other fields are validated
  await page.locator('#partner-apply-field-1').fill('012345678901');
  await page.locator('#partner-apply-field-2').fill(`GPKD-${id}`);
  await page.locator('#partner-apply-field-3').fill('0101234567');
  await page.locator('#partner-apply-field-4').fill('https://files.example.com/gpkd.pdf');
  await page.getByRole('button', { name: 'Nộp hồ sơ đối tác' }).click();
  await expect(page.getByText('Vui lòng xác nhận thông tin cung cấp là chính xác')).toBeVisible();
  expect(await fx('/db/partner-application', { email })).toBeNull(); // nothing was sent

  await page.locator('#partner-apply-confirm').check();
  await page.getByRole('button', { name: 'Nộp hồ sơ đối tác' }).click();
  await expect(page.getByText('Hồ sơ đã được gửi')).toBeVisible();
  await expect(page.getByText('Đang chờ duyệt')).toBeVisible();
  const application = await fx('/db/partner-application', { email });
  expect(application).toMatchObject({ status: 'Chờ duyệt' });
  expect((await fx('/db/account', { email })).role).toBe(ROLES.customer);

  // ---- 3. the admin approves the application through the UI
  const adminPage = await (await browser.newContext()).newPage();
  await login(adminPage, admin);
  await adminPage.goto(`/admin/partner-applications/${application.id}`);
  await adminPage.getByRole('button', { name: 'Phê duyệt hồ sơ' }).click();
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Phê duyệt', exact: true }).click();
  await expect(adminPage.getByText(/Đã duyệt|đã được duyệt/i).first()).toBeVisible();
  expect((await fx('/db/account', { email })).role).toBe(ROLES.partner);

  // ---- 4. the owner (same browser session) creates a hotel: it waits for approval and is not public
  await page.goto('/owner/hotels/new');
  await page.locator('#owner-hotel-form-TenKhachSan').fill(hotelName);
  await page.locator('#owner-hotel-form-HangSao').selectOption('4');
  await page.locator('#owner-hotel-form-MaDiaPhuong').fill(city.name);
  await page.getByRole('option', { name: city.name }).click();
  await page.locator('#owner-hotel-form-DiaChiChiTiet').fill('12 Đường Thử Nghiệm, Quận 1');
  await page.locator('#owner-hotel-form-GioNhanPhong').fill('14:00');
  await page.locator('#owner-hotel-form-GioTraPhong').fill('12:00');
  await page.getByRole('button', { name: 'Gửi đăng ký duyệt' }).click();
  await expect(page).not.toHaveURL(/\/hotels\/new/);

  const hotel = await fx('/db/hotel', { name: hotelName });
  expect(hotel).toMatchObject({ TrangThai: 'Chờ duyệt', GioNhanPhong: '14:00', GioTraPhong: '12:00', HangSao: 4 });
  expect(hotel.NgayDuyet).toBeNull();
  expect((await (await page.request.get(`${API}/hotels/${hotel.MaKhachSan}`)).status())).toBe(404); // not public yet

  // ---- 5. the admin approves the hotel: it becomes public
  await adminPage.goto(`/admin/hotels/${hotel.MaKhachSan}`);
  await adminPage.getByRole('button', { name: 'Duyệt khách sạn' }).click();
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Duyệt', exact: true }).click();
  await expect(adminPage.getByText('Hoạt động').first()).toBeVisible();
  const approved = await fx('/db/hotel', { id: hotel.MaKhachSan });
  expect(approved.TrangThai).toBe('Hoạt động');
  expect(approved.NgayDuyet).not.toBeNull();
  expect((await page.request.get(`${API}/hotels/${hotel.MaKhachSan}`)).status()).toBe(200);

  // ---- 6. the owner adds a room type through the UI
  await page.goto('/owner/room-types');
  await page.getByRole('button', { name: 'Thêm loại phòng' }).click();
  await page.locator('input[name="name"]').fill(roomName);
  await page.locator('input[name="bed"]').fill('Giường đôi');
  await page.locator('input[name="beds"]').fill('1');
  await page.locator('input[name="capacity"]').fill('2');
  await page.locator('input[name="area"]').fill('28');
  await page.getByRole('button', { name: 'Tạo loại phòng' }).click();
  await expect(page.getByText(roomName).first()).toBeVisible();
  const roomType = await fx('/db/room-type', { hotelId: hotel.MaKhachSan, name: roomName });
  expect(roomType).toMatchObject({ status: 'Hoạt động' });

  // ---- 7. inventory and price for one night, through the form (3 rooms at 600.000)
  const night = addDays(today, 20);
  await page.goto(`/owner/inventory-pricing?hotelId=${hotel.MaKhachSan}&roomTypeId=${roomType.id}`);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(night);
  await dateInputs.nth(1).fill(night);
  await page.locator('input[name="price"]').fill('600000');
  await page.locator('input[name="quantity"]').fill('3');
  await page.getByRole('button', { name: 'Cập nhật khoảng ngày' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ghi đè' }).click();
  await expect(page.getByText('Đã cập nhật giá và quỹ phòng')).toBeVisible();
  expect(await fx('/db/stock', { roomTypeId: roomType.id })).toEqual([{ date: night, rooms: 3, price: 600000, status: 'Mở bán' }]);

  // ---- 8. a customer books 2 of the 3 rooms through the real API (a signed-in session)
  const customer = await newAccount(ROLES.customer);
  const customerApi = await playwright.request.newContext(); // its own cookie jar: the owner's browser session must stay the owner's
  const loginRes = await customerApi.post(`${API}/auth/login`, { data: { identifier: customer.email, MatKhau: customer.password } });
  const token = (await loginRes.json()).data.accessToken as string;
  const booked = await customerApi.post(`${API}/hotels/${hotel.MaKhachSan}/bookings`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { checkIn: night, checkOut: addDays(night, 1), guests: 2, rooms: [{ maLoaiPhong: roomType.id, soLuong: 2 }] },
  });
  expect(booked.status()).toBe(201);

  // ---- 9. the floor: the owner cannot set fewer rooms than are already booked; the data stays as it was
  await page.goto(`/owner/inventory-pricing?hotelId=${hotel.MaKhachSan}&roomTypeId=${roomType.id}`);
  await page.locator('input[type="date"]').nth(0).fill(night);
  await page.locator('input[type="date"]').nth(1).fill(night);
  await page.locator('input[name="price"]').fill('600000');
  await page.locator('input[name="quantity"]').fill('1');
  await page.getByRole('button', { name: 'Cập nhật khoảng ngày' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ghi đè' }).click();
  await expect(page.getByRole('alert').first()).toContainText(/đã đặt|đã có/i);
  expect((await fx('/db/stock', { roomTypeId: roomType.id }))[0].rooms).toBe(3);

  // ... but exactly the booked number is allowed (2), and the floor then holds at 2
  await page.locator('input[name="quantity"]').fill('2');
  await page.getByRole('button', { name: 'Cập nhật khoảng ngày' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ghi đè' }).click();
  await expect(page.getByText('Đã cập nhật giá và quỹ phòng')).toBeVisible();
  expect((await fx('/db/stock', { roomTypeId: roomType.id }))[0].rooms).toBe(2);
});

test('a partner application the admin rejects: the applicant stays a customer, sees the reason, and can apply again', async ({ page, browser }) => {
  const applicant = await newAccount(ROLES.customer);
  await login(page, applicant);
  await page.goto('/partner/apply');
  await page.locator('#partner-apply-field-1').fill('012345678901');
  await page.locator('#partner-apply-field-2').fill(`GPKD-${uniq()}`);
  await page.locator('#partner-apply-field-3').fill('0101234567');
  await page.locator('#partner-apply-field-4').fill('https://files.example.com/gpkd.pdf');
  await page.locator('#partner-apply-confirm').check();
  await page.getByRole('button', { name: 'Nộp hồ sơ đối tác' }).click();
  await expect(page.getByText('Hồ sơ đã được gửi')).toBeVisible();
  const application = await fx('/db/partner-application', { email: applicant.email });

  const adminPage = await (await browser.newContext()).newPage();
  await login(adminPage, admin);
  await adminPage.goto(`/admin/partner-applications/${application.id}`);
  await adminPage.locator('#admin-partner-application-detail-field-1').fill('Giấy phép không hợp lệ');
  await adminPage.getByRole('button', { name: 'Từ chối hồ sơ' }).click();
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Từ chối hồ sơ' }).click();
  await expect(adminPage.getByText(/Từ chối|Đã bị từ chối/).first()).toBeVisible();

  expect((await fx('/db/account', { email: applicant.email })).role).toBe(ROLES.customer);
  await page.goto('/partner/apply');
  await expect(page.getByText(/Hồ sơ trước đó đã bị từ chối/)).toBeVisible();
  await expect(page.getByText('Giấy phép không hợp lệ')).toBeVisible();
  await expect(page.locator('#partner-apply-field-1')).toBeVisible(); // can submit a new one
});

test('the owner edits the hotel in the UI: times are "HH:mm" on the way in and out, and the admin sees the same', async ({ page, browser }) => {
  const ownerAccount = await newAccount(ROLES.partner);
  const hotel = await fx('/hotel', { ownerId: ownerAccount.id, name: `E2E Chủ sửa ${uniq()}` });
  await login(page, ownerAccount);
  await page.goto(`/owner/hotels/${hotel.id}`);
  await expect(page.locator('#owner-hotel-manage-GioNhanPhong')).toHaveValue('14:00');
  await expect(page.locator('#owner-hotel-manage-GioTraPhong')).toHaveValue('12:00');

  await page.locator('#owner-hotel-manage-GioNhanPhong').fill('15:45');
  await page.locator('#owner-hotel-manage-GioTraPhong').fill('10:30');
  await page.locator('#owner-hotel-manage-TenKhachSan').fill(`${hotel.name} (đã sửa)`);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect.poll(async () => (await fx('/db/hotel', { id: hotel.id })).GioNhanPhong).toBe('15:45');
  expect((await fx('/db/hotel', { id: hotel.id })).GioTraPhong).toBe('10:30');

  await page.reload();
  await expect(page.locator('#owner-hotel-manage-GioNhanPhong')).toHaveValue('15:45');
  await expect(page.locator('#owner-hotel-manage-GioTraPhong')).toHaveValue('10:30');

  const adminPage = await (await browser.newContext()).newPage();
  await login(adminPage, admin);
  await adminPage.goto(`/admin/hotels/${hotel.id}`);
  await expect(adminPage.getByLabel(/Giờ nhận phòng/)).toHaveValue('15:45');
  await expect(adminPage.getByLabel(/Giờ trả phòng/)).toHaveValue('10:30');
});
