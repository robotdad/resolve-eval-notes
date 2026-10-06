/**
 * Local-only test-only sandbox-disabled override for synthetic loopback evaluation.
 * NOT for production or security qualification. The main playwright.config.ts retains
 * chromiumSandbox: true as the declared default.
 *
 * Limitation: this override disables the Chromium sandbox, which is only acceptable
 * for owned loopback-only test services with synthetic data in a controlled environment.
 * Do not use this configuration for cross-origin, user-data, or security testing.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  timeout: 60000,
  reporter: [['list'], ['json', { outputFile: process.env.E2E_REPORT || 'test-results/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:43171',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      chromiumSandbox: false, // Override: sandbox-disabled for local loopback-only evaluation
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
