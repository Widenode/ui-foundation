# Foundation layer — rules

Brand-agnostic visual system. Balanced density, border-first, 4–6px radius.
Consumed by any component methodology; knows nothing about components.

---

## How to read this

Two kinds of statement live in this document, and telling them apart is the
difference between a check and an argument.

**[enforced]** — a gate fails if you break it, and the gate is named. Not open
to negotiation in review: change the rule and its check together, or change
neither.

**[default]** — the starting point, and the reasoning behind it. **Nothing
checks it.** Deviate when the content justifies it — a proof of concept, a
debugging view, a deliberate exception. If you find yourself deviating
everywhere, the default is probably wrong: raise it then, not before.

Anything unmarked is description rather than instruction.

An unenforced preference stated in the same voice as an enforced constraint is
how a spec becomes a source of friction. If something below is marked wrong,
that is a bug in this document.

---

## The one rule

**[enforced — `lint:css`, `lint:tokens`]**

**Components reference Tier 2 semantic tokens only.** Never a Tier 1 primitive
(`--n-7`, `--a-9`), never a raw value (`#666`, `12px`, `p-[13px]`).

This single constraint is what makes both swaps independent:

| Swap | What changes | What doesn't |
|---|---|---|
| Brand | Tier 1 ramps in `tokens.css` | Everything else |
| Skin | The Tier 2 mapping | Every component |

Break it once and both axes quietly die. Lint it rather than watch for it.

---

## Color

Ramps are OKLCH, following the Radix 12-step role model. Steps have assigned
roles, so "which grey" is never a per-component decision.

| Steps | Role |
|---|---|
| 1–2 | Page background, subtle background |
| 3–5 | Component background, hover, active |
| 6–8 | Borders: subtle → default → strong |
| 9–10 | Solid fill, solid hover |
| 11 | Secondary text (AA-passing) |
| 12 | Primary text |

**Three border tokens, and the distinction is load-bearing.** A hairline that
reads well on white sits near 1.3:1 — far under the 3:1 WCAG requires of any
boundary that *conveys information*.

- `--border-subtle` — dividers, decorative edges. Below 3:1 by design.
- `--border-default` — panel and card edges. Below 3:1 by design.
- `--border-strong` — for form controls, selected state, and anything a user
  must perceive to operate. Meets 3:1.

**[enforced — `test:contrast`]** that `--border-strong` clears 3:1 against both
surfaces in both themes. **[default]** that you reach for it in those places —
no check can tell which of your borders conveys information.

This is the most common way a flat hairline aesthetic fails an audit.

`--text-disabled` deliberately fails AA — **[enforced — `test:contrast`]** as a
declared exemption. Disabled controls are exempt under WCAG 1.4.3, and the
corollary is **[default]**, because no tool can check it: **disabled state
should never be the only carrier of meaning.**

### Text on solid fills

There is no single `--text-on-solid`, deliberately. Whether white or near-black
wins on a solid fill is a property of *that ramp*, not a global constant: step 9
luminance varies by hue, and a yellow that still reads as yellow cannot carry
white text at 4.5:1 in any theme. One shared token would drag every ramp toward
the lightness that suits white — which is how a system ends up with an ochre
"warning".

So each solid fill names its own text colour:

| Token | Pairs with |
|---|---|
| `--text-on-interactive` | `--interactive-solid`, `--interactive-solid-hover` |
| `--text-on-ok` | `--status-ok-solid` |
| `--text-on-warn` | `--status-warn-solid` |
| `--text-on-bad` | `--status-bad-solid` |

**[enforced — `test:contrast`]** for every pairing listed in
`src/contrast-policy.json`. A *new* solid fill is only covered once its pairing
is added there — which is the process the policy exists to force.

Only `--text-on-warn` is near-black; the rest are white. Adding a solid fill
means adding its on-colour, and that is the point — the pairing becomes
impossible to forget, and a brand swap that lightens the accent is one mapping
change rather than a component audit.

### The inverted surface

`--surface-inverted` and `--text-on-inverted` are the one surface role that
*flips* with the theme rather than tracking it: near-black on a light page,
near-white on a dark one. Tooltips, inverted banners, anything that has to read
as "not part of this surface".

They are declared once and deliberately **not** redeclared in the dark block.
`var()` resolves at use time, so `var(--n-12)` picks up whichever ramp is
active, and the ramps already invert — adding a dark-block override is the
obvious-looking change that breaks them.

This pair also exists because the Nuxt UI adapter needs it. Nuxt UI's
`--ui-*-inverted` family had no counterpart here, and mapping half of it
produced white-on-white in dark mode. A skin that cannot express "inverted"
cannot adapt to one that can.

---

## Type

**[default]** except where marked otherwise below — mostly judgement, with
reasons attached.

Size, leading and tracking are authored as triplets. Leading tightens as size
grows; tracking goes negative at display sizes. Mixing a size from one step with
the leading of another undoes that, and generally looks wrong.

- **Leading resolves to whole pixels.** **[enforced — `test:layout`]** The scale
  is authored as ratios, and a ratio times a size is usually fractional — 1.6 x
  16px is 25.6px. A fractional block height puts every element below it on a
  fractional `y`, and **a control off the device pixel grid renders its label a
  whole pixel off centre however exact its own CSS is**, because baselines snap
  to the grid while box edges antialias at their true position. Round at the
  point of use, ratio first so a browser without `round()` keeps today's
  behaviour:

  ```css
  line-height: var(--leading-base);
  line-height: round(calc(var(--leading-base) * 1em), 1px);
  ```

  `base.css` does this for `body`. Anywhere else you set leading, do the same.

  **What is gated here is the declaration, not the position** — and that is a
  correction to an earlier draft of this rule. Asserting that controls land on
  the grid is the better test, but it is not portable: a trimmed label's box is
  font metrics, so the same specimen measures 0 controls off the grid under
  three faces and **18 under a fourth**. Gating the outcome in a layer whose
  `--font-sans` is a brand slot fails for the font CI happens to have rather
  than for a defect, which is exactly how it failed a release. The outcome check
  ships separately, as `pixelGridChecks`, for apps that can run it.

  **Its precondition is rounded leading and declared control heights, not a
  pinned font** — a correction, from an adopting app that runs it green on both
  Windows and Linux CI with `--font-sans` left as the system stack. A leading
  rounded with `round(…, 1px)` is integral whatever the face, so block heights
  are integral and controls land on the grid regardless of font metrics. What
  propagates a fraction is a box sized by font metrics rather than by leading,
  and a **trimmed** label is exactly that — which is why the declared height the
  trim rule already demands is the other half of the precondition. It was named for
  pinning because pinning was the only condition under which this package had
  seen it pass.

  **This is invisible under browser zoom**, which is the trap: more device pixels
  per CSS pixel makes the fraction resolvable, so it renders correctly at 125%
  and above. That is exactly how anyone inspects fine typography — zoom in, or
  screenshot at a scale factor. **Judge vertical placement at 100% on a 1x
  display.** A zoomed screenshot proving a label is centred proves nothing about
  what a reader sees, and this document's own optical measurements were taken at
  4x before this was understood.

  Tables are excluded from the check: row heights are distributed by the table
  layout algorithm, which makes no whole-pixel guarantee and is not something a
  token layer can reach.
- Measure: `--measure` (68ch) for prose, `--measure-narrow` (46ch) for
  supporting copy in narrow columns. Prose running full width is hard to read at
  any size.
- Font family is a **brand-layer slot**. `--font-sans` / `--font-display` /
  `--font-mono` are declared here with system fallbacks and swapped at brand.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on numeric columns.
  Without them digits shift width and the column visibly jitters.
- **Single-line control labels use `line-height: 1`** — buttons, inputs, badges,
  chips, tabs. **[enforced — `test:layout`]** The leading scale is for prose. A
  control that inherits body leading gets a line box taller than its glyphs, so
  it looks puffy and the label reads as badly centred. Multi-line controls
  (textarea) keep their size's leading.

  **This rule is the fallback, not the mechanism.** Where `text-box` is
  supported the trim below overrides it entirely: measured, a trimmed label is
  identical at leading 1 and leading 1.6 — 0.31px asymmetry and a 7.7px box in
  both. The leading only decides how the label renders in a browser without
  `text-box`, and how untrimmed text behaves.

  More generally: **when a rule does not fit a third-party control, the answer
  is usually not to force it.** After adapting a whole component library, the
  total override surface was three rules — a height floor, a `translate` on
  label spans, and padding arithmetic on `<input>` — and only one depended on a
  value from that library. Everything else was achieved by *not* applying
  foundation rules to their controls. Forcing a rule that did not fit is what
  caused damage, twice.

  So **do not apply it to a control you did not author.** A library that
  *derives* control height from leading rather than declaring it will collapse:
  Nuxt UI sizes with Tailwind `text-*` utilities carrying prose leading, and
  forcing `line-height: 1` measured out at 26px against our own
  `--control-height-sm` of 32px — while fixing nothing, since asymmetry measured
  1.60px before and after. Apply the trim there and skip the leading.

  **The gate said the opposite of this paragraph, and that is a correction.** As
  shipped it reported any control whose leading exceeded 1.35 — in an app built
  on a component library, every control — and acting on the report cut the
  descenders off two button labels. A check that only sees the DOM cannot tell a
  control you authored from one you adopted, so it now reports one only when all
  three of these hold: nothing inside it is **trimmed** (the trim supersedes the
  leading), nothing inside it **clips** (shrinking a clipping box cuts the ink,
  per the rule below), and **the line box is the control's whole height** —
  under a declared height the label is centred either way and the ratio changes
  nothing. What survives all three is the case the rule is actually about: a
  control puffed by leading it never declared. In practice that is a control you
  authored, arrived at by measurement rather than by asking.
- **Single-line text that shares a row with an icon, or sits in a fixed-height
  box, is trimmed cap-to-baseline.** **[enforced — `test:layout`]**
  `text-box: trim-both cap alphabetic`. This is the mechanism; the leading rule
  above is its fallback. It works on any control, including one you did not
  author — on Nuxt UI the trim alone took asymmetry from 1.60px to 0.00.

  Scope is wider than "control label": buttons, badges, chips, tabs, menu items,
  table cells, list rows, status lines. It does **not** reach an icon inside
  running prose — `text-box-trim` affects only a block's first and last line
  boxes, so it does nothing for a paragraph's interior. That case aligns on the
  baseline instead.

  Ascenders and descenders extend past the trimmed box by design. Trimming to
  the ink instead makes the box shorter than the painted glyphs and the label
  rides high. Cap-to-baseline is what keeps every label in a row at the same
  height regardless of which letters it contains — and it lands a paired icon on
  the capital beside it without any nudge.

  **`text-box` needs a real block box.** It does nothing to the anonymous item a
  bare text node becomes inside a flex container, so **a label needs its own
  element**. Without browser support the label renders as it did before:
  imperfect rather than broken.

  **Do not shrink the line box of a box that clips.** **[enforced —
  `test:layout`]** The trim works because ascenders and descenders extend past
  cap and baseline — which is precisely what a clipping box cuts. An `<input>`
  always clips its own content; a label carrying a truncation utility clips too.

  **This is wider than trimming, and stating it as "only trim a box with visible
  overflow" was too narrow.** `text-box-trim` is one way to shrink a line box.
  **`line-height` is the other, and it does identical damage.** Measured in a
  consuming app: a truncating label span taken to `line-height: 1` gave a 14px
  box around a 19px font box, and the descenders were cut off "Loading" and
  "Secondary". The gate that reads the trim property was green throughout,
  because nothing was trimmed.

  Note the failure mode, because it is the reason this is a rule rather than a
  judgement call: **a clipped label measures perfectly centred.** It is cut at
  both ends, so every check asking "is this centred" returns yes — for either
  cause. What tells the truth is **the box's height against the font's**, which
  needs to know nothing about how the box got small. A passing gate and a
  screenshot are not enough here.

  Two gates, because they catch different halves. One reads `text-box-trim` on a
  clipping element: a regression to no trim measures about a pixel and slips
  under any tolerance geometry can safely use. The other measures every clipping
  element that holds text against the font box its text is set in — visually
  hidden text excluded, since clipping to a pixel is that technique, not a
  defect.

  **Where you cannot trim, lift.** Trimming and lifting are different operations
  and the distinction matters: the trim *shrinks the line box* while the ink
  stays put, which is why it clips. Moving padding from one side to the other
  *resizes nothing* — the content box and the clip region travel together, so
  the glyphs never move relative to what would cut them. It cannot clip,
  structurally.

  Prefer `translate` on an inner label element where one exists: it lifts
  without knowing the padding and without participating in layout, so height
  cannot drift as a side effect. Padding arithmetic is the fallback for controls
  with nothing inside to reach, like `<input>`.

  Two constraints. **Only controls with a text label** — an icon-only control
  has no cap box to lift onto, and lifting it just decentres the glyph. And it
  is a **correction, not a constant**: the value is
  `((ascent − descent) − cap) / 2`, which depends on the font, and `--font-sans`
  is a brand slot. Gate the asymmetry and the resulting height, never the pixel
  value, or CI's font metrics will fail the author's tuning.

  **This package therefore ships no lift, and that is a deliberate reversal.**
  One was added and removed: `padding-bottom: 0.05em` took the specimen's input
  from +1.00 to +0.30 on one face, and from −1.00 to **−1.70** on another. The
  sign of the error flips between fonts, so a fixed correction is not merely
  inexact across a brand swap — it can be worse than doing nothing. Pin your
  font and the technique is sound; ship it in a brand-agnostic layer and it is
  not. It was caught by the release gate rather than by review, because CI
  renders with different fonts than the author.

  **A correction that cancels a half-pixel must not exceed that half — round it
  down, never up.** At 14px the lift is 0.5px; writing it as `0.036em` gives
  0.504px, four thousandths over, which puts the baseline at 20.996 and floors it
  to 20 — a whole pixel the wrong way. `0.0357em` gives 21.0002 and floors
  correctly. Overshooting by any amount at all moves the snapped baseline a full
  pixel in the opposite direction.

  *No CSS-only exact answer exists.* The correction needs the font's ascent and
  descent; CSS exposes `cap`, `ex`, `ch`, `ic`, `lh` and `rlh` and neither of
  those, so no `calc()` reaches it. An exact fix would mean measuring the font at
  runtime and publishing a derived `--optical-shift`. That is a real option and
  it is **declined here**: this package ships CSS with no runtime, and a token
  that only exists once JavaScript has run is a different contract. The tuned em
  value is the answer, with its inexactness recorded rather than hidden.

  **Trimming removes height, so whatever was leaning on that height must declare
  it.** **[enforced — `test:layout`]** Where the height came from matters:

  | Height comes from | Effect of trimming |
  |---|---|
  | Padding (inputs, textareas) | None — height-neutral |
  | The label's line box (buttons, chips, badges) | Collapses |

  Measured here: a button loses its floor and drops 16px to 11.8px, a badge
  without an icon 21px to 17.7px, an input does not move. Ours survive by
  design in one case and by luck in the other — `.btn` floors at
  `--control-height-md`, while every badge in the specimen happens to contain an
  icon taller than its label. A text-only badge beside an icon badge would not
  match. So: **a control with a trimmed label declares its own height**, via
  `--control-height-*` or an explicit floor. This package has no badge-height
  token today; that is a gap, not a licence to leave it to the line box.

  The gate accepts a `min-height` (including `min-block-size`), vertical
  padding, or a content box measurably taller than its tallest child — which is
  how `height` and `block-size` are accepted, along with a stretching flex or
  grid parent. It has to be measured, because a declared height is invisible:
  `getComputedStyle` reports the used value in pixels whether it was declared or
  derived, so there is nothing to read. An earlier version tested only the two
  properties and told an app that pinned a row with `block-size` — the stronger
  statement of the two, since it pins rather than floors — that it had declared
  neither. What is deliberately *not* accepted is a box sized by a tall sibling
  of the label, such as an icon: that is the badge case above, where the height
  is luck.

---

## Spacing — proximity is structure

The scale is named by *relationship*, not size. That is what makes the Gestalt
rule self-enforcing rather than a thing to remember.

| Token | Value | Relationship |
|---|---|---|
| `--gap-tight` | 8px | inside one thing: icon ↔ label, and label ↔ control ↔ hint |
| `--gap-related` | 12px | a heading and its supporting text; items sitting in a row |
| `--gap-item` | 20px | field ↔ field |
| `--gap-group` | 40px | group ↔ group |
| `--gap-section` | 80px | section ↔ section |

Each step is ~1.6–2× the previous, which guarantees **space within a group is
always visibly smaller than space around it**. Equal spacing everywhere is the
single most common failure in generated UI — and it is visible in a screenshot,
which makes it checkable.

### A field is one group

**[enforced — `test:layout`]** A label, its control, and the hint or error
beneath it are one thing. So:

- the gap **below** the control must never exceed the gap **above** it, and
- both must be visibly smaller than the gap between fields.

Getting this backwards is subtle and common: an error sitting further from its
input than the label does reads as belonging to the *next* field, or to nothing.
The eye groups by proximity before it reads anything, so the message that
matters most ends up looking detached from the control it describes.

This is also why the table above puts field internals on `--gap-tight` rather
than `--gap-related`. At 8px against a 20px field gap the grouping is obvious;
at 12px the ratio falls to 1.67 and the error starts to float between two
fields. The value matters less than the *contrast* with the gap around it.

**A hint or error must also be linked programmatically**, with
`aria-describedby` on the control. Proximity is a sighted-user affordance; it
conveys nothing to a screen reader. No linter checks this — axe has no rule for
it — so it is checked by `test:layout` instead.

Reach for the relationship token, not the raw `--space-*` value.

**[enforced — `lint:css`]**, but only on `gap`, `row-gap`, `column-gap`,
`margin-top` and `margin-bottom`. A raw `--space-*` in `padding` or a `margin`
shorthand passes today. That is a gap in the check, not permission.

---

### The selection box is the font box

**You can centre the font box or the cap box, not both.** They differ by about
0.5px at 14px.

The text-selection highlight paints the **font's** box, which is wildly
asymmetric around the ink: the ascent must clear diacritics and lowercase
ascenders while the descent only has to clear `g j p q y`. Measured at 14px —
declared ascent 15px against a 10px cap height leaves 5px of slack above, while
a 4px descent against a 3px descender leaves 1px below. Five to one.

Neither `line-height` nor `text-box-trim` changes it. A label with
`line-height: 12px` *and* the trim applied still paints a 16px inline box, and
`::selection` styles colour only.

So centre the **cap box** — it is what the eye reads — and accept that the
highlight will then sit slightly high. **The measurement that answers "is this
centred" is cap-top to baseline against the control's box, never the
highlight.** A reviewer using the selection box as the yardstick is measuring
the font's metrics, not your layout.

---

## Depth — nesting policy

**[default]**

**Start with at most two nested surfaces.**

| Level | Default treatment |
|---|---|
| 1 | `--surface-base` + border |
| 2 | `--surface-raised` + border |
| 3+ | No surface. Left rule + indent, or drill into its own view. |

The reasoning: every border costs horizontal space, and past roughly three
levels stacked panels stop reading as hierarchy and start reading as mush.
Rule-and-indent scales to any depth, which is what usable tree views converge
on. So that is where to start.

**This constrains treatment, not depth, and nothing enforces it.** No lint rule
and no test checks nesting — unlike the Tier 2 rule, which is machine-checked
precisely because it is non-negotiable. Arbitrary nesting is expected; a tree
renderer *is* depth.

There are good reasons to ignore the default. A proof of concept that shows
recursion literally rather than calmly. A debugging view or data inspector where
the structure *is* the content. Deep bordered nesting is ugly and clear, and
sometimes clear wins. Build it. If it starts spreading beyond the place it was
meant for, that is the moment to revisit — not before.

An overlay — modal, drawer, popover — starts a new surface context, so the count
restarts inside it.

---

## Elevation

**[enforced — `lint:css`, `lint:tokens`]** that a shadow is one of the two
tokens: raw `box-shadow` values and Tailwind `shadow-*` classes are both
rejected. **[default]** that only floating things get one — no check knows
whether your element floats.

Border-first: **shadow means "floats above the page".** Nothing in normal
document flow gets a shadow — grouping is done with borders and whitespace.

Only `--shadow-popover` (dropdowns, tooltips, popovers) and `--shadow-overlay`
(modals, drawers). There is no `--shadow-card`, deliberately.

---

## State vocabulary

Defined once so nothing invents its own: `default`, `hover`, `active`,
`focus-visible`, `disabled`, `error`, `loading`, `empty`.

- **[default]** **Focus is a ring, not a border change.** In a border-first
  system a colour-only border swap is too quiet to serve as focus. 2px, 2px
  offset, `--focus-ring`. The ring's 3:1 contrast is
  **[enforced — `test:contrast`]**; using a ring at all is not — but `base.css`
  applies it globally, so adopting that file makes it true by default.
- **[default]** Minimum touch target `--target-min` (44px). `test:a11y` enforces
  the WCAG 2.2 SC 2.5.8 floor of 24px, not 44 — the larger figure is the Apple
  HIG number and the better default, but only the smaller one is checked.
- **[default]** Empty states get a title, one line of orientation, and one
  action. An empty screen is an invitation to act, not an apology.

---

## Motion

**[default]**, except the reduced-motion handling below, which is automatic.

Durations 120 / 180 / 260ms. Enter decelerates (`--ease-out`), exit accelerates
(`--ease-in`). Animate `background`, `border-color`, `color`, `opacity`,
`transform` — animating anything that triggers layout will jank.

`prefers-reduced-motion` collapses all durations to 1ms in `tokens.css`. It is
handled at the token layer, so components get it for free and cannot forget it.

---

## Layout hints that constrain markup

**[default]** throughout — none of this is checked. It is recorded because
these decisions bind what markup a renderer emits, and deciding once is cheaper
than deciding per component. A renderer that deliberately does otherwise is
fine; one that does otherwise by accident is drift.

- **Grouping is border-first.** Groups get a bordered container, not a shadowed
  card and not a tinted background. A renderer emitting a group emits a border.
- **Label/value pairing is top-label.** Label above control, `--gap-tight`
  between. Inline labels would require a grid the renderer must produce; we
  don't use them.
- **Numeric columns right-align, text columns left-align.** No centering. The
  header cell takes the alignment of **its own column** — a right-aligned number
  under a left-aligned header is the most common way this is done wrong.
  **[enforced — `test:layout`]**
- **An icon paired with a label centres on the label, never on the baseline.**
  **[enforced — `test:layout`]** The pair is a flex container with
  `align-items: center` and `--gap-tight` between, and the icon is
  `display: block`. This applies inside a control and outside one — anywhere an
  icon sits beside text.

  *Two different mechanisms land in the same place, and it is worth knowing
  which you are debugging.* An **inline SVG** defaults to baseline alignment,
  which puts its box bottom on the baseline and leaves it riding visibly low. An
  **icon font** is the opposite case: the glyph already carries the correct
  baseline relationship, drawn to the same cap height as the text, so it needs
  no correction at all. Reasoning from the SVG model while debugging an icon
  font will send you looking for an offset that should not exist — and no fixed
  nudge can align an icon font anyway, because per-glyph ink varies across the
  set (at a 100px em: check 75/7, warning 88/7, circle-x 88/13, clock 88/13).
  Any constant is wrong for most of the set and the icons visibly jump between
  adjacent controls. Alignment comes from the shared baseline, never from a
  correction.
- **Icons are sized in `em`, never in pixels.** **[enforced — `test:layout`]**
  An icon beside a label is `1em`, so it tracks that label through every size,
  theme and brand swap without anyone maintaining the relationship.

  *There is deliberately no `--icon-size` token.* A parallel icon scale is one
  more thing that can drift out of step with the type scale; a derived size
  cannot. The same reasoning as the proximity scale — encode the relationship,
  not the number.

  **The caveat that bites: `1em` assumes artwork with optical padding inside its
  viewBox.** Measured across this package's own icons, the artwork fills between
  67% and 87% of the box — a check mark is inherently smaller than a warning
  triangle. **Icon fonts are not bounded by that range and can exceed 100%:**
  Font Awesome Pro 7.3.1 paints 1.085em against declared metrics of 0.971em, so
  the glyph overflows the em box by ~5.7% on each side and renders 25–60% larger
  than this package's own artwork at the same `1em`.

  Sets are drawn so that varying fill still reads as even optical weight, which
  is why **using one icon set is part of the rule**. Drop in a glyph that fills
  its box differently — bleeding to the viewBox edge, or past it — and it will
  look oversized at exactly the same `1em`, and no gate will tell you.

  Two consequences follow. **The element box is not a proxy for an icon's visual
  size**: under `line-height: 1` the box is exactly 1em while the ink may be
  more, so a gap measured from that edge, or a test assertion about it, is
  working with a smaller number than what is painted. The overflow is symmetric
  and nothing clips, so this is a correctness note rather than a defect. And
  **an icon font agreeing with `1em` is a property of that face, not a
  guarantee** — Font Awesome's check happens to paint 9.00px of ink above the
  baseline against a 9.00px cap height at 12px, which is why it reads as the
  same size as the capital beside it.
- **An icon-only control is a different thing and needs three answers.**
  It has no label to size against, and nothing for a screen reader to read.
  - Size the icon as a deliberate multiple of the control's own font-size —
    still `em`, still derived, never a raw pixel value. **Choose a multiple that
    lands on a whole pixel, or round the line box it produces**: `1.25em` of a
    14px control is 17.5px, and `line-height: 1` on that is a fractional line
    box, which the whole-pixel rule above will catch.
    `line-height: round(1em, 1px)` keeps the size and makes the box 18px.
  - Give it the full `--target-min` square. **[enforced — `test:layout`]** A
    control whose entire affordance is a small glyph is the one that can least
    afford a small hit area.
  - Give it an accessible name; the icon itself stays `aria-hidden`.
    **[enforced — `test:a11y`]** — axe reports a nameless button as a critical
    `button-name` violation.
- **Reserve the scrollbar gutter** (`scrollbar-gutter: stable` on the root).
  **[enforced — `test:layout`]** Otherwise a centred layout shifts horizontally
  the moment content grows past one viewport, so moving between a short page and
  a long one makes the whole interface twitch. Provided by `base.css`.
- **Truncate with a title attribute; never wrap in table cells.**
- **On a fully rounded shape, the content must clear the corner radius.**
  **[enforced — `test:layout`]** A pill's radius is half its height, so at the
  ends the shape curves away from the label — and content starting inside that
  radius leaves the text sitting *inside* the curve. It reads as uneven against
  the top and bottom no matter what the numbers say, because the eye measures
  the gap to the nearest edge and the nearest edge is diagonal.

  What must clear the radius is **the inline padding plus the border**, since
  the radius is measured on the border box. Deriving `padding-inline` as
  `radius - border-width` therefore puts the content exactly on the tangent
  where the straight edge begins, which is what the rule means — and the gate,
  by comparing padding alone, rejected that derivation by the width of the
  border.

  Geometry, not taste: no choice of nice token values satisfies it, only the
  relationship does. Our own badge shipped at `--space-2` against a 10.5px
  radius and needed `--space-3`. It does not bind on a gently rounded shape — a
  6px radius under 12px of padding already clears — which is why it is stated
  for fully rounded shapes specifically.
- **A label that shares a row with an icon gets its own element**, never a bare
  text node. `text-box` cannot trim an anonymous flex item, so the markup has to
  give it something to trim. Same class of constraint as top-label pairing: it
  looks like styling and it binds what a renderer emits.

---

## Contrast policy

This layer does not chase 100% AA. A foundation that did would be limited to the
palette that survives the strictest reading of every success criterion, and it
would look it. What it does instead is make every deviation **declared** rather
than accidental, and machine-checked either way.

**[enforced — `test:contrast`]** for every pair in the manifest.

`src/contrast-policy.json` is the manifest: every pair that matters, the ratio
required of it, and — where that ratio is below AA — why. `tests/contrast.spec.ts`
asserts it in both themes. Being unlisted is not an exemption; it is the one
thing the policy does not permit.

The manifest is checked rather than the specimen, on purpose. `axe-core` can only
see pairs the specimen happens to render, which misses hover states entirely and
misses any token no component uses yet. It is also text-only, so it never
verifies `--border-strong` or `--focus-ring` — the two tokens the rest of this
document leans on hardest.

**Hard floors:**

- Text on any surface — 4.5:1
- `--border-strong`, `--focus-ring` — 3:1. If these drift, the border-first
  thesis is gone and nothing else here holds up.

**Declared below AA:**

- **Solid fills in dark mode** carry a 3:1 floor rather than 4.5:1. Keeping the
  accent vivid is worth more than the last third of a ratio point. Consumers who
  need strict AA override four tokens in their `brand.css` — the recipe is in
  CONTRIBUTING.md.
- **Status borders** on status fills have no floor. They are decorative; a
  badge's meaning is carried by its text, which passes 4.5:1.
- `--text-disabled` — exempt under WCAG 1.4.3, with the corollary above.

---

## Enforcement

Six gates run in CI on every pull request. This is the complete list — if a
statement above is marked **[enforced]**, one of these is what enforces it.

| Gate | Covers |
|---|---|
| `lint:css` | stylelint: raw hex, non-token colour and `box-shadow` values, Tier 1 primitives outside the files allowed to declare them, raw `--space-*` on gap and vertical-margin properties |
| `lint:tokens` | `check-tokens.mjs`: arbitrary Tailwind values (`p-[13px]`), raw hex, Tier 1 references, direct `--ui-*` use, Tailwind `shadow-*` classes — including inside template strings, which an AST linter cannot see |
| `test:a11y` | axe-core over the specimen in both themes: WCAG 2.0 / 2.1 / 2.2 A and AA — ARIA, focus order, target size at the 24px floor |
| `test:contrast` | `src/contrast-policy.json` asserted pair by pair in both themes, including pairs no component renders yet |
| `test:layout` | The fourteen `layout-checks` assertions — column alignment, icon centring and sizing, target size, field grouping, the trim with its height and clipping consequences, whole-pixel leading, scrollbar gutter, pill geometry — run against the specimen, and against fixtures that prove each one still fires |
| `test:visual` | Screenshot diff of the specimen, two viewports, both themes |

**What is not enforced:** everything marked **[default]**. Type pairing,
measure, tabular numerals, nesting depth, whether a shadow belongs on the thing
you put it on, whether a given border conveys information, label placement,
truncation, empty-state shape. Judgement calls with reasons recorded, not
gates.

Human review is then Tier 3 — does this look and feel right — plus those
judgement calls. That is the part that actually needs a person.

---

## The optional base layer

`tokens.css` declares custom properties and nothing else. That is a promise
worth keeping: it has no side effects, cannot collide with an existing reset,
and can be adopted by any app without argument.

Some rules cannot be expressed as a token, though — `box-sizing`, the scrollbar
gutter, the focus ring. `base.css` is where those live, as a **separate, opt-in
import**. It emits real rules, which is exactly why it is not folded into
tokens.css.

Its scope is rules that are universal, brand-agnostic, and implement something
already stated in this document. **Components are permanently out of scope** —
no `.btn`, no `.card`. The moment that file grows a component it stops being
safe to adopt, and the two-import split stops meaning anything.

The specimen links it, so it is covered by every gate rather than shipped and
hoped.

---

## Open, deliberately

Font families. Brand hue. Anything about components — what exists, their props,
composition, or a renderer. This layer must stay ignorant of all of it.
