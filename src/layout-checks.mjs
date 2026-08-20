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

/**
 * Untransformed geometry, for every check that compares a rendered box against
 * a value from CSS.
 *
 * `getBoundingClientRect` reports the TRANSFORMED box. `getComputedStyle`
 * reports untransformed padding, borders and leading, and a canvas measurement
 * reports untransformed font metrics. Subtract one from the other while
 * anything is scaling and the arithmetic is quietly wrong — and an overlay's
 * enter animation is exactly that.
 *
 * Measured in a consuming app, against a dialog that is correct at rest: a 44px
 * close button reported 42px (44 x 0.95), and a switch was reported for prose
 * leading it does not have, because 32 x 0.95 - 4 = 26.4 landed within 0.5px of
 * its 26px leading and slipped past the exclusion that should have skipped it.
 * A 0.95 scale factor is enough to turn a pass into a fail.
 *
 * So divide rendered lengths by the accumulated scale before comparing them
 * with anything from CSS. POSITIONS cannot be recovered this way — a transform
 * moves a box without moving its layout — which is why `pixelGridChecks`
 * refuses to measure instead.
 */
const FRAME_SRC = `
  const SCALES = new Map()
  const scaleOf = (el) => {
    if (!el || el.nodeType !== 1) return { x: 1, y: 1 }
    const hit = SCALES.get(el)
    if (hit) return hit
    const cs = getComputedStyle(el)
    let x = 1, y = 1
    // 'scale' and 'transform' are independent properties and both are in play:
    // which one a utility class compiles to is a version detail.
    if (cs.scale && cs.scale !== 'none') {
      const p = cs.scale.split(/[\s,]+/).map(parseFloat)
      x *= p[0]; y *= (p.length > 1 ? p[1] : p[0])
    }
    if (cs.transform && cs.transform !== 'none') {
      const m = new DOMMatrixReadOnly(cs.transform)
      // hypot, not m.a: under rotation the factor lies across two components.
      x *= Math.hypot(m.a, m.b); y *= Math.hypot(m.c, m.d)
    }
    const up = scaleOf(el.parentElement)
    const out = { x: (x * up.x) || 1, y: (y * up.y) || 1 }
    SCALES.set(el, out)
    return out
  }
  /** Border box as laid out, with any ancestor scale divided back out. */
  const boxOf = (el) => {
    const r = el.getBoundingClientRect()
    const s = scaleOf(el)
    return { width: r.width / s.x, height: r.height / s.y }
  }
  /**
   * Content box height, from CSS rather than from a rect.
   *
   * Computed height is transform-free, which is the point — but it is NOT
   * always the content box: measured, a border-box element with a 32px
   * min-height and 2px borders reports 32, not 28. So box-sizing has to be
   * undone by hand. Deriving this from a rect instead is what mixed the frames.
   */
  const contentHeightOf = (el) => {
    const cs = getComputedStyle(el)
    const h = parseFloat(cs.height)
    if (cs.boxSizing !== 'border-box') return h
    return h - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) -
      parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  }
  /**
   * Nearest element whose transform is not identity, itself included.
   *
   * IDENTITY, not the literal string none: an animation with a forwards fill
   * keeps its final value applied, so a dialog that has finished settling
   * reports matrix(1, 0, 0, 1, 0, 0). Testing for none there refuses to measure
   * a page that is standing perfectly still.
   */
  const near = (v) => Math.abs(v) < 0.001
  const identity = (cs) => {
    if (cs.transform && cs.transform !== 'none') {
      const m = new DOMMatrixReadOnly(cs.transform)
      if (!(near(m.a - 1) && near(m.d - 1) && near(m.b) && near(m.c) && near(m.e) && near(m.f))) return false
    }
    if (cs.scale && cs.scale !== 'none' &&
        cs.scale.split(/[\s,]+/).some((v) => !near(parseFloat(v) - 1))) return false
    if (cs.rotate && cs.rotate !== 'none' && !near(parseFloat(cs.rotate))) return false
    if (cs.translate && cs.translate !== 'none' &&
        cs.translate.split(/[\s,]+/).some((v) => !near(parseFloat(v)))) return false
    return true
  }
  const movedAncestor = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (!identity(getComputedStyle(n))) return n
    }
    return null
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
        ${FRAME_SRC}
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
          //
          //    Computed height rather than the rect: it is the used CONTENT box
          //    and transforms do not touch it. Deriving it by subtracting
          //    computed padding from a rect mixes a transformed length with an
          //    untransformed one, and mid-animation that arithmetic reported a
          //    correct switch as puffy — 32 x 0.95 - 4 = 26.4 against a 26px
          //    leading, inside the tolerance, so this exclusion never fired.
          const contentH = contentHeightOf(el)
          if (!(Math.abs(contentH - leading) <= 0.5)) continue
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
        ${FRAME_SRC}
        // Rejects the real failure: markup pasted with width="20"/"24" beside
        // 11-14px text, which lands at 1.4x-2.2x.
        const MIN = 0.85, MAX = 1.25
        const bad = []
        for (const icon of findIcons(document)) {
          const parent = icon.parentElement
          if (!parent) continue
          if (!labelOf(parent, icon)) continue
          const font = parseFloat(getComputedStyle(parent).fontSize)
          // Rendered height against a CSS font-size, so the scale comes out.
          const size = boxOf(icon).height
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
        ${FRAME_SRC}
        // The accessible name is NOT checked here — axe already reports a
        // nameless button as a critical button-name violation.
        const target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--target-min'))
        if (!target) return []
        const bad = []
        for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
          if (!findIcons(el).length) continue
          if ((el.textContent || '').trim()) continue
          // Against a token, so the target has to be the laid-out size. A 44px
          // button mid-scale-in measures 41.8 and is not a defect.
          const r = boxOf(el)
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
          // A candidate that CONTAINS the label is a wrapper, not a hint. A
          // side-label control — a switch, the universal shape for one — nests
          // its label in a wrapper that follows the control, and picking that
          // wrapper made this check IMPOSSIBLE to pass: the wrapper has no id,
          // so the aria branch fired even against correct wiring. The message
          // said so, and was not read: a name truncated at 24 characters is a
          // name taken from a container.
          const after = [...field.children].filter((el) =>
            el !== control && el !== label && !el.contains(label) &&
            (el.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING) &&
            (el.textContent || '').trim().length > 0)
          // Wiring first, position second. If the control names its own
          // description, THAT element is the hint wherever the markup puts it —
          // which is also the only way to find one nested beside the label.
          const described = (control.getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean)
          const named = described.map((id) => document.getElementById(id))
            .find((el) => el && field.contains(el) && el !== label && !el.contains(label))
          const hint = named || after[0]
          if (!hint) continue
          const name = (label.textContent || '').trim().slice(0, 24) || control.id
          const lr = label.getBoundingClientRect()
          const cr = control.getBoundingClientRect()
          const above = cr.top - lr.bottom
          const below = hint.getBoundingClientRect().top - cr.bottom
          // Proximity only means anything when the label is ABOVE the control.
          // Beside it, "above" is a negative number and every comparison built
          // on it is noise. RULES.md makes top-label a [default], not a rule —
          // so a check that cannot pass for a shape the default permits must
          // report nothing rather than report wrongly.
          if (lr.bottom <= cr.top + 0.5) {
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
          }
          // The half that carries real weight, and it runs for every shape.
          if (!named) {
            bad.push('"' + name + '" — the control does not point at its hint with aria-describedby')
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
        ${FRAME_SRC}
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
          //
          // Everything here is measured in the RENDERED frame — rect edges and
          // a baseline probe — so the CSS lengths and the font's cap height are
          // scaled INTO it, and the asymmetry is scaled back out at the end.
          // Comparing the two frames directly is wrong by the scale factor.
          const sy = scaleOf(parent).y
          const cr = parent.getBoundingClientRect()
          const pcs = getComputedStyle(parent)
          const top = cr.top + (parseFloat(pcs.borderTopWidth) + parseFloat(pcs.paddingTop)) * sy
          const bottom = cr.bottom - (parseFloat(pcs.borderBottomWidth) + parseFloat(pcs.paddingBottom)) * sy
          const base = baselineOf(label)
          const aboveCap = (base - capHeightOf(label) * sy - top) / sy
          const belowBase = (bottom - base) / sy
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
        ${FRAME_SRC}
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
            (h, el) => Math.max(h, boxOf(el).height), 0)
          // Computed height, with box-sizing undone: transform-free, unlike the
          // rect. The children are divided back into the same frame.
          const contentH = contentHeightOf(control)
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
        ${FRAME_SRC}
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
          // Laid-out box: the font box it is compared against is untransformed,
          // so a scaled one would report every clipping label mid-animation.
          const box = boxOf(el)
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
        ${FRAME_SRC}
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
          // Rendered frame throughout: CSS lengths and font metrics are scaled
          // into it, and the asymmetry is scaled back out to compare against a
          // tolerance expressed in CSS pixels.
          const sy = scaleOf(el).y
          // Frame that does not move with the padding: inside the border.
          const frameTop = r.top + parseFloat(cs.borderTopWidth) * sy
          const frameBottom = r.bottom - parseFloat(cs.borderBottomWidth) * sy
          const cTop = frameTop + parseFloat(cs.paddingTop) * sy
          const cBottom = frameBottom - parseFloat(cs.paddingBottom) * sy
          const fontBox = (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) * sy
          const baseline = cTop + ((cBottom - cTop) - fontBox) / 2 + m.fontBoundingBoxAscent * sy
          const above = (baseline - m.actualBoundingBoxAscent * sy - frameTop) / sy
          const below = (frameBottom - baseline) / sy
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
        // app whose leading is rounded — see pixelGridChecks — but it cannot be
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
        ${FRAME_SRC}
        const bad = []
        // Only FULLY ROUNDED shapes: a pill's radius is half its height, so the
        // label sits inside the curve unless the content inset clears it. A
        // gently rounded shape is unaffected — a 6px radius under 12px padding
        // already clears — so scoping here reports defects rather than noise.
        for (const el of document.querySelectorAll('*')) {
          // Laid out, not rendered: radius and padding come from CSS.
          const r = boxOf(el)
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
        ${FRAME_SRC}
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
          // A transform moves the box without moving the layout, so a scaled or
          // shifted control has no meaningful grid position to assert — and
          // unlike a length, a position cannot be divided back out. Say so
          // rather than reporting five controls at fractional tops that are
          // integral the moment the animation lands. Measured in a consuming
          // app, an overlay's 200ms scale-in did exactly that.
          const moved = movedAncestor(el)
          if (moved) {
            bad.push((moved.className || moved.tagName) + ' — measured under a ' +
              'transform, so positions are not layout positions. Put the page at ' +
              'rest first (see settle), or exclude what is deliberately transformed')
            continue
          }
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

/**
 * Wait for the page to stop moving, then resolve. **Call this before the checks
 * whenever an action opened something** — a dialog, a listbox, a drawer.
 *
 *   await page.getByRole('button', { name: 'Settings' }).click()
 *   await settle(page, { selector: '[role="dialog"]' })
 *
 * Shipped rather than described because every consumer with an overlay needs
 * it, and three plausible versions of it are wrong:
 *
 * 1. `getAnimations({ subtree: true })` on the panel — a scrim is the panel's
 *    SIBLING, so a subtree query never sees the animation compositing over it.
 * 2. Filtering to `playState === 'running'` — an animation that is registered
 *    but not yet started is `pending`, so the filter skips the exact one being
 *    waited for.
 * 3. Waiting for `getAnimations()` to hold nothing unfinished — this **passes
 *    vacuously**, because an empty list means "not started yet" just as often
 *    as "finished".
 * 4. Requiring `transform: none` on the panel — an animation with a forwards
 *    fill keeps its final value applied, so a settled dialog reports
 *    `matrix(1, 0, 0, 1, 0, 0)` and the wait never ends. Identity is what
 *    matters, not the spelling.
 *
 * The third is why `selector` exists and why it is worth passing: an assertion
 * on the RENDERED state (`opacity: 1`, `transform: none`) cannot be satisfied
 * by an empty list. Without one, this waits for the animation registry and two
 * consecutive quiet frames, which is enough for an already-started animation
 * and not enough for one that has yet to be created.
 *
 * Infinite animations are ignored: a spinner never finishes, and a page with
 * one is still at rest for measurement purposes.
 *
 * No framework: `page.evaluate` and nothing else, so it adds no dependency and
 * works with any driver that has one. Rejects rather than returning false — a
 * silent false is how the phantom failures got reported in the first place.
 *
 * @param {any} page
 * @param {{ selector?: string | null, timeout?: number }} [options]
 * @returns {Promise<void>}
 */
export function settle(page, options = {}) {
  const { selector = null, timeout = 5000 } = options
  return page.evaluate(`(() => new Promise((resolve, reject) => {
    const SEL = ${JSON.stringify(selector)}
    const deadline = performance.now() + ${Number(timeout)}
    let quiet = 0
    const unfinished = () => document.getAnimations().filter((a) => {
      const timing = a.effect && a.effect.getComputedTiming()
      if (timing && timing.iterations === Infinity) return false
      return a.playState !== 'finished'
    })
    const tick = () => {
      const moving = unfinished()
      let ready = moving.length === 0
      let why = moving.length + ' animation(s) still running'
      if (ready && SEL) {
        const el = document.querySelector(SEL)
        if (!el) { ready = false; why = 'no element matches ' + SEL }
        else {
          const cs = getComputedStyle(el)
          // Identity, not the literal string 'none'. An animation with a
          // forwards fill keeps its final value applied, so a dialog that has
          // finished settling reports matrix(1, 0, 0, 1, 0, 0) — and waiting
          // for 'none' there waits forever. That is a fourth wrong version of
          // this function, found by writing a test with a filled animation.
          const m = cs.transform === 'none' ? null : new DOMMatrixReadOnly(cs.transform)
          const still = !m || (Math.abs(m.a - 1) < 0.001 && Math.abs(m.d - 1) < 0.001 &&
            Math.abs(m.b) < 0.001 && Math.abs(m.c) < 0.001 &&
            Math.abs(m.e) < 0.001 && Math.abs(m.f) < 0.001)
          ready = cs.opacity === '1' && still
          why = SEL + ' is at opacity ' + cs.opacity + ', transform ' + cs.transform
        }
      }
      // Two consecutive quiet frames, never one: the registry is also empty in
      // the frame before an animation is created.
      quiet = ready ? quiet + 1 : 0
      if (quiet >= 2) return resolve()
      if (performance.now() > deadline) {
        return reject(new Error('settle: still moving after ${Number(timeout)}ms — ' + why))
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }))()`)
}
