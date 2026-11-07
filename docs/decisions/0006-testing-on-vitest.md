# ADR-0006: Test with Vitest; make the network the only seam

Status: Accepted (design phase)

## Context
UI testing is a recurring pain in mainstream frameworks (hidden Shadow/virtual
DOM, hydration, per-project HTTP mocks, flaky timing). Developers also expect a
Vitest-like experience: fast, watch mode, native TypeScript, simple API.

## Decision
xoong does not ship its own test runner. It supports **Vitest** and adds
`@xoong/test`, a thin helper layer: `mockApi` (built from `operations.json`),
`mount`, interaction helpers, `settle`, and stream-event delivery. Screen tests
run in happy-dom; real-browser tests use Playwright or Vitest browser mode.
Because components render into the Light DOM and the data layer is the only
network seam, tests exercise real code with only `fetch` replaced.

## Consequences
+ Familiar workflow; TypeScript specs work out of the box.
+ Tests mirror production: cache, store, invalidation and streams are real.
- Test tooling has dependencies (Vitest, happy-dom). They are dev-only and never
  reach the browser, consistent with ADR-0004.
- happy-dom does not emulate layout or every native widget; those need
  real-browser tests.
