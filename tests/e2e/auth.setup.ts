/**
 * Logs in as the owner and saves the session to disk so owner-*.spec.ts
 * tests can reuse it without re-logging-in each time.
 *
 * Set credentials via environment variables:
 *   OWNER_EMAIL and OWNER_PASSWORD
 * or create a .env.test file (see .env.test.example).
 */
import { test as setup, expect } from '@playwright/test';

const ownerEmail = process.env.OWNER_EMAIL!;
const ownerPassword = process.env.OWNER_PASSWORD!;

setup('owner login', async ({ page }) => {
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'Set OWNER_EMAIL and OWNER_PASSWORD env vars before running tests.\n' +
      'Copy .env.test.example → .env.test and fill in your credentials.'
    );
  }

  await page.goto('/login');
  await page.locator('#email').fill(ownerEmail);
  await page.locator('#password').fill(ownerPassword);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from login — owner lands on dashboard
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

  await page.context().storageState({ path: 'tests/e2e/.auth/owner.json' });
});
