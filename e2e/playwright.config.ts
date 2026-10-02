import { defineConfig, devices } from '@playwright/test';

/**
 * Hitster end-to-end tests.
 *
 * By default the suite starts the PRODUCTION server (server/dist + web/dist,
 * mock preview provider) on port 3300. Build first: `npm run e2e:prepare`.
 * Set E2E_BASE_URL to run against an already-running instance instead
 * (e.g. a Railway deployment); the webServer block is then skipped.
 */
const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? 'http://localhost:3300';

const mediaArgs = ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: mediaArgs },
  },
  projects: [
    {
      name: 'mobile-chromium',
      // API tests are browser-independent; run them once (desktop project).
      testIgnore: /api\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        launchOptions: { args: mediaArgs },
      },
    },
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: { args: mediaArgs },
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'cd ../server && PREVIEW_PROVIDER=mock PORT=3300 STATIC_DIR=../web/dist node dist/index.js',
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
