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

test('icons are sized from their label, not in pixels', async ({ page }) => {
  await page.goto(ROUTE)

  const offenders = await page.evaluate(() => {
    // 1em is the rule. The window allows a deliberate nudge but rejects the
    // real failure: markup pasted with width="20"/"24" beside 11-14px text,
    // which lands at 1.4x-2.2x.
    const MIN = 0.85
    const MAX = 1.25
    const bad: string[] = []

    for (const icon of document.querySelectorAll<SVGElement>('svg')) {
      const parent = icon.parentElement
      if (!parent) continue
      const hasLabel = [...parent.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim().length > 0,
      )
      if (!hasLabel) continue // icon-only controls are covered by the next test

      const font = parseFloat(getComputedStyle(parent).fontSize)
      const size = icon.getBoundingClientRect().height
      if (!font || !size) continue

      const ratio = size / font
      if (ratio < MIN || ratio > MAX) {
        bad.push(
          `${parent.className || parent.tagName} — ${size.toFixed(1)}px icon on ` +
            `${font.toFixed(1)}px label (${ratio.toFixed(2)}x)`,
        )
      }
    }
    return [...new Set(bad)]
  })

  expect(offenders, 'icons not sized from their label').toEqual([])
})

test('icon-only controls meet the minimum target size', async ({ page }) => {
  await page.goto(ROUTE)

  const offenders = await page.evaluate(() => {
    // Their accessible name is not checked here — axe already reports a
    // nameless button as a critical `button-name` violation.
    const target = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--target-min'),
    )
    const bad: string[] = []

    for (const el of document.querySelectorAll<HTMLElement>('button, a[href], [role="button"]')) {
      const icon = el.querySelector('svg')
      if (!icon) continue
      if (el.textContent && el.textContent.trim().length) continue // has a label

      const r = el.getBoundingClientRect()
      if (r.width + 0.5 < target || r.height + 0.5 < target) {
        bad.push(
          `${el.getAttribute('aria-label') || el.className} — ` +
            `${r.width.toFixed(0)}x${r.height.toFixed(0)}px, below --target-min ${target}px`,
        )
      }
    }
    return [...new Set(bad)]
  })

  expect(offenders, 'icon-only controls below --target-min').toEqual([])
})

test('a field groups with its hint, not away from it', async ({ page }) => {
  await page.goto(ROUTE)

  const offenders = await page.evaluate(() => {
    const bad: string[] = []
    const CONTROLS = 'input:not([type="checkbox"]):not([type="radio"]), select, textarea'

    for (const control of document.querySelectorAll<HTMLElement>(CONTROLS)) {
      const label =
        (control.id && document.querySelector<HTMLElement>(`label[for="${CSS.escape(control.id)}"]`)) ||
        control.closest('label')
      if (!label) continue

      // The field is the nearest ancestor holding both the label and control.
      let field: HTMLElement | null = control.parentElement
      while (field && !field.contains(label)) field = field.parentElement
      if (!field) continue

      // Descriptive text sitting after the control, inside the field.
      const after = [...field.children].filter(
        (el) =>
          el !== control &&
          el !== label &&
          el.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING &&
          (el.textContent || '').trim().length > 0,
      ) as HTMLElement[]
      if (!after.length) continue
      const hint = after[0]

      const name = label.textContent?.trim().slice(0, 24) || control.id

      const above = control.getBoundingClientRect().top - label.getBoundingClientRect().bottom
      const below = hint.getBoundingClientRect().top - control.getBoundingClientRect().bottom

      // Below must not exceed above: a hint further from its control than the
      // label reads as belonging to the next field.
      if (below > above + 0.5) {
        bad.push(
          `"${name}" — ${below.toFixed(1)}px below the control vs ${above.toFixed(1)}px above it`,
        )
      }

      // And the field must still be visibly tighter than the gap around it.
      const next = field.nextElementSibling as HTMLElement | null
      if (next && (next.textContent || '').trim()) {
        const around = next.getBoundingClientRect().top - field.getBoundingClientRect().bottom
        const within = Math.max(above, below)
        if (around <= within) {
          bad.push(
            `"${name}" — ${around.toFixed(1)}px to the next field is not more than ${within.toFixed(1)}px inside it`,
          )
        }
      }

      // Proximity is a sighted affordance. The hint has to be linked too.
      const described = (control.getAttribute('aria-describedby') || '').split(/\s+/)
      if (!hint.id || !described.includes(hint.id)) {
        bad.push(`"${name}" — hint is not referenced by the control's aria-describedby`)
      }
    }
    return [...new Set(bad)]
  })

  expect(offenders, 'fields whose hint is grouped wrongly or left unlinked').toEqual([])
})
