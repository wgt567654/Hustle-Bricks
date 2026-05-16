/**
 * Weather-Triggered Job Alerts tests.
 * Covers: jobs page loads, settings city field, weather API returns valid shape.
 */
import { test, expect } from '@playwright/test';

test.describe('Weather alerts — settings', () => {
  test('jobs page loads without error', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  });

  test('settings page has Service Area City field', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
    await expect(page.locator('text=Service Areas')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Weather alerts — API', () => {
  test('weather-alerts API returns valid shape for known city', async ({ request }) => {
    const res = await request.get('/api/weather-alerts?city=Denver%2C+CO');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('risk');
    expect(Array.isArray(body.risk)).toBe(true);
    if (body.risk.length > 0) {
      const day = body.risk[0];
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('hasRisk');
      expect(typeof day.hasRisk).toBe('boolean');
    }
  });

  test('weather-alerts API returns empty for missing city param', async ({ request }) => {
    const res = await request.get('/api/weather-alerts');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.risk).toEqual([]);
  });

  test('weather-alerts API returns empty for unknown city', async ({ request }) => {
    const res = await request.get('/api/weather-alerts?city=ZZZNotACity12345');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.risk).toEqual([]);
  });
});
