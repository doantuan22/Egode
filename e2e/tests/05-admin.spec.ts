import { test, expect, fx, newAccount, ROLES, login, uniq, type Account } from '../support/fixtures';
import { formatVnd } from '../support/format';

const API = 'http://localhost:5100/api';
let admin: Account;
let owner: Account;

test.beforeAll(async () => {
  admin = await newAccount(ROLES.admin);
  owner = await newAccount(ROLES.partner);
});

test.afterAll(async () => {
  await fx('/admin/restore');
  await fx('/cleanup');
});

test.describe('Admin: hotels', () => {
  test('approve one pending hotel and reject another: only the approved one is public; a rejected hotel offers no way back', async ({ page }) => {
    const toApprove = await fx('/hotel', { ownerId: owner.id, status: 'Chờ duyệt', name: `E2E Chờ duyệt ${uniq()}` });
    const toReject = await fx('/hotel', { ownerId: owner.id, status: 'Chờ duyệt', name: `E2E Từ chối ${uniq()}` });
    await login(page, admin);

    expect((await page.request.get(`${API}/hotels/${toApprove.id}`)).status()).toBe(404);

    await page.goto(`/admin/hotels/${toApprove.id}`);
    await expect(page.getByRole('button', { name: 'Kích hoạt lại' })).toHaveCount(0); // a pending hotel is approved, not "reactivated"
    await page.getByRole('button', { name: 'Duyệt khách sạn' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(page.getByText('Hoạt động').first()).toBeVisible();

    await page.goto(`/admin/hotels/${toReject.id}`);
    await page.getByRole('button', { name: /Từ chối/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Từ chối', exact: true }).click();
    await expect(page.getByText(/Không có thao tác nào khả dụng/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Duyệt khách sạn' })).toHaveCount(0);

    const approved = await fx('/db/hotel', { id: toApprove.id });
    const rejected = await fx('/db/hotel', { id: toReject.id });
    expect(approved.TrangThai).toBe('Hoạt động');
    expect(approved.NgayDuyet).not.toBeNull();
    expect(rejected.TrangThai).toBe('Từ chối');
    expect(rejected.NgayDuyet).toBeNull();
    expect((await page.request.get(`${API}/hotels/${toApprove.id}`)).status()).toBe(200);
    expect((await page.request.get(`${API}/hotels/${toReject.id}`)).status()).toBe(404);
  });

  test('suspend and reactivate: a suspended hotel disappears from the public site and returns when reactivated', async ({ page }) => {
    const hotel = await fx('/hotel', { ownerId: owner.id, name: `E2E Đình chỉ ${uniq()}` });
    await login(page, admin);
    await page.goto(`/admin/hotels/${hotel.id}`);

    await page.getByRole('button', { name: /Tạm đình chỉ/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Đình chỉ', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Kích hoạt lại' })).toBeVisible();
    expect((await page.request.get(`${API}/hotels/${hotel.id}`)).status()).toBe(404);

    await page.getByRole('button', { name: 'Kích hoạt lại' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Kích hoạt lại', exact: true }).click();
    await expect(page.getByRole('button', { name: /Tạm đình chỉ/ })).toBeVisible();
    expect((await page.request.get(`${API}/hotels/${hotel.id}`)).status()).toBe(200);
  });

  test('check-in / check-out time are "HH:mm" everywhere: admin edits 02:30 / 11:15, the owner and the public see the same', async ({ page, playwright }) => {
    const hotel = await fx('/hotel', { ownerId: owner.id, name: `E2E Giờ ${uniq()}` });
    await login(page, admin);
    await page.goto(`/admin/hotels/${hotel.id}`);
    await page.getByLabel(/Giờ nhận phòng/).fill('02:30');
    await page.getByLabel(/Giờ trả phòng/).fill('11:15');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect.poll(async () => (await fx('/db/hotel', { id: hotel.id })).GioNhanPhong).toBe('02:30');
    expect((await fx('/db/hotel', { id: hotel.id })).GioTraPhong).toBe('11:15');

    await page.reload();
    await expect(page.getByLabel(/Giờ nhận phòng/)).toHaveValue('02:30');
    await expect(page.getByLabel(/Giờ trả phòng/)).toHaveValue('11:15');

    const publicBody = (await (await page.request.get(`${API}/hotels/${hotel.id}`)).json()).data;
    expect([publicBody.GioNhanPhong, publicBody.GioTraPhong]).toEqual(['02:30', '11:15']);

    const ownerApi = await playwright.request.newContext();
    const token = (await (await ownerApi.post(`${API}/auth/login`, { data: { identifier: owner.email, MatKhau: owner.password } })).json()).data.accessToken;
    const ownerBody = (await (await ownerApi.get(`${API}/owner/hotels/${hotel.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()).data;
    expect([ownerBody.GioNhanPhong, ownerBody.GioTraPhong]).toEqual(['02:30', '11:15']);
  });
});

test.describe('Admin: accounts and last-admin protection', () => {
  test('lock and unlock a customer: a locked customer cannot sign in; unlocking restores access', async ({ page, browser }) => {
    const customer = await newAccount(ROLES.customer);
    await login(page, admin);
    await page.goto(`/admin/accounts/${customer.id}`);
    await page.getByRole('button', { name: 'Khóa tài khoản' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Khóa tài khoản', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mở khóa tài khoản' })).toBeVisible();
    expect((await fx('/db/account', { id: customer.id })).status).toBe('Khóa');

    const guest = await (await browser.newContext()).newPage();
    await guest.goto('/login');
    await guest.locator('#identifier').fill(customer.email);
    await guest.locator('#MatKhau').fill(customer.password);
    await guest.locator('form button[type="submit"]').click();
    await expect(guest.getByRole('alert')).toBeVisible();
    await expect(guest).toHaveURL(/\/login/);

    await page.getByRole('button', { name: 'Mở khóa tài khoản' }).click();
    await expect(page.getByRole('button', { name: 'Khóa tài khoản' })).toBeVisible();
    await login(guest, customer);
    await expect(guest.locator('button.site-header__user')).toBeVisible();
  });

  test('an admin cannot lock, delete or demote themself; with two admins one may lock the other, and one active admin always remains', async ({ page, playwright }) => {
    const second = await newAccount(ROLES.admin);
    await fx('/admin/isolate', { keep: [admin.id, second.id] }); // a known admin set: just these two
    try {
      expect((await fx('/db/active-admins')).count).toBe(2);
      await login(page, admin);

      // own account: no lock / delete controls, with the reason
      const me = (await (await page.request.get(`${API}/profile/me`, { headers: { Authorization: `Bearer ${await accessToken(page)}` } })).json()).data;
      await page.goto(`/admin/accounts/${me.MaTaiKhoan}`);
      await expect(page.getByText(/không thể tự khóa hoặc xóa chính mình/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Khóa tài khoản' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Xóa tài khoản' })).toHaveCount(0);

      // ... and the server refuses it too (not only the UI)
      const api = await playwright.request.newContext();
      const token = (await (await api.post(`${API}/auth/login`, { data: { identifier: admin.email, MatKhau: admin.password } })).json()).data.accessToken;
      const selfLock = await api.post(`${API}/admin/accounts/${admin.id}/lock`, { headers: { Authorization: `Bearer ${token}` } });
      expect(selfLock.status()).toBe(400);
      const selfDelete = await api.delete(`${API}/admin/accounts/${admin.id}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(selfDelete.status()).toBe(400);
      expect((await fx('/db/active-admins')).count).toBe(2);

      // the other admin can be locked (one remains) ...
      await page.goto(`/admin/accounts/${second.id}`);
      await page.getByRole('button', { name: 'Khóa tài khoản' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Khóa tài khoản', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Mở khóa tài khoản' })).toBeVisible();
      expect((await fx('/db/active-admins')).count).toBe(1);

      // ... and nobody is left who could lock the last one: self actions stay refused
      const again = await api.post(`${API}/admin/accounts/${admin.id}/lock`, { headers: { Authorization: `Bearer ${token}` } });
      expect(again.status()).toBe(400);
      expect((await fx('/db/active-admins')).count).toBe(1);
    } finally {
      await fx('/admin/restore');
    }
    expect((await fx('/db/active-admins')).count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Admin: analytics', () => {
  test('the revenue shown equals the API, and a new paid booking raises it by exactly its amount', async ({ page }) => {
    const customer = await newAccount(ROLES.customer);
    const hotel = await fx('/hotel', { ownerId: owner.id, name: `E2E Doanh thu ${uniq()}` });
    await login(page, admin);
    const token = await accessToken(page);
    const analytics = async () => (await (await page.request.get(`${API}/admin/analytics`, { headers: { Authorization: `Bearer ${token}` } })).json()).data;

    const before = await analytics();
    const AMOUNT = 1_250_000;
    await fx('/paid-booking', { customerId: customer.id, hotelId: hotel.id, amount: AMOUNT });
    const after = await analytics();
    expect(after.DoanhThuHeThong - before.DoanhThuHeThong).toBe(AMOUNT);
    expect(after.TongSoBooking - before.TongSoBooking).toBe(1);

    await page.goto('/admin/analytics');
    await expect(page.getByRole('heading', { name: /Báo cáo & thống kê hệ thống/ })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(formatVnd(after.DoanhThuHeThong)).first()).toBeVisible();
    await expect(page.getByText(formatVnd(after.DoanhThuThucNhan)).first()).toBeVisible();
  });
});

/** The access token the SPA currently holds, obtained the way the app itself does: a cookie refresh. */
async function accessToken(page: import('@playwright/test').Page): Promise<string> {
  const res = await page.request.post(`${API}/auth/refresh`, { headers: { Origin: 'http://localhost:5174' } });
  return (await res.json()).data.accessToken as string;
}
