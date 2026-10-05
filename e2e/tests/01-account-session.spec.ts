import { test, expect, fx, newAccount, ROLES, login, logout, refreshCookie, uniq } from '../support/fixtures';

test.afterAll(async () => {
  await fx('/cleanup');
});

const fillRegistration = async (page: import('@playwright/test').Page, id: string, email: string, password: string) => {
  await page.goto('/register');
  await page.locator('input[name="register-intent"][value="customer"]').check({ force: true });
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.locator('#register-HoTen').fill('E2E Khách Mới');
  await page.locator('#register-TenDangNhap').fill(id.replace(/[^a-z0-9_]/gi, '').slice(0, 30));
  await page.locator('#register-Email').fill(email);
  await page.locator('#register-SoDienThoai').fill('0912345678');
  await page.locator('#register-MatKhau').fill(password);
  await page.locator('#register-confirmMatKhau').fill(password);
};

test.describe('Customer account and session (register, sign in, session refresh, profile, change password, sign out)', () => {
  test('register through the form, sign in, survive a reload by refreshing the session, update the profile', async ({ page }) => {
    const id = uniq();
    const email = `e2e_${id}@example.com`;
    await fillRegistration(page, id, email, 'Reg-Passw0rd!');
    await page.locator('#register-DongYDieuKhoan').check();
    await page.locator('form button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/register/);
    expect((await fx('/db/account', { email })).status).toBe('Hoạt động');

    // the refresh cookie is HttpOnly, scoped to the auth endpoints, and not readable by page scripts
    expect(await refreshCookie(page)).toMatchObject({ httpOnly: true, path: '/api/auth', sameSite: 'Lax' });
    expect(await page.evaluate(() => document.cookie)).not.toContain('refresh_token');

    // a full reload drops the in-memory access token; the cookie brings the session back
    await page.goto('/profile');
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await expect(page.locator('button.site-header__user')).toBeVisible();

    await page.getByLabel('Họ và tên').fill('E2E Tên Đã Đổi');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByText('Cập nhật thông tin thành công!')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Họ và tên')).toHaveValue('E2E Tên Đã Đổi');
  });

  test('registration needs the terms box ticked (a mandatory checkbox must be validated, not only marked required)', async ({ page }) => {
    const id = uniq();
    const email = `e2e_${id}@example.com`;
    await fillRegistration(page, id, email, 'Reg-Passw0rd!');
    // terms deliberately left unticked
    await page.locator('form button[type="submit"]').click();

    await page.waitForTimeout(1500);
    // Still on /register, the message is at the checkbox, and no account was created (NEW-1, resolved).
    expect(await fx('/db/account', { email })).toBeNull();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('#register-DongYDieuKhoan-error')).toHaveText('Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật');
  });

  test('wrong password is refused with a message; the right one signs in', async ({ page }) => {
    const user = await newAccount(ROLES.customer);
    await page.goto('/login');
    await page.locator('#identifier').fill(user.email);
    await page.locator('#MatKhau').fill('Not-The-Password1');
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await login(page, user);
    await expect(page.locator('button.site-header__user')).toBeVisible();
  });

  test('change password through the profile form: the session survives, old password stops working, new one works', async ({ page }) => {
    const user = await newAccount(ROLES.customer);
    await login(page, user);
    await page.goto('/profile');

    await page.getByLabel('Mật khẩu hiện tại').fill(user.password);
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill('Brand-New-Passw0rd!');
    await page.getByLabel('Xác nhận mật khẩu mới').fill('Brand-New-Passw0rd!');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page.getByText('Đổi mật khẩu thành công.')).toBeVisible();

    await page.reload(); // the replaced cookie still restores the session
    await expect(page.getByLabel('Email')).toHaveValue(user.email);

    await logout(page);
    await page.goto('/login');
    await page.locator('#identifier').fill(user.email);
    await page.locator('#MatKhau').fill(user.password);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole('alert')).toBeVisible(); // old password refused

    await login(page, { email: user.email, password: 'Brand-New-Passw0rd!' });
    await expect(page.locator('button.site-header__user')).toBeVisible();
  });

  test('change password: a wrong current password lands under that field', async ({ page }) => {
    const user = await newAccount(ROLES.customer);
    await login(page, user);
    await page.goto('/profile');
    await page.getByLabel('Mật khẩu hiện tại').fill('Wrong-Current-1');
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill('Brand-New-Passw0rd!');
    await page.getByLabel('Xác nhận mật khẩu mới').fill('Brand-New-Passw0rd!');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page.locator('#profile-MatKhauCu-error')).toHaveText('Mật khẩu hiện tại không đúng');
  });

  test('expired access token mid-session: the app refreshes silently and the same request succeeds (no re-login)', async ({ page }) => {
    const user = await newAccount(ROLES.customer);
    await login(page, user);
    await page.goto('/profile');
    await expect(page.getByLabel('Email')).toHaveValue(user.email);

    // the server answers 401 once (as if 15 minutes had passed), then behaves normally
    let answered401 = false;
    await page.route('**/api/profile/me', async (route) => {
      if (!answered401 && route.request().method() === 'PATCH') {
        answered401 = true;
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Invalid or expired access token', code: 'UNAUTHORIZED' }) });
      }
      return route.continue();
    });
    const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh') && r.status() === 200);
    await page.getByLabel('Họ và tên').fill('Sau Khi Hết Hạn');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();

    await refreshed;
    expect(answered401).toBe(true);
    await expect(page.getByText('Cập nhật thông tin thành công!')).toBeVisible();
    await expect(page).toHaveURL(/\/profile/);
  });

  test('sign out clears the cookie: a reload is a guest, protected pages send you to login, refresh is refused', async ({ page }) => {
    const user = await newAccount(ROLES.customer);
    await login(page, user);
    expect(await refreshCookie(page)).toBeDefined();

    await logout(page);
    expect(await refreshCookie(page)).toBeUndefined();
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/);
    const res = await page.request.post('http://localhost:5100/api/auth/refresh', { headers: { Origin: 'http://localhost:5174' } });
    expect(res.status()).toBe(401);
  });

  test('a locked account loses its session on the next refresh and cannot sign in', async ({ page }) => {
    const user = await newAccount(ROLES.customer);
    await login(page, user);
    await fx('/set-account-status', { id: user.id, status: 'Khóa' });

    await page.goto('/profile'); // reload: the access token is gone and the refresh is refused for a locked account
    await expect(page).toHaveURL(/\/login/);
    await page.locator('#identifier').fill(user.email);
    await page.locator('#MatKhau').fill(user.password);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a foreign origin cannot rotate the session cookie (#17 hardening) and the real session is untouched', async ({ page }) => {
    const user = await newAccount(ROLES.customer);
    await login(page, user);
    const evil = await page.request.post('http://localhost:5100/api/auth/refresh', { headers: { Origin: 'https://evil.example' } });
    expect(evil.status()).toBe(403);
    await page.reload();
    await expect(page.locator('button.site-header__user')).toBeVisible();
  });
});
