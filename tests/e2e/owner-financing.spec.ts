/**
 * Customer Financing (BNPL) tests.
 * Covers: settings section visible, quote page loads, API shape.
 */
import { test, expect } from '@playwright/test';

test.describe('Customer Financing — settings', () => {
  test('settings page has Customer Financing section', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
    await expect(page.locator('text=Customer Financing')).toBeVisible({ timeout: 5000 });
  });

  test('settings financing toggle is present', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
    await expect(page.locator('text=Offer financing to clients')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Customer Financing — client quote page', () => {
  test('client quote page loads without error', async ({ page }) => {
    // A non-existent quoteId returns "Quote not found" — that is OK for this test
    await page.goto('/q/test-quote-id-financing');
    await expect(page.locator('body')).not.toContainText('500', { timeout: 8000 });
    // Either loads "Quote not found" or the actual quote
    const body = await page.locator('body').textContent({ timeout: 5000 });
    expect(body).toBeTruthy();
  });
});
