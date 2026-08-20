# Releasing

Maintainer runbook. Not shipped in the package — this is plumbing, not API.

## The model, in one line

**Merging never publishes. Pushing a `v*` tag does.**

`ci.yml` runs on PRs and on pushes to `main`; it publishes nothing.
`release.yml` triggers on `refs/tags/v*` and is the only thing that reaches npm.

That separation is deliberate: merge rights and publish rights are different
permissions. The `v*` tag ruleset restricts tag creation to
`@Widenode/developers`, so **creating a tag is the publish authorisation**.

---

## Cutting a release

1. **Bump `version` in `package.json`**, open a PR, let `verify` pass, merge it.
2. Sync and tag the merged commit:

```bash
git checkout main && git pull
```

```bash
git tag -a v0.4.1 -m "0.4.1" && git push origin v0.4.1
```

`git pull` is not optional. Tagging a stale local `main` tags the wrong commit,
and the version guard will either fail or publish something you did not review.

Annotated (`-a`) rather than lightweight: it carries author, date and message.
The workflow reads `GITHUB_REF_NAME` and works with either.

### What the tag triggers

`release.yml`, in the pinned Playwright container:

1. **Version guard** — `v0.4.1` must match `package.json` 0.4.1, or it stops.
2. `npm pack --dry-run --ignore-scripts` — the file list, in the log.
3. `npm publish` → runs `prepack` → runs `npm run verify` (all five gates).
4. Publishes over OIDC, with a SLSA provenance attestation, automatically.

No `NPM_TOKEN` exists and none may be added. `publishConfig.access` is `public`
because scoped packages default to private.

---

## When a release fails

It has, three times. Look at the run, not the tag:

```bash
gh run list --workflow=release.yml --limit 3
gh run view <id> --log-failed | grep -iE "error|failed|not match"
```

Then **delete the tag from both sides** and re-tag after fixing. This is the
step that catches people:

```bash
git push origin :refs/tags/v0.4.1   # remote
git tag -d v0.4.1                   # local — fails silently if you skip it
```

Skipping the local half makes the next `git tag -a` fail with
`tag 'v0.4.1' already exists`, which looks like the remote delete did not work.
It did. `git fetch --prune-tags` also removes local tags the remote no longer
has, which is a fast way to resync — and a fast way to lose a local-only tag,
so know which you are doing.

Deleting a `v*` tag prints `Bypassed rule violations … Cannot delete this tag`.
**That is not an error.** It is the tag ruleset logging that you are in
`@Widenode/developers` and were allowed through. Someone outside the team gets
a rejection instead.

### The three real failures, for pattern-matching

All three passed on the PR and failed at tag time, because the branch used to
run a different suite on a different runner. That is fixed — see the invariant
below — but the underlying lesson stands: **anything font-dependent behaves
differently in the container than on your machine.**

| Symptom | Cause |
|---|---|
| Tag/version mismatch | Tagged before the version bump merged |
| Optical asymmetry check failed | A font-tuned correction whose *sign* flips between faces |
| Pixel-grid check failed | A rendered-position assertion that depends on font metrics |

---

## Invariants — breaking these is how releases start failing again

**CI must run exactly what `prepack` runs, in the image it runs in.**
`ci.yml` runs `npm run verify` inside
`mcr.microsoft.com/playwright:v1.62.1-noble`; so does `release.yml` via
`prepack`. If those diverge, a green PR stops meaning a publishable commit —
which is precisely what produced the three failures above.

**The branch ruleset requires a status check literally named `verify`.**
Renaming the CI job orphans it, and every PR then blocks forever on a check
that can never report. Repoint the ruleset *before* pushing the rename:

```bash
gh api repos/Widenode/ui-foundation/rulesets/20954125 --jq '.rules[] |
  select(.type=="required_status_checks") | .parameters.required_status_checks[].context'
```

**The container tag appears in four places** and must move together:
`package.json` (`@playwright/test`), `ci.yml`, `release.yml`,
`visual-baselines.yml`.

**Never assert something font-dependent as a gate in this package.**
`--font-sans` is a brand slot; CI's fonts are not yours. Gate the declaration,
or move the check into `pixelGridChecks` for apps that pin their font.

---

## Visual baselines

Committed artifacts under `tests/__screenshots__`, and **Linux-only** — the
`-win32` and `-darwin` sets are gitignored, because only Linux is what CI
compares against. Running `test:visual` locally writes your own platform's set;
that is expected and cannot pollute the repo.

Regenerate in the same image CI renders in, via the **Visual baselines**
workflow (`workflow_dispatch`, and it accepts a branch):

```bash
gh workflow run visual-baselines.yml --ref my-branch
gh run download <id> -n visual-baselines -D /tmp/bl
cp /tmp/bl/__screenshots__/*.png tests/__screenshots__/
```

It uploads an artifact rather than committing: no workflow in this repo holds a
write token, and a human looking at the images before they become the reference
is the only thing between a token regression and a green suite.

`--update-snapshots` only rewrites when a diff exceeds the threshold, so an
"unchanged" result after a small visual edit is normal, not a failed run.

---

## Verifying a publish

**The registry, not the website.** npmjs.com is a separate cached front end and
lags by minutes; it has shown a stale version while the package was live.

```bash
curl -s https://registry.npmjs.org/@widenode/ui-foundation | \
  node -p "JSON.parse(require('fs').readFileSync(0,'utf8'))['dist-tags'].latest"
```

`npm view` reads a local cache — add `--prefer-online`. Best proof is a real
install in a scratch directory.

Provenance should show `attestations: present` on the version document, and the
run log prints a `search.sigstore.dev` transparency-log URL.

---

## Trusted publisher configuration

Already set up; recorded in case it needs rebuilding. npmjs.com → the package →
**Settings** → **Trusted Publisher** → GitHub Actions:

| Field | Value |
|---|---|
| Organization or user | `Widenode` |
| Repository | `ui-foundation` |
| Workflow filename | `release.yml` |
| Environment name | *blank* |
| Allowed actions | `npm publish` (`npm stage publish` also enabled; harmless) |

Case-sensitive. Since May 2026 at least one allowed action must be selected
explicitly.

The page lives on the package, so the package must exist first — which is why
`0.1.0` was published by hand. That is the one sanctioned local publish and it
is spent.

---

## Repository settings, for reference

- **`main` ruleset**: PR required, `verify` required and strict, conversations
  resolved, no force-push, no deletion, **zero bypass actors** (applies to org
  admins too). **No required approval count and no CODEOWNERS** — GitHub does
  not let anyone approve their own PR, so a required approval made a
  solo-maintained package unmergeable rather than better reviewed.
- **`v*` tag ruleset**: creation, update and deletion restricted;
  `@Widenode/developers` bypasses.
- **Actions**: `default_workflow_permissions: read`, Actions cannot approve PRs,
  fork PRs require approval from all external contributors.
