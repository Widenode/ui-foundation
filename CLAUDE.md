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

- Trusted publishing (OIDC) from Actions on `v*` tags. There is no
  `NPM_TOKEN` secret and there must never be one.
- `publishConfig.access` is `public` — scoped packages default to private.
- Before any release: `npm pack --dry-run` and check the file list.
- Never publish from a local machine except the very first publish.

## Gates

`npm run lint && npm run test:a11y && npm run test:visual`

Visual baselines under `tests/**/__screenshots__` are **committed artifacts**.
Regenerate deliberately with `test:visual:update`, never to make a test pass.

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
