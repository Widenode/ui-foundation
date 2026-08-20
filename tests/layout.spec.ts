import { test, expect } from '@playwright/test'
import { layoutChecks } from '../src/layout-checks.mjs'

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
