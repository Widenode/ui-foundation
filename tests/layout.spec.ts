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
