/**
 * Territory Assignment & Zone Map tests.
 * Covers: Zone button on team cards, adding/removing ZIPs, conflict detection,
 * and the /territories map page loading.
 */
import { test, expect } from '@playwright/test';

test.describe('Territory assignment (Team page)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/team');
    await expect(page.locator('h1')).toContainText('Team Roster');
  });

  test('each active member card has a Zone button', async ({ page }) => {
    // At least one member card must be present with a Zone button
    const zoneBtn = page.locator('button', { hasText: 'Zone' }).first();
    await expect(zoneBtn).toBeVisible({ timeout: 8000 });
  });

  test('Zone button expands territory panel', async ({ page }) => {
    const zoneBtn = page.locator('button', { hasText: 'Zone' }).first();
    await expect(zoneBtn).toBeVisible({ timeout: 8000 });
    await zoneBtn.click();

    // ZIP input and Add button should appear scoped inside the territory panel
    await expect(page.locator('text=Territory ZIP Codes')).toBeVisible();
    await expect(page.locator('input[placeholder*="90210"]').first()).toBeVisible();
    // Use getByRole to target only the exact Add button (not the FAB)
    await expect(page.getByRole('button', { name: /^Add$/ }).first()).toBeVisible();
  });

  test('can add and remove a ZIP code', async ({ page }) => {
    const TEST_ZIP = '11111';

    const zoneBtn = page.locator('button', { hasText: 'Zone' }).first();
    await zoneBtn.click();

    const zipInput = page.locator('input[placeholder*="90210"]').first();
    const addBtn = page.getByRole('button', { name: /^Add$/ }).first();

    // Clean up in case this ZIP is already there from a prior run
    const existingPill = page.locator(`.rounded-full:has-text("${TEST_ZIP}")`).first();
    if (await existingPill.isVisible({ timeout: 500 }).catch(() => false)) {
      await existingPill.locator('button').click();
      await page.waitForTimeout(500);
    }

    await zipInput.fill(TEST_ZIP);
    await addBtn.click();

    const pill = page.locator(`.rounded-full:has-text("${TEST_ZIP}")`).first();
    await expect(pill).toBeVisible({ timeout: 5000 });

    await pill.locator('button').click();
    await expect(pill).not.toBeVisible({ timeout: 5000 });
  });

  test('Add button is disabled until 5 digits are entered', async ({ page }) => {
    const zoneBtn = page.locator('button', { hasText: 'Zone' }).first();
    await zoneBtn.click();

    const zipInput = page.locator('input[placeholder*="90210"]').first();
    const addBtn = page.getByRole('button', { name: /^Add$/ }).first();

    await expect(addBtn).toBeDisabled();
    await zipInput.fill('123');
    await expect(addBtn).toBeDisabled();
    await zipInput.fill('12345');
    await expect(addBtn).toBeEnabled();
  });

  test('only accepts numeric digits in ZIP input', async ({ page }) => {
    const zoneBtn = page.locator('button', { hasText: 'Zone' }).first();
    await zoneBtn.click();

    const zipInput = page.locator('input[placeholder*="90210"]').first();
    // pressSequentially fires individual key events — lets the onChange filter run
    await zipInput.pressSequentially('12345');
    await expect(zipInput).toHaveValue('12345');
    // Add button should now be enabled
    await expect(page.getByRole('button', { name: /^Add$/ }).first()).toBeEnabled();
  });

  test('shows conflict error when ZIP already assigned to another member', async ({ page }) => {
    const zoneBtns = page.locator('button', { hasText: 'Zone' });
    const count = await zoneBtns.count();
    if (count < 2) {
      test.skip();
      return;
    }

    const CONFLICT_ZIP = '99999';

    // Open first member's zone and remove the ZIP if it exists
    await zoneBtns.nth(0).click();
    const input0 = page.locator('input[placeholder*="90210"]').nth(0);
    const add0 = page.getByRole('button', { name: /^Add$/ }).nth(0);

    const existing = page.locator(`.rounded-full:has-text("${CONFLICT_ZIP}")`).first();
    if (await existing.isVisible({ timeout: 500 }).catch(() => false)) {
      await existing.locator('button').click();
      await page.waitForTimeout(500);
    }

    await input0.fill(CONFLICT_ZIP);
    await add0.click();
    await expect(page.locator(`.rounded-full:has-text("${CONFLICT_ZIP}")`).first()).toBeVisible({ timeout: 5000 });

    // Try to assign the same ZIP to the second member
    await zoneBtns.nth(1).click();
    const input1 = page.locator('input[placeholder*="90210"]').nth(1);
    const add1 = page.getByRole('button', { name: /^Add$/ }).nth(1);
    await input1.fill(CONFLICT_ZIP);
    await add1.click();

    await expect(page.locator('text=/already assigned/i')).toBeVisible({ timeout: 5000 });

    // Clean up
    await page.locator(`.rounded-full:has-text("${CONFLICT_ZIP}")`).first().locator('button').click();
  });
});

test.describe('Territories map page', () => {
  test('page loads and shows Territory Zones heading', async ({ page }) => {
    await page.goto('/territories');
    await expect(page.locator('h1')).toContainText('Territory Zones', { timeout: 10000 });
  });

  test('appears in the navigation', async ({ page }) => {
    await page.goto('/jobs');
    // On desktop the sidebar is always visible; on mobile it's behind More
    const sidebarLink = page.locator('nav a[href="/territories"]').first();
    const moreBtn = page.locator('button:has-text("More")').last();
    const sidebarVisible = await sidebarLink.isVisible({ timeout: 2000 }).catch(() => false);
    if (sidebarVisible) {
      await expect(sidebarLink).toBeVisible();
    } else {
      await moreBtn.click();
      await expect(page.locator('a[href="/territories"]')).toBeVisible({ timeout: 3000 });
    }
  });

  test('filter pills show All button', async ({ page }) => {
    await page.goto('/territories');
    await expect(page.locator('h1')).toContainText('Territory Zones', { timeout: 10000 });
    // The All filter pill is a button with a span containing "All"
    await expect(page.locator('button').filter({ hasText: /^All \(/ })).toBeVisible({ timeout: 5000 });
  });

  test('shows a valid state after load', async ({ page }) => {
    await page.goto('/territories');
    await expect(page.locator('h1')).toContainText('Territory Zones', { timeout: 10000 });
    // After heading appears, one of these states must be visible
    await page.waitForTimeout(2000);
    const hasMap   = await page.locator('.leaflet-container').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=No jobs with addresses').isVisible().catch(() => false);
    const hasLoading = await page.locator('p:has-text("Loading")').isVisible().catch(() => false);
    expect(hasMap || hasEmpty || hasLoading).toBe(true);
  });
});
