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
@import "@widenode/ui-foundation/base.css";   /* optional, recommended */
```

```html
<html data-theme="light">
```

Switch themes by setting `data-theme="dark"` on the root element.

`tokens.css` declares custom properties and nothing else — no reset, no
utilities, no side effects. `base.css` is the opt-in companion that emits the
handful of real rules that cannot be tokens:

| Rule | Why it is not left to you |
|---|---|
| `box-sizing: border-box` | The spacing scale assumes it. Under content-box, padding tokens change an element's width instead of its inset |
| `scrollbar-gutter: stable` | Without it a centred layout shifts sideways when a page grows past one viewport, so navigation twitches |
| `-webkit-text-size-adjust: 100%` | iOS inflates text in landscape, breaking the type scale |
| `body` surface, text and font | Applies the Tier 2 roles to the document |
| `:focus-visible` ring | A component that forgets it fails silently for keyboard users |

Skip it if you already have a reset you trust — but then the scrollbar gutter
and the focus ring become your job, and both are in `RULES.md` for a reason.
**Components are permanently out of scope for `base.css`**; it will never
contain a `.btn`.

---

## 3. Nuxt UI — Nuxt *or* plain Vue + Vite

Nuxt UI runs in both, and this package needs the same two things either way:

1. the stylesheet imports, in order, unlayered
2. `[data-theme]` on `<html>` kept in sync with Nuxt UI's `.dark` class

Only the wiring differs. Verified against Nuxt UI 4.10; if their scaffold has
moved, their docs win — the token names are listed in
`node_modules/@widenode/ui-foundation/src/adapters/nuxt-ui.css`, which also
records what is deliberately not mapped.

### 3.1 Stylesheet — order matters

`app/assets/css/main.css` on Nuxt, `src/assets/css/main.css` on Vite:

```css
@import "tailwindcss";
@import "@nuxt/ui";
@import "@widenode/ui-foundation/tokens.css";
@import "@widenode/ui-foundation/base.css";
@import "@widenode/ui-foundation/adapters/nuxt-ui.css";
@import "./brand.css";
```

`base.css` is optional but recommended — see §2 for what it does. Tailwind's
preflight already handles `box-sizing`, so the overlap there is harmless; the
scrollbar gutter and focus ring are the parts you would otherwise write
yourself.

**Do not wrap these in `layer()`.** Nuxt UI declares its `--ui-*` tokens inside
`@layer theme`; these imports are unlayered, and unlayered styles beat layered
ones regardless of source order. Writing `@import "..." layer(theme)` puts them
in the same layer and hands the decision back to source order.

### 3.2 Theme attribute — the thing that will bite you

Nuxt UI toggles a `.dark` **class**. This package keys on a `[data-theme]`
**attribute**. CSS cannot set an attribute, so the app has to keep them in
sync. Skip it and `.dark` flips while the ramps stay light — the whole system
silently renders in light mode. **It is the first thing to check** when dark
mode "doesn't work".

**The portable way**, independent of which colour-mode library is in play —
`src/theme-sync.ts`:

```ts
/**
 * Mirrors Nuxt UI's `.dark` class onto [data-theme], which is what
 * @widenode/ui-foundation keys on. Observes the class rather than assuming a
 * particular composable, so it survives Nuxt UI or VueUse changing how they
 * store the mode. Client-side only.
 */
export function syncTheme() {
  const el = document.documentElement
  const apply = () => {
    el.dataset.theme = el.classList.contains('dark') ? 'dark' : 'light'
  }
  apply()
  new MutationObserver(apply).observe(el, {
    attributes: true,
    attributeFilter: ['class'],
  })
}
```

Call it once before mount, in `src/main.ts`:

```ts
import { syncTheme } from './theme-sync'
syncTheme()
```

**On Nuxt**, prefer driving the attribute from the mode directly — it renders
server-side, so there is no flash of the wrong theme on first paint. In
`app.vue`:

```vue
<script setup lang="ts">
const mode = useColorMode()
useHead({ htmlAttrs: { 'data-theme': () => mode.value } })
</script>
```

The MutationObserver version works on Nuxt too, but only after hydration.

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

### 3.4 Vue + Vite specifics

Nuxt UI's own setup, for reference — none of it is this package's concern
beyond where the stylesheet goes:

```bash
npm install @nuxt/ui tailwindcss
```

```ts
// vite.config.ts
import ui from '@nuxt/ui/vite'
export default defineConfig({ plugins: [vue(), ui()] })
```

```ts
// src/main.ts — import the stylesheet before anything else
import './assets/css/main.css'
import ui from '@nuxt/ui/vue-plugin'
import { syncTheme } from './theme-sync'

syncTheme()
createApp(App).use(router).use(ui).mount('#app')
```

`App.vue` must wrap the tree in `<UApp>` for toasts and tooltips to work. The
stylesheet in 3.1 is the same file, at `src/assets/css/main.css`.

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

### Run the layout gates against your own app

The rules RULES.md marks `[enforced]` are mostly things no linter can see —
whether a header matches its column, whether an icon centres on its label,
whether a hint sits closer to its control than the next field does. This package
ships those assertions so they run against **your** routes, not just its
specimen:

```ts
// tests/layout.spec.ts
import { test, expect } from '@playwright/test'
import { layoutChecks } from '@widenode/ui-foundation/layout-checks'

const ROUTES = ['/', '/settings', '/orders/new']

for (const check of layoutChecks) {
  for (const route of ROUTES) {
    test(`${check.name} — ${route}`, async ({ page }) => {
      await page.goto(route)
      expect(await check.run(page), check.name).toEqual([])
    })
  }
}
```

Nine checks, each returning a list of human-readable offenders. They need
nothing but a `page` with an `evaluate` method, so this adds no dependency —
and the specimen runs the same module, so what you get is what CI here proves.

**Add every route.** A check can only see what is rendered; an unlisted route is
unchecked. This is the same trap as the specimen's — the gates were green for
months against pages that did not exist yet.

Icon detection is structural rather than `svg`-only, so it works with an icon
font (Font Awesome, Material Symbols) as well as inline SVG.

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
