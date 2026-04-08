/**
 * Tests the Payments page — hero card, filter tabs, unpaid/paid lists, and Mark Paid modal.
 * Non-destructive: the payment modal is opened and closed without confirming.
 */
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Payments page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
  });

  test('payments page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/payments/);
    await expect(page.locator('h1:has-text("Payments")')).toBeVisible();
  });

  test('Total Earned hero card is visible', async ({ page }) => {
    await expect(page.locator('text=Total Earned')).toBeVisible();
  });

  test('Unpaid and Paid filter tabs are visible', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: /^Unpaid/ })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /^Paid/ }).last()).toBeVisible();
  });

  test('switching between tabs works without error', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Paid/ }).last().click();
    await expect(page.locator('h1:has-text("Payments")')).toBeVisible();
    await page.locator('button').filter({ hasText: /^Unpaid/ }).click();
    await expect(page.locator('h1:has-text("Payments")')).toBeVisible();
  });

  test('Unpaid tab shows job cards or empty state', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Unpaid/ }).click();
    const hasCards = await page.locator('.rounded-2xl.overflow-hidden').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=All caught up — nothing unpaid!').isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
  });

  test('Paid tab shows job cards or empty state', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Paid/ }).last().click();
    const hasCards = await page.locator('.rounded-2xl.overflow-hidden').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=No paid jobs yet').isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
  });
});

test.describe('Payments — Mark Paid modal', () => {
  test('Mark Paid button is visible on unpaid job cards', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: /^Unpaid/ }).click();

    const markPaidBtn = page.locator('button:has-text("Mark Paid")').first();
    const hasUnpaid = await markPaidBtn.isVisible().catch(() => false);
    test.skip(!hasUnpaid, 'No unpaid jobs — skipping modal tests');

    await expect(markPaidBtn).toBeVisible();
  });

  test('clicking Mark Paid opens payment modal', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: /^Unpaid/ }).click();

    const markPaidBtn = page.locator('button:has-text("Mark Paid")').first();
    const hasUnpaid = await markPaidBtn.isVisible().catch(() => false);
    test.skip(!hasUnpaid, 'No unpaid jobs');

    await markPaidBtn.click();
    await expect(page.locator('text=Collect Payment')).toBeVisible({ timeout: 5000 });
  });

  test('payment modal shows client name, amount input, and 6 method buttons', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: /^Unpaid/ }).click();

    const markPaidBtn = page.locator('button:has-text("Mark Paid")').first();
    const hasUnpaid = await markPaidBtn.isVisible().catch(() => false);
    test.skip(!hasUnpaid, 'No unpaid jobs');

    await markPaidBtn.click();
    await expect(page.locator('text=Collect Payment')).toBeVisible({ timeout: 5000 });

    // Amount input
    await expect(page.locator('.fixed input[type="number"]')).toBeVisible();

    // 6 method buttons
    await expect(page.locator('.fixed button:has-text("Cash")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Card")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Check")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Venmo")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Zelle")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Other")')).toBeVisible();
  });

  test('selecting a method highlights it', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: /^Unpaid/ }).click();

    const markPaidBtn = page.locator('button:has-text("Mark Paid")').first();
    const hasUnpaid = await markPaidBtn.isVisible().catch(() => false);
    test.skip(!hasUnpaid, 'No unpaid jobs');

    await markPaidBtn.click();
    await expect(page.locator('.fixed button:has-text("Card")')).toBeVisible({ timeout: 5000 });
    await page.locator('.fixed button:has-text("Card")').click();

    // The selected button should have the green highlight class
    await expect(page.locator('.fixed button:has-text("Card")')).toHaveClass(/bg-\[#16a34a\]/, { timeout: 3000 });
  });

  test('confirm button shows correct text format', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: /^Unpaid/ }).click();

    const markPaidBtn = page.locator('button:has-text("Mark Paid")').first();
    const hasUnpaid = await markPaidBtn.isVisible().catch(() => false);
    test.skip(!hasUnpaid, 'No unpaid jobs');

    await markPaidBtn.click();
    await expect(page.locator('text=Collect Payment')).toBeVisible({ timeout: 5000 });

    // Confirm button: "Record $X.XX · Method"
    const confirmBtn = page.locator('.fixed button').filter({ hasText: /Record \$[\d.]+ · \w+/ });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
  });

  test('close button dismisses payment modal', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: /^Unpaid/ }).click();

    const markPaidBtn = page.locator('button:has-text("Mark Paid")').first();
    const hasUnpaid = await markPaidBtn.isVisible().catch(() => false);
    test.skip(!hasUnpaid, 'No unpaid jobs');

    await markPaidBtn.click();
    await expect(page.locator('text=Collect Payment')).toBeVisible({ timeout: 5000 });

    const closeBtn = page.locator('.fixed button')
      .filter({ has: page.locator('span.material-symbols-outlined:text("close")') });
    await closeBtn.click();

    await expect(page.locator('.fixed input[type="number"]')).not.toBeVisible({ timeout: 5000 });
  });
});
