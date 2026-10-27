# Releasing

Releases are published to npm from CI with
[provenance](https://docs.npmjs.com/generating-provenance-statements) by the
[Release workflow](.github/workflows/release.yml). Nothing is published from a
developer machine, and no long-lived npm token exists anywhere.

Publishing is triggered by pushing a version tag. CI never writes to git: the
version bump and the changelog go through a normal pull request instead.

## Cutting a release

**1. Open a release pull request.** Bump the version:

```bash
cd package
npm version 0.1.0 --no-git-tag-version --no-workspaces-update
cd .. && bun install
```

`--no-workspaces-update` stops npm from reifying the workspace, which this
Bun-managed repository does not support; `bun install` then records the new
version in `bun.lock`.

In [CHANGELOG.md](CHANGELOG.md), rename `## Unreleased` to the version and the
date, for example `## 0.1.0 — 2026-10-27`. That section becomes the GitHub
Release body, and the workflow refuses to publish a version without one.

Open a pull request titled `chore(release): prepare 0.1.0` with these changes,
then review and merge it as usual.

**2. Rehearse (optional).** Run the **Release** workflow manually from the
Actions tab. A manual run is always a dry run: it runs the full gate, prints the
release notes in the changelog step, and runs `npm publish --dry-run`.

**3. Push the tag.**

```bash
git checkout main && git pull
git tag -a v0.1.0 -m 'v0.1.0'
git push origin v0.1.0
```

The workflow then runs every [CI](.github/workflows/ci.yml) job on the tagged
commit (lint, typecheck, tests, the Nitro codegen check, the package contents
check, and the iOS and Android builds with their unit tests); verifies the tag
matches `package/package.json`, that the version is not already on npm and that
`CHANGELOG.md` has a section for it; publishes to npm with provenance; and
creates the GitHub Release with that section as its body.

The iOS podspec reads its version from `package.json`, so there is no second
version to keep in sync.

## Versioning

The package is below 1.0.0, so a caret range such as `^0.1.0` accepts patch
releases only. Bump the minor version (`0.1.0` → `0.2.0`) for a release that
breaks the public API or changes runtime behavior apps rely on, and the patch
version for anything else. List breaking changes under **Changed** or
**Removed** in the changelog with what apps need to do.

Tags are `v`-prefixed from `v0.1.0`. Versions up to 0.0.17 were published by
hand from `package/`, carry no provenance, and are tagged without the prefix.

## Pre-releases

A version with a prerelease identifier works without extra configuration.
Tagging `v0.2.0-rc.1` publishes under the `rc` dist-tag rather than `latest`, so
`npm install @gmisoftware/react-native-pay` is unaffected, and the GitHub
Release is marked as a pre-release. release-it derives both from the version
itself. The changelog section is `## 0.2.0-rc.1 — <date>`.

Consumers opt in explicitly:

```bash
npm install @gmisoftware/react-native-pay@rc
```

## One-time setup: npm trusted publishing

Publishing uses OIDC, so it only works once npm knows which workflow may publish
this package. On npmjs.com, open the `@gmisoftware/react-native-pay` package
settings → **Trusted publishing** and add a **GitHub Actions** trusted publisher
pointing at:

- repository: `gmi-software/react-native-pay`
- workflow: `release.yml`

A new trusted publisher configuration expires unless a real (not dry-run)
publish uses it within 2 days, so add it when the next release is about to be
tagged, not earlier. Until it is configured the publish step fails with an
authentication error.

Provenance also requires the repository to be public.

## Notes on the configuration

A few settings exist for non-obvious reasons:

- `npm.skipChecks: true` in `package/.release-it.json`: release-it otherwise
  runs `npm whoami` at startup, which fails under trusted publishing because the
  token is only minted at publish time.
- The workflow does **not** set `registry-url` on `actions/setup-node`: doing so
  writes an `_authToken` entry into `.npmrc`, which makes npm assume classic
  token auth and skip the OIDC flow. The registry is pinned by `publishConfig`.
- `release-it` runs with `--no-increment --no-git`: the version is already
  committed and the tag already pushed, so CI only publishes and creates the
  release.
- The workflow copies `README.md` into `package/` before publishing. npm reads
  the README shown on the registry page before any pack script runs, so the
  `prepack` copy alone never reaches npmjs.com.

## Inspecting a release locally

A local publish would produce a package without provenance, so it is not
supported. To see what a release would do:

```bash
cd package
GITHUB_TOKEN="$(gh auth token)" bunx release-it --no-increment --no-git --dry-run
```
