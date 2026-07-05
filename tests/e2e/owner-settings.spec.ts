/**
 * Owner settings tests — runs with saved owner auth state.
 * Covers: employee access code generation and copy.
 * Settings is now sectioned — the access code lives under Team & Access (?sec=team).
 */
import { test, expect } from '@playwright/test';

test.describe('Settings — Employee Access Code', () => {
  // The 6-char access code display (the booking-link slug is also font-mono,
  // so filter to the code format).
  const codeLocator = (page: import('@playwright/test').Page) =>
    page.locator('span.font-mono').filter({ hasText: /^[A-Z0-9]{6}$/ }).first();

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?sec=team');
    // Wait for async data (businessId, access code) to finish loading
    await page.waitForLoadState('networkidle');
    await page.locator('h3:has-text("Employee Access")').scrollIntoViewIfNeeded();
  });

  test('settings page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('h3:has-text("Employee Access")')).toBeVisible();
  });

  test('can generate an access code if none exists', async ({ page }) => {
    const generateBtn = page.locator('button:has-text("Generate Access Code")');
    const codeDisplay = codeLocator(page);

    const alreadyHasCode = await codeDisplay.isVisible().catch(() => false);

    if (!alreadyHasCode) {
      await expect(generateBtn).toBeVisible();
      await generateBtn.click();
      await expect(codeDisplay).toBeVisible({ timeout: 8000 });
    }

    // Either way, a 6-char code should now be displayed
    const code = await codeDisplay.textContent();
    expect(code?.trim()).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('can copy access code to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const codeDisplay = codeLocator(page);
    await expect(codeDisplay).toBeVisible({ timeout: 8000 });

    const code = await codeDisplay.textContent();

    await page.locator('button:has-text("Copy code")').click();
    await expect(page.locator('button:has-text("Copied!")')).toBeVisible({ timeout: 3000 });

    // Verify clipboard content matches the displayed code
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText.trim()).toBe(code?.trim());
  });

  test('can regenerate access code', async ({ page }) => {
    const codeDisplay = codeLocator(page);
    await expect(codeDisplay).toBeVisible({ timeout: 8000 });

    const oldCode = (await codeDisplay.textContent())?.trim() ?? '';

    await page.locator('button:has-text("Generate new code")').click();

    // Wait for the code to update
    await expect(async () => {
      const newCode = await codeDisplay.textContent();
      expect(newCode?.trim()).not.toBe(oldCode);
    }).toPass({ timeout: 8000 });

    const newCode = (await codeDisplay.textContent())?.trim() ?? '';
    expect(newCode).toMatch(/^[A-Z0-9]{6}$/);

  });
});
