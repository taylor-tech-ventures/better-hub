import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8787';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: !!process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS,
  },

  projects: [
    { name: 'setup', testMatch: /global-setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      GH_CLIENT_ID: process.env.GH_CLIENT_ID ?? '',
      GH_CLIENT_SECRET: process.env.GH_CLIENT_SECRET ?? '',
      AUTH_SECRET: process.env.AUTH_SECRET ?? '',
      COOKIE_ENCRYPTION_KEY: process.env.COOKIE_ENCRYPTION_KEY ?? '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
    },
  },
});
