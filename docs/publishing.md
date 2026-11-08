# Publishing xoong to npm

Nothing is published yet. Publishing is manual and deliberate: the workflow `.github/workflows/publish.yml` never runs by itself.
This page is the runbook; the checks it relies on are in `test/publish.test.mjs`.

## What is ready

* 14 packages, one shared version, each depending on the others by that **exact** version (`node tools/set-version.mjs 0.0.30` sets all of it).
* Every package has a `LICENSE`, a `README.md` (the npm page), `publishConfig: { access: "public" }`, `engines.node >=22.12`, `repository.directory`, and a tarball of `src` only (no tests, no docs).
  `node tools/package-files.mjs` writes the READMEs, licences and descriptions from one place.
* `npm pack --dry-run` of every package is checked by the test suite: only `src/`, `package.json`, `README.md`, `LICENSE`; every export and bin target exists; under 600 KB.
* All 14 names were free on 2026-11-08 (`xoong`, `@xoong/core`, …). A scope needs an owner: see step 1.

## Steps for the first release (by the owner of the npm account)

1. **The scope.** `@xoong/*` packages need the npm organisation `xoong` (free for public packages): npmjs.com → your avatar → *Add Organization* → name `xoong`. If the name is taken, choose another scope and run a rename (`@xoong/` is written in `packages/*/package.json`, the sources and the docs: ask for it before publishing).
2. **Two-factor.** Turn on 2FA for the account (authorisation and writes).
3. **A token for CI.** npmjs.com → *Access Tokens* → *Generate new token* → **Granular**, permission *Read and write* for the packages of the `xoong` scope and the package `xoong`, expiry 90 days. On GitHub: repository → *Settings → Secrets and variables → Actions* → `NPM_TOKEN`.
   (The very first publish of a name creates it, so the token must be allowed to create packages in the scope; after the first release you can narrow it.)
4. **Dry run.** Actions → *publish* → *Run workflow* with `dry_run` on (the default). It runs the lint and the tests, then `npm publish --dry-run` for each package in dependency order.
5. **Publish under `next`.** Run it again with `dry_run` off and the tag `next`. While xoong is 0.0.x the tag `next` means "try it": `npm install xoong@next`.
6. **Check.** In a scratch folder: `npm init -y && npm install xoong@next`, then `npx xoong --help` and `import 'xoong'` in Node; open the package pages on npmjs.com (README, provenance badge).
7. **Promote.** When you are happy: `npm dist-tag add xoong@0.0.N latest` (and the same for each `@xoong/*`), or just publish the next version with the tag `latest`.
8. **Tell the docs.** Switch the Install page and `docs/consuming.md` from release tarballs to `npm install xoong` (the site generator has the text in `tools/site/pages.mjs`), and say so in `CHANGELOG.md`.

## Every later release

```bash
node tools/set-version.mjs 0.0.31      # all packages, ranges, lockfile
# CHANGELOG.md: the entry with its "breaking:" line
npm test                               # includes test/publish.test.mjs
git commit, push, wait for CI, tag v0.0.31
# Actions → publish → dry run, then the real run
```

A published version cannot be changed or reused: fix forward with the next number (`npm deprecate` marks a bad one; unpublishing is only possible within 72 hours and is discouraged).

## Decisions that are yours

* The scope name (`@xoong`) and whether the umbrella package keeps the bare name `xoong`.
* The first version to publish (0.0.29 as it is, or a fresh 0.1.0-alpha).
* `next` first, `latest` later, as above.
* Whether the docs site (GitHub Pages) goes live at the same time.
