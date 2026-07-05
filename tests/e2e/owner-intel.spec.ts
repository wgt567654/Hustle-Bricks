/**
 * Competitor Intel tests.
 * Covers: /intel page loading, empty state, nav link, and (if employee job
 * exists) the Report Competitor flow on the employee job detail page.
 */
import { test, expect } from '@playwright/test';

test.describe('Intel page (owner)', () => {
  test('page loads with Competitor Intel heading', async ({ page }) => {
    await page.goto('/intel');
    await expect(page.locator('h1')).toContainText('Competitor Intel', { timeout: 10000 });
  });

  test('shows empty state or feed after load', async ({ page }) => {
    await page.goto('/intel');
    await expect(page.locator('h1')).toContainText('Competitor Intel', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const hasEmpty = await page.locator('text=No intel yet').isVisible().catch(() => false);
    const hasFeed  = await page.locator('.rounded-2xl.border.border-border.bg-card.shadow-sm').first().isVisible().catch(() => false);
    expect(hasEmpty || hasFeed).toBe(true);
  });

  test('appears in the Field navigation', async ({ page }) => {
    // Intel now lives in the Field group's sub-navigation (visible on Field pages)
    await page.goto('/heatmap');
    const intelLink = page.locator('nav a[href="/intel"]').first();
    await expect(intelLink).toBeVisible({ timeout: 5000 });
    await intelLink.click();
    await expect(page).toHaveURL(/\/intel/, { timeout: 8000 });
  });

  test('All filter chip is visible when intel exists', async ({ page }) => {
    await page.goto('/intel');
    await expect(page.locator('h1')).toContainText('Competitor Intel', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Only assert if there are actual rows (otherwise All chip is hidden)
    const hasFeed = await page.locator('.rounded-2xl.border.border-border.bg-card.shadow-sm').first().isVisible().catch(() => false);
    if (hasFeed) {
      await expect(page.locator('button', { hasText: /^All \(/ })).toBeVisible();
    }
  });
});
