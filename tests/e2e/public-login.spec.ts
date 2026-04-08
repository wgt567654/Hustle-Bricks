/**
 * Tests the login page UI and basic auth flows (no auth state required).
 */
import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');
  });

  test('renders login form', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows "Join your team" link to employee join page', async ({ page }) => {
    const joinLink = page.locator('a[href="/employee-join"]');
    await expect(joinLink).toBeVisible();
    await expect(joinLink).toHaveAttribute('href', '/employee-join');
  });

  test('shows error on bad credentials', async ({ page }) => {
    await page.locator('#email').fill('notareal@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Should stay on login and show an error
    await expect(page).toHaveURL(/\/login/);
    // Some kind of error text should appear
    const body = page.locator('body');
    await expect(body).toContainText(/invalid|incorrect|error|wrong/i, { timeout: 8000 });
  });

  test('submit button is enabled with any input', async ({ page }) => {
    const btn = page.locator('button[type="submit"]');
    // Fill both fields
    await page.locator('#email').fill('test@test.com');
    await page.locator('#password').fill('anypassword');
    await expect(btn).toBeEnabled();
  });
});
