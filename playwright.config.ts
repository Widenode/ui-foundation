import { defineConfig, devices } from '@playwright/test'

/**
 * Serves the repo root so tests reach /specimen/index.html.
 * npx serve is used rather than a framework dev server — this package
 * has no build step and must not acquire one.
 */
export default defineConfig({
  testDir: './tests',
  /**
   * Playwright would otherwise write to tests/visual.spec.ts-snapshots/, but
   * .gitignore, CLAUDE.md and CONTRIBUTING.md all specify tests/**\/__screenshots__.
   * The platform suffix is explicit and load-bearing: baselines are not portable
   * across OSes, so a Linux CI run must never silently compare against a
   * developer's win32 or darwin images.
   */
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}-{projectName}-{platform}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx --yes serve . -l 4173',
    url: 'http://localhost:4173/specimen/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
})
