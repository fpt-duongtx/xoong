# Security policy

xoong is a prototype (0.0.x), published to npm with provenance. Its dev server, proxy, HTML interpolation and HTML sanitiser are
security-sensitive, so please report problems privately.

## Reporting

Use GitHub's **private vulnerability reporting** for this repository (Security tab, "Report a vulnerability").
Do not open a public issue for a vulnerability. Include the version or commit, a minimal reproduction and the impact you expect.

## What is in scope

* Markup interpolation: script injection through `{path}` in text or attributes, URL scheme filtering.
* `xoong dev` and `@xoong/server`: path traversal out of the served folder, open proxying to unintended hosts,
  header handling.
* The generated code and files (`operations.json`, `api.d.ts`) when built from an untrusted OpenAPI document.
* `@xoong/mcp`: anything that lets a tool call read or write outside the intended files.

## Not in scope

Vulnerabilities in your own backend, or in dependencies of the tooling that are not reachable through xoong.

Known and accepted: `npm audit` reports a ReDoS in `picomatch` (reached through `vitest`/`vite`, which only run our tests). It is not in any published
package, and the fix on offer is a downgrade of `@vitest/coverage-v8`. It is revisited when `picomatch` or `vitest` ships a fix.

## Supported versions

The latest published 0.0.x version (the npm tags `latest` and `next`) and the latest commit on `main`. While xoong is 0.0.x a fix ships as the next version, not as a patch to an older one.
