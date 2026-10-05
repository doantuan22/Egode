import { test, expect, fx, newAccount, ROLES, login } from '../support/fixtures';

test.afterAll(async () => {
  await fx('/cleanup');
});

test('harness: real frontend + real backend + test DB — a customer signs in through the login form', async ({ page }) => {
  const customer = await newAccount(ROLES.customer);
  await login(page, customer);
  await page.goto('/profile');
  await expect(page.getByLabel('Email')).toHaveValue(customer.email);
});
