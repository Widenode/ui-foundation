# Contributing to @widenode/ui-foundation

This package is public to read and maintainer-approved to merge. Everything
here is downstream of one document: [`RULES.md`](RULES.md). Read it first.

CSS custom properties fail silently to `unset`. Nothing type-checks a token
rename, and no consumer finds out at build time — they find out in production,
in the dark theme, on one screen. That is why the process below is stricter
than the size of this codebase suggests.

## How to propose a change

1. **Fork the repository.** Direct pushes to `main` are blocked; branches in
   this repo are for maintainers only. External contributions arrive as pull
   requests from forks.
2. **Open an issue first** for anything that adds, renames or removes a token,
   or changes a ramp value. Implementation is the cheap part; agreeing the
   rationale is the expensive part.
3. **One concern per pull request.** A token change and a specimen change are
   two pull requests unless the specimen change *is* the proof of the token
   change.
4. **All gates pass.** See below. A red gate is not advisory — fix it, or make
   the argument that the rule is wrong and change the rule in the same PR.
5. A maintainer from `@Widenode/developers` reviews and merges. CI on fork PRs
   runs with a read-only token and no secrets, by design.

## Gates

```bash
npm run verify
```

| Gate | What it catches |
|---|---|
| `lint:css` | stylelint: raw hex, non-token colour values, Tier 1 primitives outside the files allowed to define them |
| `lint:tokens` | `scripts/check-tokens.mjs` — the text-level backstop. Catches arbitrary Tailwind values and Tier 1 references inside template strings, which an AST linter cannot see |
| `test:a11y` | axe-core over the specimen in both themes: contrast, target size, ARIA, focus order |
| `test:contrast` | `src/contrast-policy.json` asserted pair by pair, in both themes |
| `test:visual` | Screenshot diff of the specimen at 390px and 1280px, both themes |

CI runs all four on every pull request. `test:visual` runs as its own job,
pinned to the Playwright image the baselines were generated in — same OS is not
the same environment, and screenshot comparison is the one gate sensitive to
font rendering.

### The contrast policy

`test:contrast` exists because axe cannot do this job. axe only sees pairs the
specimen happens to render — it misses hover states entirely, and misses any
token no component uses yet. It is also text-only, so it never verifies
`--border-strong` or `--focus-ring`, the two tokens RULES.md leans on hardest.

The policy is deliberately **not** blanket AA. Deviations are recorded with a
reason in `src/contrast-policy.json`; what the policy forbids is a pair being
absent. If you add a token pairing, add it there — including one you expect to
pass.

#### Opting into strict AA

Solid fills in dark mode are declared at a 3:1 floor so the accent can stay
vivid. Consumers who need full AA override four tokens in their own
`brand.css` — no fork, no patch:

```css
[data-theme="dark"] {
  --text-on-interactive: var(--n-1);
  --text-on-ok: var(--n-1);
  --text-on-bad: var(--n-1);
}
```

`--text-on-warn` already clears AA in both themes and needs no override. The
policy file ships as `@widenode/ui-foundation/contrast-policy.json`, so a
consuming app can raise the floors and run the same assertions against its own
brand ramps.

### Visual baselines

Baselines under `tests/**/__screenshots__` are **committed artifacts**, and
they are environment-specific — a baseline generated on Windows or macOS will
not match Linux CI. Generate them in the same image the release job uses:

```bash
docker run --rm -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.62.1-noble npm ci
```

```bash
docker run --rm -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.62.1-noble npm run test:visual:update
```

Keep that image tag in lockstep with the `@playwright/test` version in
`package.json`, `.github/workflows/release.yml` and
`.github/workflows/visual-baselines.yml`.

**No Docker?** Run the **Visual baselines** workflow from the Actions tab
(`workflow_dispatch`). It regenerates them in that same image and uploads them
as an artifact for you to download, inspect and commit. It does not commit them
itself — that would require a write token, and no workflow in this repo holds
one. Reviewing the images before they become the reference is also the only
thing separating a token regression from a green suite.

Regenerate baselines **deliberately**, as their own commit, with an explanation
of what changed visually and why. Never regenerate them to make a test pass —
the visual suite is the only compiler this project has for token renames, and
a blanket `--update-snapshots` disables it.

## Token changes

**A token change requires a rationale in `RULES.md`.** No silent additions.
The rationale explains what decision the token removes from component authors,
not what colour it is.

The one rule, restated: **components reference Tier 2 semantic tokens only.**
Never a Tier 1 primitive (`--n-7`, `--a-9`), never a raw value (`#666`, `12px`,
`p-[13px]`). Tier 1 lives in this repo and is overridden by consuming apps in
their own `brand.css`, nowhere else.

### Semver

| Change | Release |
|---|---|
| Removing or renaming a Tier 2 token | **Major** — even on 0.x |
| Adding a token | Minor |
| Changing a ramp value | Minor on 0.x |
| Specimen, docs, tests | Patch |

Removals and renames are breaking for every consumer, silently. Treat them
that way regardless of the leading zero.

### Adding a token — checklist

- [ ] Rationale added to `RULES.md`
- [ ] Tier 1 primitive added, if a new ramp position is genuinely needed
- [ ] Tier 2 mapping added for **both** light and dark
- [ ] Exposed in the `@theme inline` block if components should reach it
      through Tailwind
- [ ] Demonstrated in `specimen/index.html` — if it has no specimen usage, it
      has no visual proof and no regression coverage
- [ ] Adapter reviewed: does `src/adapters/nuxt-ui.css` now have something to
      map that it previously listed as unmappable?

## Dependencies

**Never add a runtime dependency.** The two in `dependencies` —
`stylelint-config-standard` and `stylelint-declaration-strict-value` — are the
sole exception, and they are not really runtime deps: a shared stylelint config
must ship its plugins as real dependencies or consumers cannot resolve them
when extending `@widenode/ui-foundation/stylelint`.

The foundation must **not** depend on Nuxt UI, Vue or Tailwind. The Nuxt UI
adapter is a stylesheet that assigns custom-property names, not an integration.

## Local setup

```bash
npm ci
```

```bash
npx playwright install chromium
```

`--with-deps` is Linux-only; on Windows or macOS it will fail. Every gate runs
on all three platforms — `lint:tokens` is Node rather than a shell script
precisely so a plain Windows console can run it.

There is no build step, and this package must never acquire one. To view the
specimen, open `specimen/index.html` from a static server (the Playwright
config starts one on port 4173).

The first `npm run test:visual` on Windows or macOS will fail: only Linux
baselines are committed. Generate your own platform's set once — they are
gitignored and cannot pollute the repo:

```bash
npm run test:visual:update
```

## Troubleshooting

- **stylelint cannot resolve `@widenode/ui-foundation/stylelint`** — try the
  literal path `.../stylelint/index.json` before changing anything else.
- **Adapter changes have no effect in a consuming app** — check import order.
  `adapters/nuxt-ui.css` must be imported after `@nuxt/ui`, and the app must
  set `data-theme` alongside Nuxt UI's `.dark` class. Both are documented at
  the top of the adapter.

## Publishing

Maintainers only. Publishing happens from GitHub Actions on a `v*` tag via npm
trusted publishing (OIDC). There is no `NPM_TOKEN` secret and there must never
be one.

Never publish from a local machine — with exactly one exception, already spent:
npm's trusted-publisher configuration lives on the package's settings page, so
the package has to exist before OIDC can be set up. Every release after the
first goes through a tag.
