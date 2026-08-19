import { test, expect } from '@playwright/test'

/**
 * Layout rules that are cheap to state, easy to get wrong, and invisible to
 * every other gate.
 *
 * Both checks here exist because a rule that is only written down gets
 * followed literally and still produces sloppy UI. The alignment rule said
 * "numeric columns right-align" and was obeyed — on the data cells only,
 * leaving left-aligned headers over right-aligned numbers. The control-leading
 * rule was implied by the type triplets and violated by this package's own
 * specimen.
 *
 * These assert the rendered result, so neither can be satisfied by reading.
 */

const ROUTE = '/specimen/index.html'

test('table headers take the alignment of their column', async ({ page }) => {
  await page.goto(ROUTE)

  const offenders = await page.evaluate(() => {
    const bad: string[] = []

    for (const table of document.querySelectorAll('table')) {
      const headers = [...table.querySelectorAll('thead th')]
      if (!headers.length) continue

      const rows = [...table.querySelectorAll('tbody tr')]

      headers.forEach((th, i) => {
        // The column's alignment is whatever its body cells agree on.
        const cells = rows
          .map((r) => r.children[i] as HTMLElement | undefined)
          .filter(Boolean) as HTMLElement[]
        if (!cells.length) return

        const cellAlign = [
          ...new Set(cells.map((c) => getComputedStyle(c).textAlign)),
        ]
        if (cellAlign.length !== 1) return // mixed column, not our business

        const headerAlign = getComputedStyle(th as HTMLElement).textAlign
        if (headerAlign !== cellAlign[0]) {
          bad.push(
            `"${th.textContent?.trim()}" header is ${headerAlign} over ${cellAlign[0]} cells`,
          )
        }
      })
    }
    return bad
  })

  expect(offenders, 'headers whose alignment disagrees with their column').toEqual([])
})

test('single-line controls do not inherit prose leading', async ({ page }) => {
  await page.goto(ROUTE)

  const offenders = await page.evaluate(() => {
    // Real control elements plus the specimen's own control classes. textarea
    // is excluded on purpose: it is multi-line and keeps its size's leading.
    const SELECTOR = [
      'button',
      'select',
      'input:not([type="checkbox"]):not([type="radio"])',
      '.badge',
      '.btn',
      '.input:not(textarea)',
    ].join(',')

    // Generous: prose leading is 1.45–1.6. Anything at or below this is a
    // deliberate control value, anything above has inherited body leading.
    const MAX_RATIO = 1.35
    const bad: string[] = []

    for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) {
      if (el.closest('textarea')) continue
      const cs = getComputedStyle(el)
      const size = parseFloat(cs.fontSize)
      const leading = parseFloat(cs.lineHeight)
      if (!size || Number.isNaN(leading)) continue // 'normal' is fine

      const ratio = leading / size
      if (ratio > MAX_RATIO) {
        bad.push(
          `${el.tagName.toLowerCase()}.${el.className || '(no class)'} — ` +
            `${size}px text with ${leading}px leading (${ratio.toFixed(2)}x)`,
        )
      }
    }
    return [...new Set(bad)]
  })

  expect(offenders, 'controls inheriting prose leading').toEqual([])
})

test('icons paired with a label centre on the label', async ({ page }) => {
  await page.goto(ROUTE)

  const offenders = await page.evaluate(() => {
    const bad: string[] = []

    for (const icon of document.querySelectorAll<SVGElement>('svg')) {
      const parent = icon.parentElement
      if (!parent) continue

      // Only pairs: an icon sitting beside actual text.
      const textNode = [...parent.childNodes].find(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim().length > 0,
      )
      if (!textNode) continue

      const name = parent.className || parent.tagName.toLowerCase()
      const cs = getComputedStyle(parent)

      // Assert the cause, not the symptom. Measuring the drift directly is a
      // trap: baseline alignment on an 11px label moves the icon by exactly
      // 1.0px, which is too small to separate from subpixel noise, and the
      // error shrinks further as the icon approaches the label's height. The
      // stated rule is a flex container centring its items, so check that.
      if (!/flex/.test(cs.display)) {
        bad.push(`${name} — icon+label parent is display:${cs.display}, not flex`)
        continue
      }
      if (cs.alignItems !== 'center') {
        bad.push(`${name} — align-items:${cs.alignItems}, so the icon rides off the label`)
        continue
      }

      // An inline SVG sits its bottom edge on the baseline. Flex blockifies its
      // children, so this only fires for non-flex parents — which the check
      // above has already rejected. Kept for when that rule is relaxed.
      if (getComputedStyle(icon).display === 'inline') {
        bad.push(`${name} — icon is display:inline`)
        continue
      }

      // Backstop for gross errors only, measured against the LABEL rather than
      // the container: mis-aligning the icon grows the container, which moves
      // its centre too and cancels the error out.
      const range = document.createRange()
      range.selectNodeContents(textNode)
      const t = range.getBoundingClientRect()
      range.detach()
      if (!t.height) continue

      const i = icon.getBoundingClientRect()
      const drift = Math.abs((i.top + i.bottom) / 2 - (t.top + t.bottom) / 2)
      if (drift > 2) {
        bad.push(`${name} — icon centre ${drift.toFixed(1)}px off its label`)
      }
    }
    return [...new Set(bad)]
  })

  expect(offenders, 'icons not centred on their label').toEqual([])
})

test('the scrollbar gutter is reserved', async ({ page }) => {
  await page.goto(ROUTE)

  // Without this, a centred layout jumps sideways the moment a page grows past
  // one viewport — so navigating between a short and a long page twitches.
  const gutter = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollbarGutter,
  )

  expect(gutter, 'scrollbar-gutter on the root element').toBe('stable')
})
