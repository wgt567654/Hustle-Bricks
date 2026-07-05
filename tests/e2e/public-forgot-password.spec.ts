/**
 * Forgot-password flow smoke tests (public, no auth required).
 * The Supabase mailer is rate-limited in dev, so submitting may show either
 * the success state or the friendly rate-limit error — both are acceptable.
 */
import { test, expect } from '@playwright/test';

test.describe('Forgot password', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('login page links to /forgot-password', async ({ page }) => {
    await page.goto('/login');
    const link = page.locator('a[href="/forgot-password"]');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('submitting an email shows success state or friendly rate-limit error', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('input[type="email"]').fill(`e2e-bogus-${Date.now()}@example.com`);
    await page.locator('button[type="submit"]').click();

    // Success: "Check your inbox" — or the friendly rate-limit message when the
    // dev mailer has hit its quota. Either outcome proves the form round-trips.
    const success = page.getByText('Check your inbox');
    const rateLimited = page.getByText(/Too many reset emails|rate limit/i);
    await expect(success.or(rateLimited).first()).toBeVisible({ timeout: 15000 });
  });
});
