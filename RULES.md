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
  it looks puffy and the label reads as badly centred even though the flex
  centring is exact. Multi-line controls (textarea) keep their size's leading.

---

## Spacing — proximity is structure

The scale is named by *relationship*, not size. That is what makes the Gestalt
rule self-enforcing rather than a thing to remember.

| Token | Value | Relationship |
|---|---|---|
| `--gap-tight` | 8px | icon ↔ label |
| `--gap-related` | 12px | label ↔ input |
| `--gap-item` | 20px | field ↔ field |
| `--gap-group` | 40px | group ↔ group |
| `--gap-section` | 80px | section ↔ section |

Each step is ~1.6–2× the previous, which guarantees **space within a group is
always visibly smaller than space around it**. Equal spacing everywhere is the
single most common failure in generated UI — and it is visible in a screenshot,
which makes it checkable.

Reach for the relationship token, not the raw `--space-*` value.

**[enforced — `lint:css`]**, but only on `gap`, `row-gap`, `column-gap`,
`margin-top` and `margin-bottom`. A raw `--space-*` in `padding` or a `margin`
shorthand passes today. That is a gap in the check, not permission.

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
  **[enforced — `test:contrast`]**; using a ring at all is not.
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
  `align-items: center` and `--gap-tight` between; the icon is `display: block`
  and sized in `em`. An inline SVG defaults to baseline alignment, which puts
  its bottom edge on the baseline and leaves it riding visibly low. This applies
  inside a control and outside one — anywhere an icon sits beside text.
- **Reserve the scrollbar gutter** (`scrollbar-gutter: stable` on the root).
  **[enforced — `test:layout`]** Otherwise a centred layout shifts horizontally
  the moment content grows past one viewport, so moving between a short page and
  a long one makes the whole interface twitch.
- **Truncate with a title attribute; never wrap in table cells.**

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
| `test:layout` | Table headers match their column's alignment; single-line controls do not inherit prose leading |
| `test:visual` | Screenshot diff of the specimen, two viewports, both themes |

**What is not enforced:** everything marked **[default]**. Type pairing,
measure, tabular numerals, nesting depth, whether a shadow belongs on the thing
you put it on, whether a given border conveys information, label placement,
truncation, empty-state shape. Judgement calls with reasons recorded, not
gates.

Human review is then Tier 3 — does this look and feel right — plus those
judgement calls. That is the part that actually needs a person.

---

## Open, deliberately

Font families. Brand hue. Anything about components — what exists, their props,
composition, or a renderer. This layer must stay ignorant of all of it.
