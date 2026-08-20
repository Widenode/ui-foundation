/**
 * layout-checks — the [enforced] rules from RULES.md that no linter can see,
 * as assertions you can run against your own app.
 *
 * The foundation's own gates only ever ran against its specimen, which meant a
 * consuming app could break every one of these and find out by screenshot
 * review. This module is the same set of checks, decoupled from the specimen,
 * so they run in your CI instead.
 *
 *   import { layoutChecks } from '@widenode/ui-foundation/layout-checks'
 *
 *   const ROUTES = ['/', '/settings']
 *   for (const check of layoutChecks) {
 *     for (const route of ROUTES) {
 *       test(`${check.name} — ${route}`, async ({ page }) => {
 *         await page.goto(route)
 *         expect(await check.run(page), check.name).toEqual([])
 *       })
 *     }
 *   }
 *
 * Each check returns an array of human-readable offenders; empty means pass.
 *
 * There is no import of `@playwright/test` here on purpose — the only thing
 * required of `page` is an `evaluate` method, so this also works with any
 * driver that has one, and it adds no dependency to this package.
 *
 * Helpers are defined inside each check rather than shared at module scope:
 * `page.evaluate` serialises the function it is given, so anything referenced
 * from an outer scope is simply not there at run time.
 */

/** Icon detection, duplicated into each check that needs it — see above. */
const ICON_SRC = `
  const findIcons = (root) => {
    const svgs = [...root.querySelectorAll('svg')]
    // An icon FONT paints through a ::before on an otherwise empty element. A
    // check that only queries svg finds nothing in an app built on Font Awesome
    // or Material Symbols, and passes — confidence it has not earned.
    const glyphs = [...root.querySelectorAll('i, span, em')].filter((el) => {
      if ((el.textContent || '').trim()) return false
      if (el.querySelector('svg')) return false
      const c = getComputedStyle(el, '::before').content
      return c && c !== 'none' && c !== 'normal' && c !== '""'
    })
    return [...svgs, ...glyphs]
  }
  const labelOf = (parent, icon) => {
    // A label is a bare text node OR an element wrapping text. It becomes an
    // element the moment text-box trimming requires one, and a check that only
    // looks for text nodes silently stops finding any pair at all.
    for (const n of parent.childNodes) {
      if (n === icon) continue
      if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) {
        const r = document.createRange()
        r.selectNodeContents(n)
        const rect = r.getBoundingClientRect()
        r.detach()
        return { rect, text: n.textContent.trim() }
      }
      if (n.nodeType === Node.ELEMENT_NODE && !n.contains(icon) && (n.textContent || '').trim()) {
        return { rect: n.getBoundingClientRect(), text: n.textContent.trim() }
      }
    }
    return null
  }
`

/** Font cap height and baseline, used by the trim check. */
const TEXT_SRC = `
  // Measure from the BASELINE, never the label's own box: the box top means the
  // cap edge when trimmed and the font edge when not, so a box-relative
  // measurement compares different things and agrees with itself either way.
  const baselineOf = (el) => {
    const probe = document.createElement('span')
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
    el.appendChild(probe)
    const y = probe.getBoundingClientRect().top
    probe.remove()
    return y
  }
  // The FONT's cap height, never the word's own ink: measuring the word would
  // demand "Queued" sit lower than "Passing" to balance its missing descender,
  // enforcing the very inconsistency the rule prevents.
  const capHeightOf = (el) => {
    const cs = getComputedStyle(el)
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
    return ctx.measureText('H').actualBoundingBoxAscent
  }
`

const CONTROLS =
  'button, select, input:not([type="checkbox"]):not([type="radio"])'

/**
 * @typedef {{ name: string, rule: string, run: (page: any) => Promise<string[]> }} LayoutCheck
 * @type {LayoutCheck[]}
 */
export const layoutChecks = [
  {
    name: 'table headers take the alignment of their column',
    rule: 'Layout hints — numeric columns right-align',
    run: (page) =>
      page.evaluate(`(() => {
        const bad = []
        for (const table of document.querySelectorAll('table')) {
          const headers = [...table.querySelectorAll('thead th')]
          if (!headers.length) continue
          const rows = [...table.querySelectorAll('tbody tr')]
          headers.forEach((th, i) => {
            const cells = rows.map((r) => r.children[i]).filter(Boolean)
            if (!cells.length) return
            const aligns = [...new Set(cells.map((c) => getComputedStyle(c).textAlign))]
            if (aligns.length !== 1) return
            const headerAlign = getComputedStyle(th).textAlign
            if (headerAlign !== aligns[0]) {
              bad.push('"' + (th.textContent || '').trim() + '" header is ' + headerAlign + ' over ' + aligns[0] + ' cells')
            }
          })
        }
        return bad
      })()`),
  },

  {
    name: 'single-line controls do not inherit prose leading',
    rule: 'Type — single-line control labels use line-height: 1',
    run: (page) =>
      page.evaluate(`(() => {
        // textarea excluded: multi-line, keeps its size's leading.
        const MAX_RATIO = 1.35
        const TRIM = CSS.supports('text-box', 'trim-both cap alphabetic')
        const clips = (el) => {
          const cs = getComputedStyle(el)
          return cs.overflowX !== 'visible' || cs.overflowY !== 'visible'
        }
        const bad = []
        for (const el of document.querySelectorAll('${CONTROLS}')) {
          const cs = getComputedStyle(el)
          const size = parseFloat(cs.fontSize)
          const leading = parseFloat(cs.lineHeight)
          if (!size || Number.isNaN(leading)) continue
          const ratio = leading / size
          if (ratio <= MAX_RATIO) continue
          const inside = [...el.querySelectorAll('*')]
          // Three exclusions, because an unscoped version of this check reports
          // every control in an app built on a component library, and acting on
          // the report makes that app WORSE. Each one is a case where
          // line-height: 1 fixes nothing or breaks something.
          //
          // 1. The trim supersedes the leading wherever it is applied —
          //    measured, a trimmed label is identical at leading 1 and 1.6.
          if (TRIM && [el, ...inside].some((n) => getComputedStyle(n).textBoxTrim !== 'none')) continue
          // 2. A label span that CLIPS is its own line box, so shrinking the
          //    leading shrinks the box while the ink stays put — the same
          //    damage as trimming one. Measured in a consuming app: a 19px font
          //    box in a 14px truncating span, descenders cut off "Loading".
          if (inside.some((n) => (n.textContent || '').trim() && clips(n))) continue
          // 3. Leading only puffs a control whose height it DRIVES. Under a
          //    declared height the label is centred either way and the ratio is
          //    inert, which is the state of every control worth shipping.
          const contentH = el.getBoundingClientRect().height -
            parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) -
            parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
          if (Math.abs(contentH - leading) > 0.5) continue
          bad.push(el.tagName.toLowerCase() + '.' + (el.className || '(no class)') +
            ' — ' + size + 'px text with ' + leading + 'px leading (' + ratio.toFixed(2) +
            'x), and that line box is the whole height of the control')
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'icons paired with a label centre on the label',
    rule: 'Layout hints — an icon centres on its label',
    run: (page) =>
      page.evaluate(`(() => {
        ${ICON_SRC}
        const bad = []
        for (const icon of findIcons(document)) {
          const parent = icon.parentElement
          if (!parent) continue
          const label = labelOf(parent, icon)
          if (!label) continue
          const name = parent.className || parent.tagName.toLowerCase()
          const cs = getComputedStyle(parent)
          // Assert the cause, not the drift: baseline alignment on an 11px
          // label moves the icon by exactly 1.0px, inseparable from subpixel
          // noise, and the error shrinks as the icon approaches label height.
          if (!/flex/.test(cs.display)) {
            bad.push(name + ' — icon+label parent is display:' + cs.display + ', not flex')
            continue
          }
          if (cs.alignItems !== 'center') {
            bad.push(name + ' — align-items:' + cs.alignItems + ', so the icon rides off the label')
            continue
          }
          const t = label.rect
          if (!t.height) continue
          const i = icon.getBoundingClientRect()
          const drift = Math.abs((i.top + i.bottom) / 2 - (t.top + t.bottom) / 2)
          if (drift > 2) bad.push(name + ' — icon centre ' + drift.toFixed(1) + 'px off its label')
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'icons are sized from their label, not in pixels',
    rule: 'Layout hints — icons are sized in em',
    run: (page) =>
      page.evaluate(`(() => {
        ${ICON_SRC}
        // Rejects the real failure: markup pasted with width="20"/"24" beside
        // 11-14px text, which lands at 1.4x-2.2x.
        const MIN = 0.85, MAX = 1.25
        const bad = []
        for (const icon of findIcons(document)) {
          const parent = icon.parentElement
          if (!parent) continue
          if (!labelOf(parent, icon)) continue
          const font = parseFloat(getComputedStyle(parent).fontSize)
          const size = icon.getBoundingClientRect().height
          if (!font || !size) continue
          const ratio = size / font
          if (ratio < MIN || ratio > MAX) {
            bad.push((parent.className || parent.tagName) + ' — ' + size.toFixed(1) +
              'px icon on ' + font.toFixed(1) + 'px label (' + ratio.toFixed(2) + 'x)')
          }
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'icon-only controls meet the minimum target size',
    rule: 'State vocabulary — --target-min',
    run: (page) =>
      page.evaluate(`(() => {
        ${ICON_SRC}
        // The accessible name is NOT checked here — axe already reports a
        // nameless button as a critical button-name violation.
        const target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--target-min'))
        if (!target) return []
        const bad = []
        for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
          if (!findIcons(el).length) continue
          if ((el.textContent || '').trim()) continue
          const r = el.getBoundingClientRect()
          if (r.width + 0.5 < target || r.height + 0.5 < target) {
            bad.push((el.getAttribute('aria-label') || el.className) + ' — ' +
              r.width.toFixed(0) + 'x' + r.height.toFixed(0) + 'px, below --target-min ' + target + 'px')
          }
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'a field groups with its hint, not away from it',
    rule: 'Spacing — a field is one group',
    run: (page) =>
      page.evaluate(`(() => {
        const bad = []
        for (const control of document.querySelectorAll('${CONTROLS}, textarea')) {
          const label = (control.id && document.querySelector('label[for="' + CSS.escape(control.id) + '"]')) ||
            control.closest('label')
          if (!label) continue
          let field = control.parentElement
          while (field && !field.contains(label)) field = field.parentElement
          if (!field) continue
          const after = [...field.children].filter((el) =>
            el !== control && el !== label &&
            (el.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING) &&
            (el.textContent || '').trim().length > 0)
          if (!after.length) continue
          const hint = after[0]
          const name = (label.textContent || '').trim().slice(0, 24) || control.id
          const above = control.getBoundingClientRect().top - label.getBoundingClientRect().bottom
          const below = hint.getBoundingClientRect().top - control.getBoundingClientRect().bottom
          if (below > above + 0.5) {
            bad.push('"' + name + '" — ' + below.toFixed(1) + 'px below the control vs ' + above.toFixed(1) + 'px above it')
          }
          const next = field.nextElementSibling
          if (next && (next.textContent || '').trim()) {
            const around = next.getBoundingClientRect().top - field.getBoundingClientRect().bottom
            const within = Math.max(above, below)
            if (around <= within) {
              bad.push('"' + name + '" — ' + around.toFixed(1) + 'px to the next field is not more than ' + within.toFixed(1) + 'px inside it')
            }
          }
          const described = (control.getAttribute('aria-describedby') || '').split(/\\s+/)
          if (!hint.id || !described.includes(hint.id)) {
            bad.push('"' + name + '" — hint is not referenced by the control\\'s aria-describedby')
          }
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'labels beside an icon are trimmed cap-to-baseline',
    rule: 'Type — trimmed cap-to-baseline',
    run: (page) =>
      page.evaluate(`(() => {
        if (!CSS.supports('text-box', 'trim-both cap alphabetic')) return []
        ${ICON_SRC}
        ${TEXT_SRC}
        const bad = []
        for (const icon of findIcons(document)) {
          const parent = icon.parentElement
          if (!parent) continue
          const found = labelOf(parent, icon)
          if (!found) continue
          // Only an element can be trimmed; a bare text node cannot, which is
          // itself the markup rule.
          const label = [...parent.children].find((el) => el !== icon && (el.textContent || '').trim())
          if (!label) {
            bad.push((parent.className || parent.tagName) + ' — label is a bare text node, so it cannot be trimmed')
            continue
          }
          const cs = getComputedStyle(label)
          const name = (label.textContent || '').trim().slice(0, 20)
          // Declaration check: a regression to no trim measures ~1px and slips
          // under any tolerance the geometry check can safely use.
          if (cs.textBoxTrim !== 'trim-both') {
            bad.push('"' + name + '" — text-box-trim is ' + cs.textBoxTrim + ', not trim-both')
            continue
          }
          if (!/cap/.test(cs.textBoxEdge) || !/alphabetic/.test(cs.textBoxEdge)) {
            bad.push('"' + name + '" — text-box-edge is ' + cs.textBoxEdge + ', not cap alphabetic')
            continue
          }
          // Geometry check. Tolerance cannot go tighter: CI renders with Linux
          // font metrics, not the author's.
          const cr = parent.getBoundingClientRect()
          const pcs = getComputedStyle(parent)
          const top = cr.top + parseFloat(pcs.borderTopWidth) + parseFloat(pcs.paddingTop)
          const bottom = cr.bottom - parseFloat(pcs.borderBottomWidth) - parseFloat(pcs.paddingBottom)
          const base = baselineOf(label)
          const aboveCap = base - capHeightOf(label) - top
          const belowBase = bottom - base
          if (Math.abs(aboveCap - belowBase) > 1.5) {
            bad.push('"' + name + '" — ' + aboveCap.toFixed(1) + 'px above the caps vs ' + belowBase.toFixed(1) + 'px below the baseline')
          }
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'a control with a trimmed label declares its own height',
    rule: 'Type — trimming removes height',
    run: (page) =>
      page.evaluate(`(() => {
        if (!CSS.supports('text-box', 'trim-both cap alphabetic')) return []
        const bad = []
        // Trimming removes the leading a control may have leaned on for height.
        // Padding-driven controls are unaffected; anything sized by its label's
        // line box collapses — measured, a button 16px -> 11.8px.
        for (const label of document.querySelectorAll('*')) {
          if (getComputedStyle(label).textBoxTrim !== 'trim-both') continue
          const control = label.parentElement
          if (!control) continue
          const cs = getComputedStyle(control)
          const floored = cs.minHeight !== '0px' && cs.minHeight !== 'auto'
          const padded = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) > 0
          // A declared height is invisible to getComputedStyle: height and
          // block-size both report the USED value in px whether they were
          // declared or derived, so there is nothing to read. Measure instead:
          // a content box taller than its tallest child cannot have come from
          // the line box. That accepts height and block-size (which pin rather
          // than floor, and were flagged as "neither" by an earlier version of
          // this check), aspect-ratio, and a stretching flex or grid parent.
          //
          // It deliberately does NOT accept a box sized by a tall SIBLING of
          // the label, such as an icon: that is the badge case this rule calls
          // out — the height is luck, and a text-only badge beside an icon
          // badge will not match it.
          const tallest = [...control.children].reduce(
            (h, el) => Math.max(h, el.getBoundingClientRect().height), 0)
          const contentH = control.getBoundingClientRect().height -
            parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) -
            parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
          const sized = contentH > tallest + 0.5
          if (!floored && !padded && !sized) {
            bad.push((control.className || control.tagName) +
              ' — trimmed label, but the control has no min-height, no vertical padding, and no height beyond its tallest child, so its height is whatever the trimmed line box happens to be')
          }
        }
        return [...new Set(bad)]
      })()`),
  },


  {
    name: 'no text sits in a box shorter than the font it is set in',
    rule: 'Type — do not shrink the line box of a box that clips',
    run: (page) =>
      page.evaluate(`(() => {
        const bad = []
        // One canvas for the whole walk: this check measures every clipping
        // element on the page, and a context per element is a page-sized cost
        // in an app rather than a specimen.
        const ctx = document.createElement('canvas').getContext('2d')
        // The general form of the trim rule below, and the reason it is stated
        // generally: TRIMMING is one way to shrink a line box inside a box that
        // clips, and LINE-HEIGHT is another. Both cut the ink at cap and
        // baseline, and the property check below sees only the first — it
        // passed in a consuming app while leading of 1 on a truncating span cut
        // the descenders off "Loading".
        //
        // Measuring the text's POSITION cannot catch either one: a clipping box
        // cuts at both ends, so the damage measures perfectly centred. Height
        // against the font box is what tells the truth, and it needs to know
        // nothing about how the box got small.
        for (const el of document.querySelectorAll('*')) {
          const cs = getComputedStyle(el)
          if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
          const text = (el.textContent || '').trim()
          if (!text || el.children.length) continue
          const box = el.getBoundingClientRect()
          // Visually-hidden text is clipped to 1px on purpose — that IS the
          // technique, and it is the only false positive this check hits.
          if (box.height <= 1 || box.width <= 1) continue
          ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
          const m = ctx.measureText(text)
          const fontBox = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent
          if (box.height + 0.5 < fontBox) {
            bad.push((el.className || el.tagName) + ' — ' + box.height.toFixed(1) +
              'px box clipping a ' + fontBox.toFixed(1) +
              'px font box, so its ascenders and descenders are cut')
          }
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'nothing is trimmed inside a box that clips it',
    rule: 'Type — do not shrink the line box of a box that clips',
    run: (page) =>
      page.evaluate(`(() => {
        if (!CSS.supports('text-box', 'trim-both cap alphabetic')) return []
        const bad = []
        // A document walk, not an allow-list of "safe" elements. An allow-list
        // is what shipped this bug twice — once on <input>, which always clips
        // its own content, and once on a label span carrying a truncation
        // utility. Neither looked like the other.
        //
        // This CANNOT be caught by measuring the text: a clipped label is cut at
        // both ends, so it measures perfectly centred. Only the property tells
        // the truth.
        for (const el of document.querySelectorAll('*')) {
          const cs = getComputedStyle(el)
          if (cs.textBoxTrim === 'none') continue
          if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
          bad.push((el.className || el.tagName) + ' — trimmed, but overflow is ' +
            cs.overflowX + '/' + cs.overflowY + ', so its ascenders and descenders are cut')
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'text in a control that cannot be trimmed is still balanced',
    rule: 'Type — where you cannot trim, lift',
    run: (page) =>
      page.evaluate(`(() => {
        const bad = []
        // Asymmetry and height, never the pixel value of the correction: it is
        // ((ascent - descent) - cap) / 2, which is font-dependent, and CI does
        // not render with the author's fonts.
        // Must clear font variation, not just noise: the SAME uncorrected input
        // measures +1.00 on one face and -1.00 on another. A tolerance at or
        // below 1.0 fails CI for the author's font rather than for a defect.
        const TOLERANCE = 1.5
        for (const el of document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"])')) {
          const cs = getComputedStyle(el)
          const ctx = document.createElement('canvas').getContext('2d')
          ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
          const m = ctx.measureText('Hg')
          const r = el.getBoundingClientRect()
          if (!r.height) continue
          // Frame that does not move with the padding: inside the border.
          const frameTop = r.top + parseFloat(cs.borderTopWidth)
          const frameBottom = r.bottom - parseFloat(cs.borderBottomWidth)
          const cTop = frameTop + parseFloat(cs.paddingTop)
          const cBottom = frameBottom - parseFloat(cs.paddingBottom)
          const fontBox = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent
          const baseline = cTop + ((cBottom - cTop) - fontBox) / 2 + m.fontBoundingBoxAscent
          const above = baseline - m.actualBoundingBoxAscent - frameTop
          const below = frameBottom - baseline
          if (Math.abs(above - below) > TOLERANCE) {
            bad.push((el.className || el.tagName) + ' — ' + above.toFixed(2) +
              'px above the caps vs ' + below.toFixed(2) + 'px below the baseline')
          }
        }
        return [...new Set(bad)]
      })()`),
  },


  {
    name: 'leading resolves to whole pixels',
    rule: 'Type — leading resolves to whole pixels',
    run: (page) =>
      page.evaluate(`(() => {
        const bad = []
        // The DECLARATION, not the position. Position is the better test in an
        // app that pins its font — see pinnedFontChecks — but it cannot be
        // gated in a brand-agnostic layer: a trimmed label's box is font
        // metrics, so the same page measures 0 controls off the grid on one
        // face and 18 on another. This check is portable because it depends on
        // font-SIZE, which the token scale fixes, not on font metrics.
        for (const el of document.querySelectorAll('*')) {
          const lh = getComputedStyle(el).lineHeight
          if (!lh.endsWith('px')) continue          // 'normal' is the UA's business
          const v = parseFloat(lh)
          if (Math.abs(v - Math.round(v)) > 0.01) {
            bad.push((el.className || el.tagName) + ' — line-height ' + lh +
              ', so every element below it starts on a fractional y')
          }
        }
        return [...new Set(bad)]
      })()`),
  },

  {
    name: 'the scrollbar gutter is reserved',
    rule: 'Layout hints — scrollbar-gutter: stable',
    run: (page) =>
      page.evaluate(
        `getComputedStyle(document.documentElement).scrollbarGutter === 'stable' ? [] :
         ['scrollbar-gutter on the root is ' + getComputedStyle(document.documentElement).scrollbarGutter + ', not stable']`,
      ),
  },
  {
    name: 'a pill clears its own curve',
    rule: 'Layout hints — the content clears the corner radius',
    run: (page) =>
      page.evaluate(`(() => {
        const bad = []
        // Only FULLY ROUNDED shapes: a pill's radius is half its height, so the
        // label sits inside the curve unless the content inset clears it. A
        // gently rounded shape is unaffected — a 6px radius under 12px padding
        // already clears — so scoping here reports defects rather than noise.
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect()
          if (!r.height || !r.width) continue
          const cs = getComputedStyle(el)
          const radius = parseFloat(cs.borderTopLeftRadius)
          if (!radius) continue
          const effective = Math.min(radius, r.height / 2)
          if (effective < r.height / 2 - 0.5) continue           // not a pill
          if (!(el.textContent || '').trim()) continue           // icon-only
          // Border + padding, not padding alone: the radius is measured on the
          // BORDER box, so what has to clear it is where the content starts —
          // border-width in from that edge, then the padding. Deriving
          // padding-inline as radius - border-width puts the content exactly on
          // the tangent where the straight edge begins, which is what the rule
          // means; asserting padding >= radius would reject that by the width
          // of the border.
          const inset = Math.min(
            parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
            parseFloat(cs.borderRightWidth) + parseFloat(cs.paddingRight))
          if (inset + 0.5 < effective) {
            bad.push((el.className || el.tagName) + ' — ' + inset.toFixed(1) +
              'px content inset against a ' + effective.toFixed(1) +
              'px radius, so the label sits inside the curve')
          }
        }
        return [...new Set(bad)]
      })()`),
  },
]

/**
 * Checks that assert a rendered outcome rather than a declaration.
 *
 * **The precondition is rounded leading and declared control heights, not a
 * pinned font** — which is a correction. These shipped as `pinnedFontChecks`
 * because gating them here failed a release under CI's fonts: the same specimen
 * reports 0 controls off the pixel grid under three faces and 18 under a
 * fourth. But an adopting app whose `--font-sans` is still this package's
 * system stack — so Linux CI and a Windows author render different faces —
 * passes on both, because `round(…, 1px)` is integral whatever the face, so
 * block heights are integral, so controls land on the grid regardless of font
 * metrics.
 *
 * What propagates a fraction is a box sized by font metrics rather than by
 * leading: a TRIMMED label's box is exactly that. It stops there if the row
 * declares its height, which the trim rule requires anyway. So:
 *
 *   rounded leading + declared control heights = these are portable for you.
 *
 * This package still cannot gate them, because its specimen is the thing that
 * proves the "18 under a fourth face" case exists.
 *
 *   import { layoutChecks, pixelGridChecks } from '@widenode/ui-foundation/layout-checks'
 *   for (const check of [...layoutChecks, ...pixelGridChecks]) { ... }
 *
 * @type {LayoutCheck[]}
 */
export const pixelGridChecks = [
  {
    name: 'controls sit on the device pixel grid',
    rule: 'Type — leading resolves to whole pixels',
    run: (page) =>
      page.evaluate(`(() => {
        const bad = []
        // Assert the OUTCOME, not the declaration. The fraction arrives from
        // whatever markup sits above a control, so proving that the type classes
        // carry rounded leading says nothing about a control three sections down.
        //
        // Why it matters: text baselines snap to whole device pixels while box
        // edges antialias at their true position, so a control at y=355.656
        // renders its label a whole pixel off centre however exact its CSS is.
        // Browser zoom HIDES this — more device pixels per CSS pixel makes the
        // fraction resolvable — so judge vertical placement at 100% on a 1x
        // display, and never trust a zoomed screenshot for it.
        //
        // Table descendants are excluded: row heights are distributed by the
        // table layout algorithm, which makes no whole-pixel guarantee and is
        // not something a token system can reach.
        for (const el of document.querySelectorAll('button, input, select, textarea, .badge')) {
          if (el.closest('table')) continue
          const top = el.getBoundingClientRect().top
          const f = top % 1
          if (Math.min(f, 1 - f) > 0.01) {
            bad.push((el.className || el.tagName) + ' — top ' + top.toFixed(3) +
              ', off the pixel grid, so its label cannot render centred')
          }
        }
        return [...new Set(bad)]
      })()`),
  },
]

/**
 * @deprecated Renamed to `pixelGridChecks` — the precondition is rounded
 * leading, not a pinned font. Kept because removing an export is breaking, and
 * this one is wired into consumers' spec files.
 * @type {LayoutCheck[]}
 */
export const pinnedFontChecks = pixelGridChecks
