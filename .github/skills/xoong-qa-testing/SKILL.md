---
name: xoong-qa-testing
description: Testing in xoong with Vitest, happy-dom, Playwright and axe. Use when writing or running tests, debugging CI failures, or checking coverage and accessibility gates.
---

# xoong QA and testing

Read `docs/testing.md` and ADR-0006 first.

## Commands
```bash
npm ci
npx playwright install chromium    # or set XOONG_CHROMIUM=/path/to/chromium
npm test                           # vitest run: unit, screen, end-to-end
npm run test:logic                 # logic project only
npm run test:screens               # screens project only
npm run test:browsers              # real-browser subset
npm run test:coverage              # enforces thresholds CI uses
npm run lint                       # oxlint on packages/*/src
node tools/site.mjs --check        # generated site is up to date
```

## Rules
- Tests live next to each package (`packages/<name>/test`) plus root `test/` for architecture, pack, publish and site checks.
- A bug fix needs a regression test that fails without the fix.
- Never lower thresholds in `vitest.config.mjs`.
- Site gates: axe in 4 palette/scheme combinations and at 390px, focus indicator 3:1, strict CSP, no sideways scroll.
- Local site tests can be flaky when the machine sleeps or is loaded; timeouts of hours are not real failures. CI is the judge.
- Run the smallest targeted test first (`npx vitest run path/to/file.test.mjs`), then widen.
