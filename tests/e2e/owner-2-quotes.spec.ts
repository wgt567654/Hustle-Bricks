/**
 * Tests the Quotes flow — new quote form, quote detail, and status actions.
 * Requires at least one client and one service to exist; skips data-creation
 * tests gracefully when no services are configured.
 */
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Quotes — new quote page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/quotes/new');
    await page.waitForLoadState('networkidle');
  });

  test('new quote page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/quotes\/new/);
    // Either the form loads or the "no services" empty state
    const hasForm = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    const hasEmptyState = await page.locator('button:has-text("Go to Services")').isVisible().catch(() => false);
    expect(hasForm || hasEmptyState).toBe(true);
  });

  test('shows client selector when services exist', async ({ page }) => {
    const hasServices = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasServices, 'No services configured — skipping form tests');

    await expect(page.locator('button:has-text("Select a client…")')).toBeVisible();
  });

  test('tax toggle defaults to OFF', async ({ page }) => {
    const hasServices = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasServices, 'No services configured');

    await expect(page.locator('button').filter({ hasText: /^OFF$/ })).toBeVisible();
  });

  test('discount input has correct placeholder', async ({ page }) => {
    const hasServices = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasServices, 'No services configured');

    await expect(page.locator('input[placeholder="0.00"]')).toBeVisible();
  });

  test('notes textarea has correct placeholder', async ({ page }) => {
    const hasServices = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasServices, 'No services configured');

    await expect(page.locator('textarea[placeholder="Add a note for the client (optional)…"]')).toBeVisible();
  });

  test('client picker modal opens with search input', async ({ page }) => {
    const hasServices = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasServices, 'No services configured');

    await page.locator('button:has-text("Select a client…")').click();
    await expect(page.locator('h2:has-text("Select Client")')).toBeVisible();
    await expect(page.locator('input[placeholder="Search clients…"]')).toBeVisible();
  });

  test('selecting a client closes picker and shows client name', async ({ page }) => {
    const hasServices = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasServices, 'No services configured');

    await page.locator('button:has-text("Select a client…")').click();
    await expect(page.locator('h2:has-text("Select Client")')).toBeVisible();

    // Click the first client in the list
    const firstClient = page.locator('.overflow-y-auto button').first();
    const hasClients = await firstClient.isVisible().catch(() => false);
    test.skip(!hasClients, 'No clients in picker');

    const clientName = await firstClient.locator('p.font-bold').textContent();
    await firstClient.click();

    await expect(page.locator('h2:has-text("Select Client")')).not.toBeVisible();
    if (clientName) {
      await expect(page.locator(`text=${clientName.trim()}`)).toBeVisible();
    }
  });

  test('tax toggle switches ON then OFF', async ({ page }) => {
    const hasServices = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasServices, 'No services configured');

    // Use exact-match filter to avoid matching buttons that contain "on" as a substring
    const taxOff = page.locator('button').filter({ hasText: /^OFF$/ });
    await expect(taxOff).toBeVisible();
    await taxOff.click();
    const taxOn = page.locator('button').filter({ hasText: /^ON$/ });
    await expect(taxOn).toBeVisible();
    await taxOn.click();
    await expect(page.locator('button').filter({ hasText: /^OFF$/ })).toBeVisible();
  });

  test('clicking a service card adds it to line items', async ({ page }) => {
    const hasServices = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasServices, 'No services configured');

    // Find the first service card (div with cursor-pointer inside Add Services section)
    const serviceCard = page
      .locator('section')
      .filter({ has: page.locator('h3:has-text("Add Services")') })
      .locator('div.cursor-pointer')
      .first();

    const hasCard = await serviceCard.isVisible().catch(() => false);
    test.skip(!hasCard, 'No service cards visible');

    await serviceCard.click();

    // A blue qty badge (rounded-full bg-[#007AFF]) should appear on the card
    await expect(serviceCard.locator('div.rounded-full.bg-\\[\\#007AFF\\]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Quotes — create and view quote detail', () => {
  let quoteUrl = '';

  test('creates a draft quote and lands on /sales', async ({ page }) => {
    await page.goto('/quotes/new');
    await page.waitForLoadState('networkidle');

    const hasForm = await page.locator('h1:has-text("New Quote")').isVisible().catch(() => false);
    test.skip(!hasForm, 'No services configured');

    // Select first client
    await page.locator('button:has-text("Select a client…")').click();
    const firstClient = page.locator('.overflow-y-auto button').first();
    const hasClients = await firstClient.isVisible().catch(() => false);
    test.skip(!hasClients, 'No clients available');
    await firstClient.click();

    // Add first service
    const serviceCard = page
      .locator('section')
      .filter({ has: page.locator('h3:has-text("Add Services")') })
      .locator('div.cursor-pointer')
      .first();
    await serviceCard.click();

    // Save as draft
    await page.locator('button:has-text("Save Draft")').click();

    // Should redirect to /sales
    await page.waitForURL(/\/sales/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/sales/);
  });

  test('sales page shows quote cards', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/sales/);
    // Either quotes exist or empty state
    const hasQuotes = await page.locator('.cursor-pointer.rounded-2xl').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=No quotes yet').isVisible().catch(() => false);
    expect(hasQuotes || hasEmpty).toBe(true);
  });

  test('clicking a quote card navigates to quote detail', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');

    const firstCard = page.locator('div.cursor-pointer.rounded-2xl').first();
    const hasCards = await firstCard.isVisible().catch(() => false);
    test.skip(!hasCards, 'No quote cards on /sales');

    await firstCard.click();
    await page.waitForURL(/\/quotes\//, { timeout: 8000 });
    quoteUrl = page.url();
    expect(page.url()).toMatch(/\/quotes\/.+/);
  });

  test('quote detail shows a status badge', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');

    const firstCard = page.locator('div.cursor-pointer.rounded-2xl').first();
    const hasCards = await firstCard.isVisible().catch(() => false);
    test.skip(!hasCards, 'No quote cards on /sales');

    await firstCard.click();
    await page.waitForURL(/\/quotes\//, { timeout: 8000 });
    await page.waitForLoadState('networkidle');

    // Badge should contain one of the known status labels
    const body = page.locator('body');
    await expect(body).toContainText(/Draft|Quote Sent|Won|Lost/, { timeout: 8000 });
  });

  test('draft quote has Send Quote button', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');

    // Find a draft quote card specifically
    const draftCard = page.locator('div.cursor-pointer.rounded-2xl').filter({ has: page.locator('text=Draft') }).first();
    const hasDraft = await draftCard.isVisible().catch(() => false);
    test.skip(!hasDraft, 'No draft quotes on /sales');

    await draftCard.click();
    await page.waitForURL(/\/quotes\//, { timeout: 8000 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has-text("Send Quote")')).toBeVisible({ timeout: 5000 });
  });
});
