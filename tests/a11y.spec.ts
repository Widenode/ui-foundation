import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The Tier 1 gate. Verifies contrast, target size, ARIA and focus order —
 * the things that should never consume review attention.
 *
 * Add every new route here. The specimen is the canonical first entry:
 * if the token pairings fail, they fail here first.
 */
const ROUTES = ['/specimen/index.html']

/**
 * Elements whose colour contrast is DECLARED below AA in
 * src/contrast-policy.json, and only in dark mode. axe enforces a flat 4.5:1
 * and has no way to express a policy with recorded exemptions, so the elements
 * are excluded from the dark audit rather than the rule being switched off
 * wholesale — every other element still gets axe's contrast check, which is
 * what catches an element landing on a background we did not anticipate.
 *
 * Adding a solid fill without adding it here turns this gate red. That is the
 * intended failure mode: loud, not silent.
 */
const DECLARED_BELOW_AA_IN_DARK = ['.btn--solid', '.btn--danger', '.btn--ok']

for (const route of ROUTES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`a11y: ${route} (${theme})`, async ({ page }) => {
      // The token layer collapses durations to 1ms under reduced motion, so
      // this settles the theme swap deterministically. Without it axe can
      // sample a mid-transition background and report phantom failures against
      // an interpolated colour that matches no token.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(route)
      await page.evaluate(
        (t) => document.documentElement.setAttribute('data-theme', t),
        theme,
      )

      let builder = new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21aa',
        'wcag22aa',
      ])
      if (theme === 'dark') {
        for (const selector of DECLARED_BELOW_AA_IN_DARK) {
          builder = builder.exclude(selector)
        }
      }

      const results = await builder.analyze()

      // Readable failure output — axe's default dump is unusable in CI logs.
      if (results.violations.length) {
        console.log(
          results.violations
            .map(
              (v) =>
                `${v.id} (${v.impact}): ${v.help}\n` +
                v.nodes.map((n) => `    ${n.html}`).join('\n'),
            )
            .join('\n\n'),
        )
      }

      expect(results.violations).toEqual([])
    })
  }
}
