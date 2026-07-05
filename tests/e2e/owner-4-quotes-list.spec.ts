/**
 * Quotes list page smoke tests.
 * Covers: /quotes renders the Quotes heading, summary cards (Open Value,
 * Win Rate), filter pills, and quote-card navigation to /quotes/[id].
 */
import { test, expect } from '@playwright/test';

test.describe('Quotes list page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quotes');
    await page.waitForLoadState('networkidle');
  });

  test('renders Quotes heading and summary cards', async ({ page }) => {
    await expect(page.locator('h1:has-text("Quotes")')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Open Value', { exact: true })).toBeVisible();
    await expect(page.getByText('Win Rate', { exact: true })).toBeVisible();
  });

  test('shows status filter pills with counts', async ({ page }) => {
    for (const label of ['All', 'Drafts', 'Sent', 'Accepted', 'Declined']) {
      await expect(
        page.locator('button').filter({ hasText: new RegExp(`^${label} \\(\\d+\\)$`) })
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('clicking a quote card navigates to the quote detail page', async ({ page }) => {
    const card = page.locator('.rounded-2xl.cursor-pointer').filter({ hasText: /\$/ }).first();
    const hasCard = await card.isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(!hasCard, 'No quotes exist to click');

    await card.click();
    await page.waitForURL(/\/quotes\/[0-9a-f-]{36}/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/quotes\/[0-9a-f-]{36}/);
  });
});
