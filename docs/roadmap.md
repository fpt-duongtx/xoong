# Roadmap

The version stays `0.x` until at least three real projects run xoong in
production. Dates are intentionally absent; milestones are done when their exit
criteria pass.

| Milestone | Scope | Exit criteria |
|---|---|---|
| **0.1 Core** | Signals, base element, declarative attributes, template, `xoong.css` tokens | A small site runs with no build step; bundle of `core` stays within the size budget |
| **0.2 Data basics** (+ multipart uploads, `unwrap` hint) | `xoong sync`, typed client, auto cache, mutations, error normalization, `xoong dev` with proxy and `.ts` type stripping, `@xoong/test` + Vitest | A full CRUD screen exists with zero hand-written HTTP code, and has a passing screen test |
| **0.3 Shared data** | Entity store, `derived`, router, union/expandable entities (**done** for tagged and `X | deleted_X` unions; untagged unions need hints), composite ids | Two screens share data with one request, verified by test; `XO160` findings on the real corpus drop to zero for supported shapes |
| **0.4 Live** | Streaming (SSE), stream gateway | Two browser tabs update each other in real time |
| **0.5 Admin** | `xo-table`, schema-driven `xo-form`, `xo-dialog`, admin layout | A complete admin area built from declarations only |
| **0.6 AI & types** | `llms.txt`, `xoong check` (operations, params, interpolation checked against `api.d.ts`), `createClient<Operations>()`, MCP server | First-attempt correctness measured and published |
| **0.6.x Editor & lint** | HTML custom data for `xo-*`, language server, VS Code extension, ESLint and Stylelint presets (see [editor-integration.md](editor-integration.md)) | Typos in operations and params are underlined in the editor with the same message `xoong check` prints |
| **0.7 SSR & perf** | SSR for public pages, per-tag lazy loading, benchmarks | Published benchmark on a large example site |
| **0.8 Upgrades** | Codemod framework, deprecation policy in tooling | A breaking change ships with an automated migration |
| **1.0** | Three production projects, API frozen | Stability promise published |

## Backlog (no milestone yet)

* Swagger 2.0 input (built-in conversion). Low priority: `swagger2openapi` already works as a
  pre-step and the error message names it.
* WebSocket transport, optimistic updates.

## Where we are

| Milestone | State |
|---|---|
| 0.1 Core | Done (`xoong.css` tokens ship in `@xoong/ui`) |
| 0.2 Data basics | Done (sync, cache, mutations, errors, `xoong dev` with proxy and `.ts`, `@xoong/test`); `unwrap` hint, idempotency keys, multipart and declarative POST streaming done (data-layer.md section 12) |
| 0.3 Shared data | Entity store, `derived`, unions done; router and composite ids open |
| 0.4 Live | SSE client done and tested end to end; stream gateway open |
| 0.5 Admin | First version done in `@xoong/ui` and `examples/admin` ([admin.md](admin.md)): `xoong.css`, `xo-table` (sort, paging), `xo-form`, `xo-dialog`, layout. Custom cells, filters, selection open |
| 0.6 AI & types | `llms.txt`, `xoong check` (HTML), `xoong doctor` done; typed client, MCP, JS/TS template checks open |
| 0.6.x Editor & lint | Designed only |
| 0.7+ | Not started |

## Dogfooding

Each milestone is exercised first on the author's own projects. Public
announcement happens only after 0.5 so that feedback is about a usable product.

## Size and quality budgets (to be set in 0.1)

* `core` + `data` gzip budget (target: single-digit KB).
* Zero runtime dependencies (enforced in CI).
* No unexplained public API additions: every addition updates `llms.txt` and
  needs a justification against the design principles.
