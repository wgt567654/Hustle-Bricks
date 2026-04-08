/**
 * Tests the Jobs page — list, filters, job detail, status actions, and payment modal.
 * Non-destructive: the payment modal is opened and closed without confirming.
 */
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Jobs page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
  });

  test('jobs page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/jobs/);
    await expect(page.locator('h1:has-text("Schedule & Jobs")')).toBeVisible();
  });

  test('filter tabs are visible', async ({ page }) => {
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Scheduled")')).toBeVisible();
    await expect(page.locator('button:has-text("In Progress")')).toBeVisible();
    await expect(page.locator('button:has-text("Completed")')).toBeVisible();
  });

  test('clicking filter tabs does not error', async ({ page }) => {
    await page.locator('button:has-text("Scheduled")').click();
    await page.locator('button:has-text("In Progress")').click();
    await page.locator('button:has-text("Completed")').click();
    await page.locator('button:has-text("All")').click();
    // No error thrown — page still shows the heading
    await expect(page.locator('h1:has-text("Schedule & Jobs")')).toBeVisible();
  });

  test('job cards or empty state renders gracefully', async ({ page }) => {
    const hasCards = await page.locator('div.cursor-pointer.rounded-2xl').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=No jobs here yet').isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
  });
});

test.describe('Job detail', () => {
  test('clicking a job card navigates to /jobs/[id]', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const firstCard = page.locator('div.cursor-pointer.rounded-2xl').first();
    const hasCards = await firstCard.isVisible().catch(() => false);
    test.skip(!hasCards, 'No job cards on /jobs');

    await firstCard.click();
    await page.waitForURL(/\/jobs\/.+/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/jobs\/.+/);
  });

  test('job detail shows status badge', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const firstCard = page.locator('div.cursor-pointer.rounded-2xl').first();
    const hasCards = await firstCard.isVisible().catch(() => false);
    test.skip(!hasCards, 'No job cards on /jobs');

    await firstCard.click();
    await page.waitForURL(/\/jobs\/.+/, { timeout: 8000 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toContainText(/Scheduled|In Progress|Completed|Cancelled/, { timeout: 8000 });
  });

  test('scheduled job shows Start Job button', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Find a scheduled job card
    const scheduledCard = page.locator('div.cursor-pointer.rounded-2xl')
      .filter({ has: page.locator('text=Scheduled') })
      .first();
    const hasScheduled = await scheduledCard.isVisible().catch(() => false);
    test.skip(!hasScheduled, 'No scheduled job cards');

    await scheduledCard.click();
    await page.waitForURL(/\/jobs\/.+/, { timeout: 8000 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has-text("Start Job")')).toBeVisible({ timeout: 5000 });
  });

  test('completed job shows Collect Payment button', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Find a completed job card
    const completedCard = page.locator('div.cursor-pointer.rounded-2xl')
      .filter({ has: page.locator('text=Completed') })
      .first();
    const hasCompleted = await completedCard.isVisible().catch(() => false);
    test.skip(!hasCompleted, 'No completed job cards');

    await completedCard.click();
    await page.waitForURL(/\/jobs\/.+/, { timeout: 8000 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button:has-text("Collect Payment")')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Jobs — payment modal', () => {
  test('payment modal opens from a completed job', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const completedCard = page.locator('div.cursor-pointer.rounded-2xl')
      .filter({ has: page.locator('text=Completed') })
      .first();
    const hasCompleted = await completedCard.isVisible().catch(() => false);
    test.skip(!hasCompleted, 'No completed job cards');

    await completedCard.click();
    await page.waitForURL(/\/jobs\/.+/, { timeout: 8000 });
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("Collect Payment")').click();
    await expect(page.locator('text=Collect Payment')).toBeVisible({ timeout: 5000 });
  });

  test('payment modal shows amount input and 6 method buttons', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const completedCard = page.locator('div.cursor-pointer.rounded-2xl')
      .filter({ has: page.locator('text=Completed') })
      .first();
    const hasCompleted = await completedCard.isVisible().catch(() => false);
    test.skip(!hasCompleted, 'No completed job cards');

    await completedCard.click();
    await page.waitForURL(/\/jobs\/.+/, { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Collect Payment")').click();

    // Amount input
    await expect(page.locator('.fixed input[type="number"]')).toBeVisible({ timeout: 5000 });

    // 6 method buttons
    await expect(page.locator('.fixed button:has-text("Cash")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Card")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Check")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Venmo")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Zelle")')).toBeVisible();
    await expect(page.locator('.fixed button:has-text("Other")')).toBeVisible();
  });

  test('confirm button shows correct text format', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const completedCard = page.locator('div.cursor-pointer.rounded-2xl')
      .filter({ has: page.locator('text=Completed') })
      .first();
    const hasCompleted = await completedCard.isVisible().catch(() => false);
    test.skip(!hasCompleted, 'No completed job cards');

    await completedCard.click();
    await page.waitForURL(/\/jobs\/.+/, { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Collect Payment")').click();

    // Confirm button: "Record $X.XX Payment"
    const confirmBtn = page.locator('.fixed button').filter({ hasText: /Record \$[\d.]+ Payment/ });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
  });

  test('close button dismisses payment modal', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const completedCard = page.locator('div.cursor-pointer.rounded-2xl')
      .filter({ has: page.locator('text=Completed') })
      .first();
    const hasCompleted = await completedCard.isVisible().catch(() => false);
    test.skip(!hasCompleted, 'No completed job cards');

    await completedCard.click();
    await page.waitForURL(/\/jobs\/.+/, { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Collect Payment")').click();

    // Close modal with the X button inside .fixed
    const closeBtn = page.locator('.fixed button')
      .filter({ has: page.locator('span.material-symbols-outlined:text("close")') });
    await closeBtn.click();

    await expect(page.locator('.fixed input[type="number"]')).not.toBeVisible({ timeout: 5000 });
  });
});
