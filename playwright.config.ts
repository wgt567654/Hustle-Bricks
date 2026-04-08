import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.test automatically so credentials don't need to be manually exported
config({ path: resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Keep sequential — tests share Supabase state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Auth setup runs first and saves session state to disk
    {
      name: 'owner-setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'owner-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/owner.json',
      },
      dependencies: ['owner-setup'],
      testMatch: '**/owner-*.spec.ts',
    },
    {
      name: 'public-tests',
      use: {
        ...devices['Desktop Chrome'],
        // Force a clean (unauthenticated) browser context
        storageState: { cookies: [], origins: [] },
      },
      testMatch: '**/public-*.spec.ts',
    },
    {
      name: 'employee-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: '**/employee-*.spec.ts',
    },
  ],
});
