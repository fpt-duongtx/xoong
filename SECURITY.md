# Security policy

xoong is a prototype (0.0.x) and is not published yet. Its dev server, proxy and HTML interpolation are
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

## Supported versions

Only the latest commit on `main` until a first release exists.
