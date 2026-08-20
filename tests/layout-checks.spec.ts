import { test, expect } from '@playwright/test'
import { layoutChecks, pixelGridChecks, settle } from '../src/layout-checks.mjs'

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
const TARGET = byName('icon-only controls')
const FIELD = byName('a field groups')
const GRID = pixelGridChecks[0]

/**
 * --target-min has to be declared, or the icon-only target check reads nothing
 * from the root and returns early — a fixture that cannot fail. This file
 * exists to catch exactly that, and caught it here.
 */
const PAGE_CSS = `:root { --target-min: 44px }
  body { margin: 0; font-family: system-ui, sans-serif }`

/** A wrapper mid-enter: the state an overlay is in for its first 200ms. */
const scaled = (factor: number, html: string) =>
  `<div style="transform:scale(${factor})">${html}</div>`

const ICON_BUTTON =
  `<button aria-label="Close" style="width:44px;height:44px;padding:0">
     <svg style="display:block;width:14px;height:14px" viewBox="0 0 16 16" aria-hidden="true"><path d="M0 0h16v16H0z"/></svg>
   </button>`

const ICON =
  '<svg style="display:block;width:14px;height:14px" viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>'

/**
 * Every case: markup, the check under test, whether it must report, and
 * optionally a substring the report has to contain — so a fixture that proves
 * one branch still fires cannot be satisfied by a different branch firing.
 */
const CASES: Array<
  [string, { run: (page: any) => Promise<string[]> }, boolean, string, string?]
> = [
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

  // --- Measured mid-animation -----------------------------------------------
  // Every one of these was a false positive reported against a page that is
  // correct at rest, because a rect is transformed and a computed style is not.
  [
    // 32 x 0.95 - 4 = 26.4 against a 26px leading: inside the 0.5px tolerance,
    // so the exclusion that should skip this control did not fire.
    'a control mid-scale-in whose leading is inert at rest',
    LEADING,
    false,
    scaled(0.95, `<button role="switch" style="box-sizing:border-box;min-height:32px;border:2px solid;font-size:16px;line-height:26px;display:inline-flex;align-items:center;padding:0 8px"><span>Require approval</span></button>`),
  ],
  [
    // 44 x 0.95 = 41.8, reported as "below --target-min 44px".
    'a 44px target mid-scale-in',
    TARGET,
    false,
    scaled(0.95, ICON_BUTTON),
  ],
  [
    'a clipping label mid-scale-in',
    CLIPPED,
    false,
    scaled(0.6, `<span style="display:block;height:24px;line-height:24px;font-size:16px;overflow:hidden;white-space:nowrap">Loading</span>`),
  ],
  [
    // The one that cannot be corrected: a transform moves the box without
    // moving the layout, so there is no position to divide back out.
    'a control under a transform, measured for grid position',
    GRID,
    true,
    scaled(0.95, ICON_BUTTON),
    'measured under a transform',
  ],

  // --- Label beside the control ---------------------------------------------
  [
    // Nuxt UI's switch shape: the label lives in a wrapper AFTER the control.
    // Picking that wrapper as "the hint" made this check impossible to pass.
    'a switch whose label sits beside it, wired correctly',
    FIELD,
    false,
    `<div>
       <div><button role="switch" id="s1" aria-describedby="s1-d" style="width:36px;height:20px"></button></div>
       <div><label for="s1">Require approval before deploying</label><p id="s1-d">Applies to production only</p></div>
     </div>`,
  ],
  [
    'a top-label field that does not point at its hint',
    FIELD,
    true,
    `<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
       <label for="e1">Email</label><input id="e1" style="margin:0">
       <p style="margin:0">We will only use this to sign you in.</p>
     </div>`,
    'aria-describedby',
  ],
]

for (const [name, check, mustReport, html, match] of CASES) {
  test(`${mustReport ? 'reports' : 'passes'}: ${name}`, async ({ page }) => {
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>${PAGE_CSS}</style>${html}`,
    )
    const found = await check.run(page)
    if (mustReport) {
      expect(found, 'expected an offender').not.toEqual([])
      if (match) expect(found.join('\n')).toContain(match)
    } else {
      expect(found).toEqual([])
    }
  })
}

/**
 * `settle` gets its own tests: it is the answer the checks point at, so it has
 * to be exercised against a real animation rather than asserted about.
 *
 * The animation carries `both` deliberately. A forwards fill leaves its final
 * value applied, so the panel settles at `matrix(1, 0, 0, 1, 0, 0)` rather than
 * `transform: none` — which is what a fourth wrong version of this waited for,
 * forever.
 */
const ANIMATED = `<!doctype html><meta charset="utf-8"><style>
  ${PAGE_CSS}
  @keyframes enter { from { opacity: 0; transform: scale(.95) } to { opacity: 1; transform: none } }
  #panel { animation: enter 600ms ease-out both }
</style><div id="panel">${ICON_BUTTON}</div>`

test('settle waits out an enter animation', async ({ page }) => {
  await page.setContent(ANIMATED)
  expect(await GRID.run(page), 'should refuse while the panel is moving')
    .not.toEqual([])

  await settle(page, { selector: '#panel' })

  expect(await GRID.run(page), 'should measure once it has landed').toEqual([])
  expect(await TARGET.run(page)).toEqual([])
})

test('settle rejects rather than returning quietly', async ({ page }) => {
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><div id="panel">x</div>`,
  )
  await expect(settle(page, { selector: '#missing', timeout: 300 })).rejects.toThrow(
    /still moving/,
  )
})
