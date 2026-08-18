# @widenode/ui-foundation

Brand-agnostic design token foundation. Vanilla CSS custom properties, OKLCH
ramps, border-first. No framework, no build step, no runtime dependencies.

This package is the **visual spec** for Widenode UI, expressed as tokens a
machine can check. [`RULES.md`](RULES.md) is the durable asset; everything else
serves it.

> **Status: pre-1.0.** Tier 2 token names are not yet stable, and removing or
> renaming one is breaking even on a 0.x bump. Pin an exact version until 1.0.

---

## The one rule

**Components reference Tier 2 semantic tokens only.** Never a Tier 1 primitive
(`--n-7`, `--a-9`), never a raw value (`#666`, `12px`, `p-[13px]`).

This single constraint is what keeps two independent swaps possible:

| Swap | What changes | What doesn't |
|---|---|---|
| **Brand** | Tier 1 ramps, in your own `brand.css` | Everything else |
| **Skin** | The Tier 2 mapping | Every component |

Break it once and both axes quietly die — which is why it is linted rather than
watched for.

## Install

```bash
npm install @widenode/ui-foundation
```

```css
@import "@widenode/ui-foundation/tokens.css";
```

That is the whole integration. The stylesheet declares custom properties and
nothing else — no reset, no utilities, no side effects beyond the tokens.

Dark mode is an attribute on the root element:

```html
<html data-theme="dark">
```

## What you get

**Tier 1 — primitives.** Two 12-step OKLCH ramps (neutral `--n-*`, accent
`--a-*`) following the Radix role model, plus status ramps, a type scale
authored as size/leading/tracking triplets, spacing, radius and motion.

**Tier 2 — semantic roles.** The only layer components touch:

| Group | Tokens |
|---|---|
| Surface | `--surface-base` `--surface-raised` `--surface-sunken` `--surface-overlay` `--surface-inverted` |
| Text | `--text-primary` `--text-secondary` `--text-disabled` |
| Text on fills | `--text-on-interactive` `--text-on-ok` `--text-on-warn` `--text-on-bad` `--text-on-inverted` |
| Border | `--border-subtle` `--border-default` `--border-strong` |
| Interactive | `--interactive-solid` `--interactive-solid-hover` `--interactive-text` `--interactive-bg-hover` `--interactive-bg-active` `--interactive-subtle-bg` `--interactive-subtle-border` |
| Focus | `--focus-ring` `--focus-ring-width` `--focus-ring-offset` |
| Status | `--status-{ok,warn,bad}-{bg,border,solid,text}` |
| Elevation | `--shadow-popover` `--shadow-overlay` |
| Proximity | `--gap-tight` `--gap-related` `--gap-item` `--gap-group` `--gap-section` |
| Measure | `--measure-narrow` `--measure` `--measure-wide` |
| Controls | `--control-height-{sm,md,lg}` `--control-pad-x` `--target-min` |

A few of these carry decisions worth knowing before you use them:

- **Three border tokens, and the distinction is load-bearing.** A hairline that
  reads well on white sits near 1.3:1. `--border-subtle` and `--border-default`
  are decorative and below 3:1 by design; **`--border-strong` meets 3:1 and is
  required** for form controls, selected state, and anything a user must
  perceive to operate. This is the most common way a flat aesthetic fails an
  audit.
- **Spacing is named by relationship, not size.** `--gap-related` is
  label-to-input; `--gap-item` is field-to-field. Each step is ~1.6–2× the last,
  which is what guarantees space *within* a group stays smaller than space
  *around* it. Reach for these, not the raw `--space-*` values.
- **Shadow means "floats above the page."** There is no `--shadow-card`,
  deliberately. Grouping is done with borders and whitespace.
- **Never nest more than two surfaces.** Level 3+ uses a left rule and indent,
  or drills into its own view.
- **Each solid fill names its own text colour.** Whether white or near-black
  wins is a property of the ramp, not a global constant — no yellow that still
  reads as yellow carries white text at 4.5:1.

Full reasoning for all of it is in [`RULES.md`](RULES.md).

## Overriding the brand

Override Tier 1 in your own `brand.css`, and nowhere else:

```css
@import "@widenode/ui-foundation/tokens.css";

:root {
  --a-9:  oklch(0.52 0.19 25);   /* your accent */
  --a-10: oklch(0.47 0.18 25);
  /* ...the rest of the ramp */
  --font-sans: "Your Face", ui-sans-serif, system-ui, sans-serif;
}
```

Font families are deliberately a brand-layer slot. The shipped stack is system
fallbacks.

## Nuxt UI adapter

Maps Nuxt UI v4's `--ui-*` layer onto Tier 2, so Nuxt UI becomes a consumer of
this system rather than a parallel one. It creates no dependency on Nuxt UI,
Vue or Tailwind — it is a stylesheet that assigns the names Nuxt UI reads.

```css
@import "tailwindcss";
@import "@nuxt/ui";
@import "@widenode/ui-foundation/tokens.css";
@import "@widenode/ui-foundation/adapters/nuxt-ui.css";  /* last */
```

Order matters, and your app must set `data-theme` alongside Nuxt UI's `.dark`
class. Both are documented at the top of the adapter, along with the handful of
`--ui-*` tokens that cannot be mapped and why.

## Contrast policy

This layer does **not** chase 100% AA — a foundation that did would be limited
to the palette that survives the strictest reading of every criterion, and would
look it. Instead every deviation is *declared* rather than accidental, and
machine-checked either way.

[`src/contrast-policy.json`](src/contrast-policy.json) lists every pair that
matters, the ratio required of it, and — where that is below AA — why. Being
absent from the list is the one thing the policy does not allow.

The manifest ships, so a consuming app can raise the floors and run the same
assertions against its own brand ramps:

```js
import policy from '@widenode/ui-foundation/contrast-policy.json' with { type: 'json' }
```

Solid fills in dark mode sit on a declared 3:1 floor so the accent can stay
vivid. The three-token override for strict AA is in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Shared stylelint config

Enforces the one rule in your own repo:

```json
{ "extends": ["@widenode/ui-foundation/stylelint"] }
```

It bans raw hex, non-token colour values and Tier 1 references outside the files
allowed to declare them, and accepts BEM class names. Its plugins ship as real
dependencies so they resolve through this package.

A text-level backstop catches what an AST linter cannot see — arbitrary Tailwind
values and Tier 1 references inside template strings:

```bash
node node_modules/@widenode/ui-foundation/scripts/check-tokens.mjs src
```

## Specimen

[`specimen/index.html`](specimen/index.html) renders the whole system against
content that actually breaks it: overlong names, tabular numbers, mixed status,
and nothing at all. It consumes the published `tokens.css` rather than a copy,
so it is a live test rather than documentation that drifts. It is also the
target of the a11y and visual regression suites.

Serve it from the repo root — it will not render from `file://` in every context,
since it loads `tokens.css` as a relative subresource.

## Contributing

Fork and PR; all gates must pass; token changes need a rationale in `RULES.md`.
See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT © Widenode
