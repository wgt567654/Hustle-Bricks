/**
 * Owner dashboard smoke tests — runs with saved owner auth state.
 * Verifies core pages load and are accessible.
 */
import { test, expect } from '@playwright/test';

const ownerRoutes = [
  { path: '/', label: /dashboard|jobs|clients/i },
  { path: '/jobs', label: /jobs/i },
  { path: '/clients', label: /clients/i },
  { path: '/payments', label: /payments/i },
  { path: '/team', label: /team/i },
  { path: '/settings', label: /settings/i },
];

test.describe('Owner dashboard smoke tests', () => {
  for (const { path, label } of ownerRoutes) {
    test(`${path} loads`, async ({ page }) => {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
      await expect(page.locator('body')).toContainText(label, { timeout: 8000 });
    });
  }
});

test.describe('Owner navigation', () => {
  test('is not redirected to employee portal', async ({ page }) => {
    await page.goto('/');
    // Owner should NOT be redirected to /employee
    await expect(page).not.toHaveURL(/\/employee($|\/)/);
  });
});
