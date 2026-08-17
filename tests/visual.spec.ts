import { test, expect } from '@playwright/test'

/**
 * Visual regression against the specimen. Catches token drift deterministically
 * — including drift introduced by a Nuxt UI upgrade renaming a --ui-* token
 * that the adapter no longer maps.
 *
 * Update baselines deliberately: npx playwright test --update-snapshots
 */
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 900 },
  { name: 'desktop', width: 1280, height: 900 },
]

for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`specimen: ${vp.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/specimen/index.html')
      await page.evaluate(
        (t) => document.documentElement.setAttribute('data-theme', t),
        theme,
      )
      await page.waitForTimeout(300)

      await expect(page).toHaveScreenshot(`specimen-${vp.name}-${theme}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      })
    })
  }
}
