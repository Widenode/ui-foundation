# @widenode/ui-foundation

Distributable design-token package. Vanilla CSS, no framework, no build step.
Public repo, maintainer-approved merges. Published to npm as
`@widenode/ui-foundation`.

## What this repo is

`RULES.md` is the spec and the durable asset. Everything else serves it.

| Path | Role |
|---|---|
| `RULES.md` | The visual spec. Read before touching anything. |
| `src/tokens.css` | Tier 1 primitives + Tier 2 semantic mapping |
| `src/adapters/nuxt-ui.css` | Maps Nuxt UI `--ui-*` onto our Tier 2 |
| `specimen/index.html` | Reference rendering + the test target |
| `stylelint/index.json` | Shared config consumers extend |
| `scripts/check-tokens.mjs` | Text-level backstop for the Tier 2 rule |
| `src/layout-checks.mjs` | The `[enforced]` rules as assertions, shipped so consuming apps run them too |
| `RELEASING.md` | Release, tag and CI plumbing. Maintainer runbook, not shipped |

**This is the only repo where Tier 1 primitives (`--n-*`, `--a-*`) live.**
Consuming apps override them in their own `brand.css` and nowhere else.

## Rules for changes here

- A token change requires a rationale in `RULES.md`. No silent additions.
- **Removing or renaming a Tier 2 token is BREAKING** for every consumer,
  and CSS variables fail silently to `unset` — nothing type-checks this.
  Treat removals and renames as major, even on 0.x. The visual regression
  suite is the only compiler we have for this class of change.
- Adding a token is a minor. Changing a ramp value is a minor on 0.x.
- Never add a runtime dependency. The shared stylelint config's deps are
  the sole exception (see below).
- Foundation must NOT depend on Nuxt UI, Vue, or Tailwind. The adapter is a
  stylesheet, not an integration.

## Publishing

**`RELEASING.md` is the runbook — read it before touching a tag, a workflow or
the branch ruleset.** It carries the procedure and the failure modes; these are
the invariants worth knowing without opening it:

- **Merging never publishes. Pushing a `v*` tag does.** Tag creation is
  restricted to `@Widenode/developers`, so it *is* the publish authorisation.
- Trusted publishing (OIDC). There is no `NPM_TOKEN` and there must never be one.
- The tag must match `package.json`, and you must `git pull` before tagging.
- **Deleting a failed tag is two-sided** — remote *and* local. Skipping the
  local half fails silently and looks like the remote delete did not work.
- **CI runs `npm run verify` in the same container `prepack` uses.** Do not let
  those diverge: it is what makes a green PR mean a publishable commit, and
  three releases failed before it did.
- The branch ruleset requires a check named exactly `verify`. Renaming the CI
  job without repointing the ruleset blocks every PR forever.
- **Never gate anything font-dependent here.** `--font-sans` is a brand slot and
  CI's fonts are not yours; that mistake failed two releases.

## Gates

`npm run verify` — lint, a11y, contrast, layout, visual. That exact command is
what CI and `prepack` both run, in the pinned Playwright container.

Visual baselines under `tests/__screenshots__` are **committed artifacts**, and
only the **Linux** set is committed; `-win32` and `-darwin` are gitignored, so
running `test:visual` locally writes your own platform's copies harmlessly.
Regenerate the committed ones with the **Visual baselines** workflow, never with
a local `--update-snapshots` — see `RELEASING.md`.

## Workflow

Screenshot the specimen at 390px and 1280px, both themes, and critique
against `RULES.md` before showing me anything. Gate failures are not
advisory — fix them or argue the rule is wrong.

## Ask, don't guess

- Nuxt UI token names — read their docs. Never recall from memory.
- Anything that changes `RULES.md` or removes a token.
- npm publishing setup — verify against current npm docs; this area is
  actively changing.
- If stylelint can't resolve "@widenode/ui-foundation/stylelint", try the
  literal path .../stylelint/index.json before changing anything else.
- Visual baselines are OS-specific. Baselines generated on Windows will fail
  on Linux CI — run visual tests in Playwright's Docker image if CI is added.
