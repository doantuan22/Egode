import { test as base, expect, type Page } from '@playwright/test';

const FIXTURE = 'http://localhost:5191';

/** Calls the fixture server (seed data / read rows back / switch the refund gateway stand-in). */
export const fx = async <T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> => {
  const res = await fetch(`${FIXTURE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json()) as { data?: T; error?: string };
  if (!res.ok) throw new Error(`fixture ${path}: ${json.error}`);
  return json.data as T;
};

export interface Account {
  id: number;
  email: string;
  username: string;
  password: string;
  name: string;
}

export const newAccount = (role: string, extra: Record<string, unknown> = {}) => fx<Account>('/account', { role, ...extra });

export const ROLES = { customer: 'Khách hàng', partner: 'Chủ khách sạn', admin: 'Quản trị hệ thống' } as const;

export const todayVN = async () => (await fx<{ today: string }>('/today')).today;

export const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

/** Signs in through the real login form. */
export async function login(page: Page, account: Pick<Account, 'email' | 'password'>) {
  await page.goto('/login');
  await page.locator('#identifier').fill(account.email);
  await page.locator('#MatKhau').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

export const test = base;
export { expect };

/** Opens the navbar account menu and signs out. */
export async function logout(page: Page) {
  await page.locator('button.site-header__user').click();
  await page.getByRole('banner').getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.locator('button.site-header__user')).toHaveCount(0);
}

/** The refresh cookie as the browser holds it (HttpOnly, so only visible through the context). */
export const refreshCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === 'refresh_token');

let counter = 0;
export const uniq = (prefix = 'e2e') => `${prefix}_${Date.now().toString(36)}${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
