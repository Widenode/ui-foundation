# Integrating @widenode/ui-foundation

A complete recipe for wiring this package into an app. If you are picking this
up cold — human or agent — read this file first and
[`RULES.md`](RULES.md) second. RULES.md is the spec and explains *why*; this
file is just the *how*.

---

## 1. Install

```bash
npm install @widenode/ui-foundation
```

**Pin the exact version.** Tier 2 token names are not stable before 1.0, and a
renamed CSS custom property fails silently to `unset` — nothing type-checks it.

---

## 2. Plain app, no framework

```css
@import "@widenode/ui-foundation/tokens.css";
```

```html
<html data-theme="light">
```

That is the entire integration. The stylesheet declares custom properties and
nothing else — no reset, no utilities. Switch themes by setting
`data-theme="dark"` on the root element.

---

## 3. Nuxt + Nuxt UI + Tailwind v4

Verified against Nuxt UI 4.10. If their scaffold has moved, their docs win —
check the token names in
`node_modules/@widenode/ui-foundation/src/adapters/nuxt-ui.css`, which lists
what is mapped and what deliberately is not.

### 3.1 Stylesheet — order matters

`app/assets/css/main.css`:

```css
@import "tailwindcss";
@import "@nuxt/ui";
@import "@widenode/ui-foundation/tokens.css";
@import "@widenode/ui-foundation/adapters/nuxt-ui.css";
@import "./brand.css";
```

**Do not wrap these in `layer()`.** Nuxt UI declares its `--ui-*` tokens inside
`@layer theme`; these imports are unlayered, and unlayered styles beat layered
ones regardless of source order. Writing `@import "..." layer(theme)` puts them
in the same layer and hands the decision back to source order.

### 3.2 Theme attribute — the thing that will bite you

Nuxt UI toggles a `.dark` **class**. This package keys on a `[data-theme]`
**attribute**. CSS cannot set an attribute, so the app must drive both. In
`app.vue`:

```vue
<script setup lang="ts">
const mode = useColorMode()
useHead({ htmlAttrs: { 'data-theme': () => mode.value } })
</script>
```

Skip this and `.dark` flips while the ramps stay light — the whole system
silently renders in light mode. **It is the first thing to check** when dark
mode "doesn't work".

### 3.3 What the adapter does and does not cover

Mapped: every `--ui-*` background, text and border role, plus the six colour
aliases. `--ui-border-accented` deliberately points at `--border-strong` so
Nuxt UI's form controls clear 3:1, which their default does not.

Not mapped, on purpose: `--ui-radius` (mapping it creates a circular reference,
and their 0.25rem default already yields our scale), `--ui-container` and
`--ui-header-height` (no Tier 2 equivalent).

`--ui-primary` and its five siblings are **hooks Nuxt UI references but never
defines**. Without the adapter they resolve to nothing rather than falling back
to a default — a loud failure, which is the point.

---

## 4. Brand overrides

Tier 1 primitives are overridden in your own `brand.css` **and nowhere else**:

```css
:root {
  /* accent ramp — 12 OKLCH steps, Radix role model */
  --a-9:  oklch(0.52 0.19 25);   /* solid fill      */
  --a-10: oklch(0.47 0.18 25);   /* solid hover     */
  --a-11: oklch(0.45 0.17 25);   /* accent text     */

  --font-sans: "Your Face", ui-sans-serif, system-ui, sans-serif;
}
```

Font families are deliberately a brand-layer slot; the shipped stack is system
fallbacks.

If your accent lightens, re-check `--text-on-interactive`. Whether white or
near-black wins on a solid fill is a property of that ramp, not a constant —
see the contrast policy below.

---

## 5. Enforcement

Two layers, because an AST linter cannot see Tailwind classes inside template
strings and a text scanner cannot understand CSS.

`.stylelintrc.json`:

```json
{ "extends": ["@widenode/ui-foundation/stylelint"] }
```

If stylelint cannot resolve that specifier, try the literal path
`./node_modules/@widenode/ui-foundation/stylelint/index.json` before changing
anything else.

Text-level backstop, for `.vue` files:

```bash
node node_modules/@widenode/ui-foundation/scripts/check-tokens.mjs src
```

It exits non-zero on raw hex, arbitrary Tailwind values (`p-[13px]`), Tier 1
references outside the files allowed to declare them, and direct `--ui-*` use
that bypasses the adapter.

### Contrast policy

`src/contrast-policy.json` ships with the package. It declares every colour
pairing that matters and the ratio required of it — including the deviations,
with reasons. Solid fills in dark mode sit on a declared 3:1 floor so the accent
can stay vivid.

To hold your own app to strict AA, raise those floors in your own copy and run
the same assertions against your brand ramps:

```js
import policy from '@widenode/ui-foundation/contrast-policy.json' with { type: 'json' }
```

---

## 6. The rules that actually bite

Full reasoning in [`RULES.md`](RULES.md). The short version, in the order
people get them wrong:

1. **Components reference Tier 2 semantic tokens only.** Never `--n-7`, never
   `#666`, never `p-[13px]`. Break it once and both the brand swap and the skin
   swap quietly die.
2. **`--border-strong` for anything a user must perceive to operate** — form
   controls, selected state. `--border-subtle` and `--border-default` are
   decorative and sit below 3:1 deliberately.
3. **Spacing is named by relationship, not size.** `--gap-related` is
   label-to-input, `--gap-item` is field-to-field. Never a raw `--space-*` for a
   gap — that is what makes "space inside a group < space around it"
   self-enforcing.
4. **Shadow means "floats above the page."** Popovers and overlays only. There
   is no card shadow, deliberately; grouping is done with borders and space.
5. **Focus is a ring, not a border change.**
6. **Disabled state must never be the only carrier of meaning.**
   `--text-disabled` deliberately fails AA.

### Defaults you can override

Distinct from the above, which are enforced. **Depth:** start with two nested
surfaces and switch to left-rule-and-indent below that — but nothing checks it,
arbitrary nesting is expected, and a view where the structure *is* the content
may reasonably ignore it. See the depth section of `RULES.md`.

---

## 7. Reference rendering

`node_modules/@widenode/ui-foundation/specimen/index.html` renders the whole
system against content that breaks it: overlong names, tabular numbers, mixed
status, empty states. Serve it over HTTP — it loads `tokens.css` as a relative
subresource and will not render from a `data:` URL.

```bash
npx serve node_modules/@widenode/ui-foundation
```

---

## 8. Snippet for your `CLAUDE.md`

Paste this into the consuming repo so every session starts with the constraints
rather than rediscovering them:

```markdown
## Visual system

Styling comes from `@widenode/ui-foundation` (pinned). Before writing any CSS,
read `node_modules/@widenode/ui-foundation/INTEGRATION.md`, and `RULES.md` in
the same directory for the reasoning.

Non-negotiables:
- Components use Tier 2 semantic tokens only — never Tier 1 (`--n-*`, `--a-*`),
  never raw values. This is linted.
- Tier 1 is overridden only in our `brand.css`.
- `--border-strong` for anything a user must perceive to operate.
- Gaps use the `--gap-*` relationship scale, never raw `--space-*`.
- Nuxt UI: adapter imported last and never inside `layer()`; the app must set
  `data-theme` alongside Nuxt UI's `.dark` class.
```
