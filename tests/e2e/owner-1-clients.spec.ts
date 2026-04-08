/**
 * Tests the Clients page — list, search, filter, add, and delete.
 * Creates a uniquely named test client and cleans it up at the end.
 */
import { test, expect } from '@playwright/test';

const TEST_CLIENT_NAME = `E2E Test Client ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Clients page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
  });

  test('clients page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/clients/);
    await expect(page.locator('h1:has-text("Clients")')).toBeVisible();
  });

  test('search input is visible', async ({ page }) => {
    await expect(
      page.locator('input[placeholder="Search by name, email, or phone…"]')
    ).toBeVisible();
  });

  test('filter tabs are visible', async ({ page }) => {
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Residential")')).toBeVisible();
    await expect(page.locator('button:has-text("Commercial")')).toBeVisible();
    await expect(page.locator('button:has-text("VIPs")')).toBeVisible();
  });

  test('floating add button opens New Client modal', async ({ page }) => {
    await page.locator('button:has(span.material-symbols-outlined:text("person_add"))').click();
    await expect(page.locator('h2:has-text("New Client")')).toBeVisible();
  });

  test('modal has correct form fields', async ({ page }) => {
    await page.locator('button:has(span.material-symbols-outlined:text("person_add"))').click();
    await expect(page.locator('input[placeholder="e.g. John Smith"]')).toBeVisible();
    await expect(page.locator('input[placeholder="(555) 000-0000"]')).toBeVisible();
    await expect(page.locator('input[placeholder="john@example.com"]')).toBeVisible();
  });

  test('submit button is disabled when name is empty', async ({ page }) => {
    await page.locator('button:has(span.material-symbols-outlined:text("person_add"))').click();
    const submitBtn = page.locator('button:has-text("Add Client")');
    await expect(submitBtn).toBeDisabled();
  });

  test('creates a new client and it appears in the list', async ({ page }) => {
    await page.locator('button:has(span.material-symbols-outlined:text("person_add"))').click();

    await page.locator('input[placeholder="e.g. John Smith"]').fill(TEST_CLIENT_NAME);

    // Select VIP type inside the modal
    const modal = page.locator('.rounded-t-3xl');
    await modal.locator('button:has-text("VIP")').click();

    await page.locator('button:has-text("Add Client")').click();

    // Modal should close and client should appear
    await expect(page.locator('h2:has-text("New Client")')).not.toBeVisible({ timeout: 8000 });
    await expect(page.locator(`h3:has-text("${TEST_CLIENT_NAME}")`)).toBeVisible({ timeout: 8000 });
  });

  test('search finds the created client', async ({ page }) => {
    await page.locator('input[placeholder="Search by name, email, or phone…"]').fill('E2E Test Client');
    await expect(page.locator(`h3:has-text("${TEST_CLIENT_NAME}")`)).toBeVisible();
  });

  test('VIPs filter shows the created client', async ({ page }) => {
    await page.locator('button:has-text("VIPs")').click();
    await expect(page.locator(`h3:has-text("${TEST_CLIENT_NAME}")`)).toBeVisible();
  });

  test('deletes the test client', async ({ page }) => {
    // Search to isolate the test client
    await page.locator('input[placeholder="Search by name, email, or phone…"]').fill('E2E Test Client');
    await expect(page.locator(`h3:has-text("${TEST_CLIENT_NAME}")`)).toBeVisible();

    // Delete button is opacity-0 — use force:true to click it directly
    const deleteBtn = page
      .locator('button')
      .filter({ has: page.locator('span.material-symbols-outlined:text("delete")') })
      .first();

    await deleteBtn.click({ force: true });

    // Client should disappear from the list
    await expect(page.locator(`h3:has-text("${TEST_CLIENT_NAME}")`)).not.toBeVisible({ timeout: 8000 });
  });
});
