# Foundation layer — rules

Brand-agnostic visual system. Balanced density, border-first, 4–6px radius.
Consumed by any component methodology; knows nothing about components.

---

## The one rule

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
- `--border-strong` — **required** for form controls, selected state, and
  anything a user must perceive to operate. Meets 3:1.

This is the most common way a flat hairline aesthetic fails an audit.

`--text-disabled` deliberately fails AA. Disabled controls are exempt under
WCAG 1.4.3, but the corollary is absolute: **disabled state must never be the
only carrier of meaning.**

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

Size, leading and tracking are authored as triplets. Leading tightens as size
grows; tracking goes negative at display sizes. Never mix a size from one step
with the leading of another.

- Measure: `--measure` (68ch) for prose, `--measure-narrow` (46ch) for
  supporting copy in narrow columns. Never let prose run full width.
- Font family is a **brand-layer slot**. `--font-sans` / `--font-display` /
  `--font-mono` are declared here with system fallbacks and swapped at brand.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on every numeric
  column. Non-negotiable in data views.

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

---

## Depth — nesting policy

**A default, not a gate: start with at most two nested surfaces.**

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

Border-first: **shadow means "floats above the page".** Nothing in normal
document flow gets a shadow — grouping is done with borders and whitespace.

Only `--shadow-popover` (dropdowns, tooltips, popovers) and `--shadow-overlay`
(modals, drawers). There is no `--shadow-card`, deliberately.

---

## State vocabulary

Defined once so nothing invents its own: `default`, `hover`, `active`,
`focus-visible`, `disabled`, `error`, `loading`, `empty`.

- **Focus is a ring, not a border change.** In a border-first system a colour-only
  border swap is too quiet to serve as focus. 2px, 2px offset, `--focus-ring`.
- Minimum touch target `--target-min` (44px). WCAG 2.2 SC 2.5.8 floor is 24px;
  44px is the Apple HIG figure and the better default.
- Empty states get a title, one line of orientation, and one action. An empty
  screen is an invitation to act, not an apology.

---

## Motion

Durations 120 / 180 / 260ms. Enter decelerates (`--ease-out`), exit accelerates
(`--ease-in`). Animate `background`, `border-color`, `color`, `opacity`,
`transform` — nothing that triggers layout.

`prefers-reduced-motion` collapses all durations to 1ms in `tokens.css`. It is
handled at the token layer, so components get it for free and cannot forget it.

---

## Layout hints that constrain markup

These look like style but bind what markup a renderer may emit — decide once:

- **Grouping is border-first.** Groups get a bordered container, not a shadowed
  card and not a tinted background. A renderer emitting a group emits a border.
- **Label/value pairing is top-label.** Label above control, `--gap-tight`
  between. Inline labels would require a grid the renderer must produce; we
  don't use them.
- **Numeric columns right-align, text columns left-align.** No centering.
- **Truncate with a title attribute; never wrap in table cells.**

---

## Contrast policy

This layer does not chase 100% AA. A foundation that did would be limited to the
palette that survives the strictest reading of every success criterion, and it
would look it. What it does instead is make every deviation **declared** rather
than accidental, and machine-checked either way.

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

Most of Tier 1 is machine-checkable, so it should not consume review attention:

- `axe-core` via Playwright in CI — contrast, target size, ARIA, focus order
- `eslint-plugin-vuejs-accessibility`
- Lint rule banning arbitrary Tailwind values (`p-[13px]`)
- Lint rule banning Tier 1 primitives and raw hex outside `tokens.css`

Review is then only Tier 3: does this look and feel right. That is the only
part that needs a human.

---

## Open, deliberately

Font families. Brand hue. Anything about components — what exists, their props,
composition, or a renderer. This layer must stay ignorant of all of it.
