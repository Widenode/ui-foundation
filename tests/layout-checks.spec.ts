import { test, expect } from '@playwright/test'
import { layoutChecks } from '../src/layout-checks.mjs'

/**
 * Proves the checks FIRE, which layout.spec.ts cannot.
 *
 * That spec runs them against a clean specimen, so a check that can no longer
 * fail passes it — and that is not hypothetical. `nothing is trimmed inside a
 * box that clips it` was green in a consuming app the whole time leading of 1
 * was cutting the descenders off a truncating label: it inspected the trim
 * property and the damage came from the line-height. A check with no failing
 * fixture is a claim, not a gate.
 *
 * Fixtures are minimal inline markup rather than specimen classes, because the
 * cases worth pinning are the ones a component library produces and this
 * package's own specimen never will.
 */

const byName = (prefix: string) => {
  const check = layoutChecks.find((c) => c.name.startsWith(prefix))
  if (!check) throw new Error(`no check named ${prefix}`)
  return check
}

const LEADING = byName('single-line controls')
const CLIPPED = byName('no text sits')
const DECLARES = byName('a control with a trimmed label')
const PILL = byName('a pill clears')

const ICON =
  '<svg style="display:block;width:14px;height:14px" viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>'

/** Every case: markup, the check under test, and whether it must report. */
const CASES: Array<[string, { run: (page: any) => Promise<string[]> }, boolean, string]> = [
  [
    // The false positive that made 0.4.0's leading check damaging: it reported
    // every control in an app built on a component library, and the fix it
    // asked for cut the descenders off the label.
    'a library control with prose leading and a truncating label',
    LEADING,
    false,
    `<button style="min-height:32px;font-size:14px;line-height:1.4286;display:inline-flex;align-items:center;padding:0 12px">
       <span class="lbl" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Loading</span></button>`,
  ],
  [
    'the same control after satisfying that check with line-height: 1',
    CLIPPED,
    true,
    `<button style="min-height:32px;font-size:14px;line-height:1;display:inline-flex;align-items:center;padding:0 12px">
       <span class="lbl" style="line-height:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Loading</span></button>`,
  ],
  [
    // Leading under a declared height is inert: the label is centred either
    // way, so there is nothing to report and never was.
    'a library control with prose leading and a declared height',
    LEADING,
    false,
    `<button style="min-height:32px;font-size:14px;line-height:1.4286;display:inline-flex;align-items:center;padding:0 12px"><span>Loading</span></button>`,
  ],
  [
    'a control whose whole height IS its prose line box',
    LEADING,
    true,
    `<button style="font-size:14px;line-height:1.5;padding:0;border:0">Save</button>`,
  ],
  [
    'a row that declares its height with block-size rather than min-height',
    DECLARES,
    false,
    `<div style="display:flex;align-items:center;gap:4px;block-size:22px;font-size:14px">${ICON}
       <span style="text-box:trim-both cap alphabetic">Passing</span></div>`,
  ],
  [
    // The regression this rule exists for: the row used to be as tall as its
    // prose line box and now collapses to the height of its icon.
    'the same row with nothing declaring its height',
    DECLARES,
    true,
    `<div style="display:flex;align-items:center;gap:4px;font-size:14px">${ICON}
       <span style="text-box:trim-both cap alphabetic">Passing</span></div>`,
  ],
  [
    'a visually-hidden caption, which is clipped on purpose',
    CLIPPED,
    false,
    `<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Results</span>`,
  ],
  [
    // Inline padding derived as radius - border puts the content exactly on the
    // tangent. Measuring padding alone rejected this by the border's width.
    'a pill whose content lands on the tangent',
    PILL,
    false,
    `<span style="display:inline-flex;border:1px solid;border-radius:999px;padding:4px 10px;font-size:12px;line-height:1">Badge</span>`,
  ],
  [
    'a pill whose content sits inside the curve',
    PILL,
    true,
    `<span style="display:inline-flex;border:1px solid;border-radius:999px;padding:4px 8px;font-size:12px;line-height:1">Badge</span>`,
  ],
]

for (const [name, check, mustReport, html] of CASES) {
  test(`${mustReport ? 'reports' : 'passes'}: ${name}`, async ({ page }) => {
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0}</style>${html}`,
    )
    const found = await check.run(page)
    if (mustReport) expect(found, 'expected an offender').not.toEqual([])
    else expect(found).toEqual([])
  })
}
