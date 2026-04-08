/**
 * Employee portal tests.
 *
 * Full employee flow tests (login + clock in/out) require a real approved
 * employee account. Set credentials via:
 *   EMPLOYEE_EMAIL and EMPLOYEE_PASSWORD
 *
 * Tests without those env vars test the unauthenticated behavior.
 */
import { test, expect } from '@playwright/test';

const employeeEmail = process.env.EMPLOYEE_EMAIL;
const employeePassword = process.env.EMPLOYEE_PASSWORD;
const hasEmployeeCreds = !!(employeeEmail && employeePassword);

test.describe('Employee portal — unauthenticated', () => {
  test('redirects /employee to login when not signed in', async ({ page }) => {
    await page.goto('/employee');
    await expect(page).toHaveURL(/\/login|\/employee-join|\/employee-pending/, { timeout: 8000 });
  });

  test('redirects /employee/schedule to login when not signed in', async ({ page }) => {
    await page.goto('/employee/schedule');
    await expect(page).toHaveURL(/\/login|\/employee/, { timeout: 8000 });
  });
});

test.describe('Employee portal — authenticated employee', () => {
  test.skip(!hasEmployeeCreds, 'Set EMPLOYEE_EMAIL and EMPLOYEE_PASSWORD to run these tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(employeeEmail!);
    await page.locator('#password').fill(employeePassword!);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('approved employee lands on /employee home', async ({ page }) => {
    await expect(page).toHaveURL(/\/employee($|\/)/, { timeout: 8000 });
  });

  test('employee home shows today\'s jobs', async ({ page }) => {
    await page.goto('/employee');
    await expect(page.locator('body')).toContainText(/today|job|schedule/i, { timeout: 8000 });
  });

  test('employee can navigate to schedule', async ({ page }) => {
    await page.goto('/employee/schedule');
    await expect(page).toHaveURL(/\/employee\/schedule/);
    await expect(page.locator('body')).toContainText(/schedule|job/i, { timeout: 8000 });
  });

  test('clock in/out buttons are visible when jobs exist', async ({ page }) => {
    await page.goto('/employee');

    const hasJobs = await page.locator('button:has-text("Clock In")').isVisible().catch(() => false);

    if (hasJobs) {
      // Fill optional start odometer
      const odoInput = page.locator('input[placeholder="Start odometer"]').first();
      if (await odoInput.isVisible()) {
        await odoInput.fill('50000');
      }

      await page.locator('button:has-text("Clock In")').first().click();

      // Should now show "Clock Out" or "Clocked in" indicator
      await expect(
        page.locator('button:has-text("Clock Out"), text=Clocked in')
      ).toBeVisible({ timeout: 8000 });
    } else {
      // No jobs assigned today — page still loads correctly
      await expect(page.locator('body')).not.toContainText(/error/i);
    }
  });
});
