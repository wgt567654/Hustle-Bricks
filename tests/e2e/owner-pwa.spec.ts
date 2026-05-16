/**
 * PWA / Offline Mode tests.
 * Covers: manifest accessible, service worker registered, offline page renders.
 */
import { test, expect } from '@playwright/test';

test.describe('PWA — manifest', () => {
  test('manifest.json is accessible and has required fields', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toBeTruthy();
    expect(json.short_name).toBeTruthy();
    expect(json.start_url).toBeTruthy();
    expect(json.display).toBe('standalone');
    expect(Array.isArray(json.icons)).toBe(true);
    expect(json.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('PWA icons are accessible', async ({ request }) => {
    const icon192 = await request.get('/icon-192.png');
    expect(icon192.status()).toBe(200);

    const icon512 = await request.get('/icon-512.png');
    expect(icon512.status()).toBe(200);
  });
});

test.describe('PWA — offline page', () => {
  test('offline page renders without error', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.locator('body')).not.toContainText('500', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /offline/i })).toBeVisible({ timeout: 5000 });
  });

  test('offline page has try-again button', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.locator('text=Try again')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('PWA — service worker', () => {
  test('service worker file is accessible', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toMatch(/javascript|text/);
    const body = await res.text();
    // Verify key SW lifecycle events are present
    expect(body).toContain('install');
    expect(body).toContain('fetch');
  });
});
