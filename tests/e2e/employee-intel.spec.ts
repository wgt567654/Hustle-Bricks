/**
 * Competitor Intel — employee submission flow.
 * Logs in as an employee, navigates to a job detail page, and submits intel.
 * Requires EMPLOYEE_EMAIL and EMPLOYEE_PASSWORD in .env.test.
 */
import { test, expect } from '@playwright/test';

const employeeEmail    = process.env.EMPLOYEE_EMAIL;
const employeePassword = process.env.EMPLOYEE_PASSWORD;
const hasEmployeeCreds = !!(employeeEmail && employeePassword);

test.describe('Competitor Intel — employee submission', () => {
  test.skip(!hasEmployeeCreds, 'Set EMPLOYEE_EMAIL and EMPLOYEE_PASSWORD to run these tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(employeeEmail!);
    await page.locator('#password').fill(employeePassword!);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('Report Competitor section is visible on a job detail page', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForTimeout(2000);

    // Find the first job link on the employee home or schedule
    const jobLink = page.locator('a[href^="/employee/jobs/"]').first();
    const hasJob = await jobLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasJob) {
      // Try schedule page
      await page.goto('/employee/schedule');
      await page.waitForTimeout(2000);
      const schedLink = page.locator('a[href^="/employee/jobs/"]').first();
      if (!await schedLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip(); // No jobs assigned to this employee
        return;
      }
      await schedLink.click();
    } else {
      await jobLink.click();
    }

    await page.waitForURL(/\/employee\/jobs\//, { timeout: 8000 });
    await expect(page.locator('text=Competitive Intel')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button:has-text("Report Competitor")')).toBeVisible();
  });

  test('can submit competitor intel from a job', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForTimeout(2000);

    let jobLink = page.locator('a[href^="/employee/jobs/"]').first();
    let hasJob = await jobLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasJob) {
      await page.goto('/employee/schedule');
      await page.waitForTimeout(2000);
      jobLink = page.locator('a[href^="/employee/jobs/"]').first();
      hasJob = await jobLink.isVisible({ timeout: 3000 }).catch(() => false);
      if (!hasJob) { test.skip(); return; }
    }

    await jobLink.click();
    await page.waitForURL(/\/employee\/jobs\//, { timeout: 8000 });

    // Open the intel form
    await page.locator('button:has-text("Report Competitor")').click();
    await expect(page.locator('input[placeholder*="Green Clean"]')).toBeVisible({ timeout: 3000 });

    // Fill out the form
    await page.locator('input[placeholder*="Green Clean"]').fill('TestRival Co');

    // Select "Price info" type
    await page.locator('button:has-text("Price info")').click();
    await expect(page.locator('input[placeholder="0"]')).toBeVisible();
    await page.locator('input[placeholder="0"]').fill('150');

    // Add notes
    await page.locator('textarea[placeholder*="extra details"]').fill('Customer said they were quoted $150 for same service');

    // Submit
    await page.locator('button:has-text("Log Intel")').click();

    // Success message
    await expect(page.locator('text=Intel logged!')).toBeVisible({ timeout: 5000 });

    // Form should close (back to the card)
    await expect(page.locator('button:has-text("Report Competitor")')).toBeVisible({ timeout: 3000 });
  });
});
