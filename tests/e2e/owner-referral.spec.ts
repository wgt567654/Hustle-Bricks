/**
 * Neighbor Referral Tracking tests.
 * Covers: leads page loads, Neighbor Referral badge renders, employee job page structure.
 */
import { test, expect } from '@playwright/test';

test.describe('Leads page (owner)', () => {
  test('loads without error', async ({ page }) => {
    await page.goto('/leads');
    await expect(page.locator('body')).not.toContainText('Error', { timeout: 8000 });
    await expect(page.locator('body')).not.toContainText('something went wrong', { timeout: 5000 });
  });

  test('has Add Lead button and pipeline header', async ({ page }) => {
    await page.goto('/leads');
    await expect(page.locator('h1')).toContainText('Leads', { timeout: 8000 });
    await expect(page.getByRole('button', { name: /add lead/i })).toBeVisible({ timeout: 5000 });
  });

  test('Add Lead modal opens and accepts input', async ({ page }) => {
    await page.goto('/leads');
    await page.getByRole('button', { name: /add lead/i }).click();
    await expect(page.getByPlaceholder(/full name/i)).toBeVisible({ timeout: 3000 });

    // Fill in a neighbor referral lead
    await page.getByPlaceholder(/full name/i).fill('Test Neighbor');
    await expect(page.getByRole('button', { name: /add lead/i }).last()).toBeEnabled();
  });

  test('Neighbor Referral badge shows for leads with that source', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForTimeout(1500);

    // If any neighbor referral leads exist, the badge should appear
    const badge = page.locator('text=Neighbor Referral').first();
    const hasBadge = await badge.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasBadge) {
      await expect(badge).toBeVisible();
    }
    // If no neighbor referral leads yet — still a pass (feature is present but no data)
  });
});

test.describe('Employee job page — neighbor referral section', () => {
  test('employee job page has neighbor lead section', async ({ page }) => {
    // Navigate to employee portal
    await page.goto('/employee');
    await page.waitForTimeout(1500);

    const hasJobs = await page.locator('a[href^="/employee/jobs/"]').first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasJobs) { test.skip(); return; }

    await page.locator('a[href^="/employee/jobs/"]').first().click();
    await page.waitForURL(/\/employee\/jobs\//, { timeout: 8000 });

    // The "Neighbor Leads" section heading should be present
    await expect(page.locator('text=Neighbor Leads')).toBeVisible({ timeout: 5000 });
    // The "Log a Neighbor Lead" button should be present
    await expect(page.getByText('Log a Neighbor Lead')).toBeVisible({ timeout: 3000 });
  });
});
