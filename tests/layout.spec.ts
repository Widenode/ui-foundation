import { test, expect } from '@playwright/test'
import { layoutChecks } from '../src/layout-checks.mjs'

/**
 * `pinnedFontChecks` is deliberately NOT run here. Those assert a rendered
 * outcome that depends on font metrics, and this package's `--font-sans` is a
 * brand slot resolving to whatever the machine has — measured, the same page
 * reports 0 controls off the pixel grid under three faces and 18 under a
 * fourth. Gating it here failed the v0.4.0 release for CI's fonts rather than
 * for a defect. Apps that pin their font should run them; see INTEGRATION.md.
 */

/**
 * The specimen runs the SAME checks this package ships to consumers, from the
 * same module — so `layout-checks.mjs` is exercised by CI rather than published
 * and hoped. A consuming app registers these against its own routes; see
 * INTEGRATION.md.
 */
const ROUTES = ['/specimen/index.html']

for (const check of layoutChecks) {
  for (const route of ROUTES) {
    test(`${check.name}`, async ({ page }) => {
      await page.goto(route)
      expect(await check.run(page), check.name).toEqual([])
    })
  }
}
