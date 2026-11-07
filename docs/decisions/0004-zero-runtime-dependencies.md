# ADR-0004: Zero runtime dependencies

Status: Accepted (design phase)

## Context
Upgrading Node tends to cascade through bundlers, compilers and plugins, to the
point where some projects are rebuilt rather than upgraded.

## Decision
`@xoong/core`, `@xoong/data` and `@xoong/ui` import nothing outside xoong,
ship as plain ESM, and need no build step. Tooling packages (`cli`, `server`,
`mcp`) may use dependencies but never ship to the browser. CI enforces the
rule. `@xoong/server` relies only on the web-standard `Request`/`Response` API.

## Consequences
+ A Node upgrade cannot break the runtime.
+ Small supply-chain surface.
- Features usually provided by libraries (routing, date handling, etc.) are
  either built in, kept minimal, or left to the platform.
