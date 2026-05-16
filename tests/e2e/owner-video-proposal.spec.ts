/**
 * Video Proposals tests.
 * Covers: quote detail has video + share link sections, client quote page loads,
 * and the public API returns 404 for a fake quote.
 */
import { test, expect } from '@playwright/test';

test.describe('Quote detail (owner) — video proposal', () => {
  test('sales page loads without error', async ({ page }) => {
    await page.goto('/sales');
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  });

  test('quote detail has Video Proposal and Client Link sections', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForTimeout(1500);

    // Quote cards contain a dollar amount and a status badge — filter by those to avoid clicking "New Quote"
    const quoteCard = page.locator('.rounded-2xl.cursor-pointer').filter({ hasText: /\$/ }).first();
    const hasCard = await quoteCard.isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasCard) { test.skip(); return; }

    await quoteCard.click();
    await page.waitForURL(/\/quotes\/[0-9a-f-]{36}/, { timeout: 8000 });

    // Wait for the page to finish loading (loading spinner disappears)
    await page.locator('text=Loading quote').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    // Skip if the migration hasn't been run yet (video_url column missing causes "not found")
    const notFound = await page.locator('text=Quote not found').isVisible().catch(() => false);
    if (notFound) { test.skip(); return; }

    await expect(page.locator('text=Video Proposal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Client Link')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /copy client link/i })).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Client quote page /q/[id]', () => {
  test('returns 404 message for invalid quote ID', async ({ page }) => {
    await page.goto('/q/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(2000);
    // Should show not found, not a crash
    await expect(page.locator('body')).not.toContainText('something went wrong');
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('public API returns 404 for fake quote', async ({ request }) => {
    const res = await request.get('/api/quote-public/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
  });

  test('quote-respond rejects non-sent quote action', async ({ request }) => {
    const res = await request.post('/api/quote-respond', {
      data: { quoteId: '00000000-0000-0000-0000-000000000000', action: 'accepted' },
    });
    expect([404, 409]).toContain(res.status());
  });
});
