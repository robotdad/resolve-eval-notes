import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1, // Stop on the first failure, including a host sandbox denial.
  timeout: 60000,
  reporter: [['list'], ['json', { outputFile: process.env.E2E_REPORT || 'test-results/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:43171',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      chromiumSandbox: true,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // e2e/fixtures.ts owns BOTH servers, their isolated store and full restarts.
  // No reuse of an unrelated server; strict ports fail closed when occupied.
});
