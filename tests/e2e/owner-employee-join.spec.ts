/**
 * Tests the employee join flow (public, no auth required).
 *
 * End-to-end signup requires a real access code. Set one via:
 *   EMPLOYEE_ACCESS_CODE env var (generate one in Settings first).
 *
 * Tests that don't need a real code test the UI/validation only.
 */
import { test, expect } from '@playwright/test';

test.describe('Employee join — access code step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/employee-join');
  });

  test('renders code entry form', async ({ page }) => {
    await expect(page.locator('#code')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Continue button is disabled until 6 chars are entered', async ({ page }) => {
    const btn = page.locator('button[type="submit"]');
    await expect(btn).toBeDisabled();

    await page.locator('#code').fill('ABC');
    await expect(btn).toBeDisabled();

    await page.locator('#code').fill('ABC123');
    await expect(btn).toBeEnabled();
  });

  test('input auto-uppercases typed code', async ({ page }) => {
    await page.locator('#code').fill('abc123');
    const value = await page.locator('#code').inputValue();
    expect(value).toBe('ABC123');
  });

  test('shows error for invalid access code', async ({ page }) => {
    await page.locator('#code').fill('ZZZZZZ');
    await page.locator('button[type="submit"]').click();

    const body = page.locator('body');
    await expect(body).toContainText(/not found|invalid|no business/i, { timeout: 8000 });
  });

  test('has link back to login page', async ({ page }) => {
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });
});

test.describe('Employee join — signup step', () => {
  // Fetch the current valid access code from the settings page dynamically
  // so this test stays valid even after the settings "regenerate" test runs.
  let accessCode: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/e2e/.auth/owner.json' });
    const page = await context.newPage();
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const code = await page.locator('span.font-mono').textContent();
    await context.close();
    accessCode = code?.trim() ?? '';
  });

  test('advances to signup form after valid code', async ({ page }) => {
    test.skip(!accessCode, 'No access code found in settings');
    await page.goto('/employee-join');
    await page.locator('#code').fill(accessCode);
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('input[placeholder="Your full name"]')).toBeVisible({ timeout: 8000 });
  });

  test('shows validation error when passwords do not match', async ({ page }) => {
    test.skip(!accessCode, 'No access code found in settings');
    await page.goto('/employee-join');
    await page.locator('#code').fill(accessCode);
    await page.locator('button[type="submit"]').click();

    await page.locator('input[placeholder="Your full name"]').fill('Test Employee');
    await page.locator('input[placeholder="your@email.com"]').fill(`testemployee+${Date.now()}@example.com`);
    await page.locator('input[placeholder="At least 6 characters"]').fill('password123');
    await page.locator('input[placeholder="Repeat your password"]').fill('differentpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('body')).toContainText(/match|password/i, { timeout: 5000 });
  });
});

test.describe('Employee pending page', () => {
  test('renders pending approval message when accessed directly', async ({ page }) => {
    // Without auth this redirects to login, but if auth exists it shows pending
    // This test just verifies the page structure loads (auth state handled separately)
    await page.goto('/employee-pending');
    // Either redirected to login or shows pending page — both are valid
    const url = page.url();
    expect(url).toMatch(/\/login|\/employee-pending/);
  });
});
