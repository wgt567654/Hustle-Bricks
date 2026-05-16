/**
 * Territory Heat Map tests.
 * Covers: page loads, layer toggles visible, API returns valid shape.
 */
import { test, expect } from '@playwright/test';

test.describe('Territory Heat Map — page', () => {
  test('heatmap page loads without error', async ({ page }) => {
    await page.goto('/heatmap');
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  });

  test('heatmap page has layer toggle buttons', async ({ page }) => {
    await page.goto('/heatmap');
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
    await expect(page.locator('text=Job Density')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Avg Revenue')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Last Job')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Territory Heat Map — API', () => {
  test('heatmap-data API returns valid shape', async ({ request }) => {
    const res = await request.get('/api/heatmap-data');
    // Unauthenticated → 401; if session exists → 200 with zones array
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('zones');
      expect(Array.isArray(body.zones)).toBe(true);
      if (body.zones.length > 0) {
        const zone = body.zones[0];
        expect(zone).toHaveProperty('zip');
        expect(zone).toHaveProperty('jobCount');
        expect(zone).toHaveProperty('avgRevenue');
        expect(zone).toHaveProperty('daysSinceLastJob');
      }
    }
  });
});
