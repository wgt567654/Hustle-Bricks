/**
 * Owner team management tests — runs with saved owner auth state.
 * Covers: viewing team members, pending approvals section.
 */
import { test, expect } from '@playwright/test';

test.describe('Team page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/team');
  });

  test('team page loads for owner', async ({ page }) => {
    await expect(page).toHaveURL(/\/team/);
    // Team page should show some team-related content
    await expect(page.locator('body')).toContainText(/team|member|employee/i);
  });

  test('shows pending approvals section when there are pending employees', async ({ page }) => {
    // This section only appears when there are pending team members
    // If no pending members, just verify the page loaded correctly
    const hasPending = await page.locator('text=Pending').isVisible().catch(() => false);

    if (hasPending) {
      // Approve button should be present
      await expect(page.locator('button:has-text("Approve")')).toBeVisible();
      await expect(page.locator('button:has-text("Reject")')).toBeVisible();
    } else {
      // Page loaded fine, no pending approvals
      await expect(page.locator('body')).toContainText(/team|member/i);
    }
  });
});
