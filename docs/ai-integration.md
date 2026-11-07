# AI integration

Status: `llms.txt`, `xoong check` (HTML), `xoong doctor` and the MCP server (first version) are **implemented**; the
first-attempt-correctness benchmark harness (with a first small measurement) is **implemented**; the `scaffold` tool is **planned**. Packages: `@xoong/cli`, `@xoong/mcp`.

Goal: an AI assistant that has never seen xoong should write correct code on
the first attempt, using only a short spec and fast, precise feedback.

## 1. `llms.txt`

**Implemented** (`/llms.txt`, ~1.8k tokens). A test fails if it exceeds 3k tokens, mentions a CLI command
that does not exist, mentions an `xo-*` attribute `xoong check` does not know, or if `check` knows an
attribute the file does not document. Update it in the same change as any API change.

A single file at the repo root (and served on the docs site) containing the
entire public API in under ~3,000 tokens: concepts, element attributes, data
rules, three complete examples. It is generated from the source of truth where
possible so it cannot drift.

## 2. `xoong check`

**Implemented** for HTML files and for JavaScript/TypeScript (`xoong check <files|folders> [--format json]`): in `.js`, `.mjs`, `.ts`
and `.mts` files it checks the HTML inside html`...` templates (findings point at the file's own lines) and the operation named in a
string literal passed to `client.load/query/mutate/stream`. Calls that build the name dynamically are not checked.
Codes: XO201 unknown operation (with closest match), XO202 xo-click on a GET, XO203 get on a non-GET,
XO204 read/write method mismatch in JS, XO210 missing `p-*`, XO220 xo-submit not on a form, XO221 empty expression, XO230 unknown xo-* attribute or
element, XO240/XO241 accessibility. Locations are line:column.

A fast static check that returns errors in a fixed, machine- and human-readable
shape:

```
error XO201 views/users.html:12  xo-click calls "POST /user/{id}/disable"
  unknown operation. Closest: "POST /users/{id}/disable"
  fix: change the path
```

Checks include: unknown operations or parameters (against `api.d.ts`), leaking
CSS selectors, missing accessible names, deprecated attributes (with the
codemod to run).

## 3. `xoong doctor`

Audits the OpenAPI document and reports what limits xoong: missing
`operationId`, missing entity ids, ambiguous schemas, undocumented errors.

## 4. MCP server

**Implemented** as `@xoong/mcp` (`xoong-mcp [--operations .xoong/operations.json] [--llms llms.txt] [--docs docs]`):
JSON-RPC over stdio, no SDK, no dependency beyond `@xoong/cli`. Register it in an assistant, for example
`{ "mcpServers": { "xoong": { "command": "npx", "args": ["xoong-mcp"] } } }` (the packages are not published yet:
use `node packages/mcp/src/cli.js`). Tools: `get_spec`, `list_operations`, `check`, `explain_error`, `search_docs`.
`scaffold` is not built yet. A test keeps `explain_error` complete for every code `check` can print.

Design (as planned):

| Tool | Purpose |
|---|---|
| `get_spec` | Returns `llms.txt` (or a section of it) |
| `search_docs` | Searches the documentation |
| `list_operations` | Lists operations from the synced OpenAPI document |
| `scaffold` | Generates a view, form or admin screen for an operation |
| `check` | Runs `xoong check` on given files and returns structured errors |
| `explain_error` | Explains an error code with a fix example |

The expected loop: read spec, write code, `check`, fix from the error message.

## 5. Measuring it

Success metric: **first-attempt correctness**: the share of tasks an assistant solves in **one attempt**, with only `llms.txt` and the
list of the API's operations, that pass the scorer without human edits.

The harness is in [`tools/benchmark`](../tools/benchmark): four tasks (small site, CRUD admin, shared-data dashboard, live updates),
each with an OpenAPI file, a task text and a reference solution. `node tools/benchmark/score.mjs <task> <folder>` and
`node tools/benchmark/run.mjs <attempts folder>` score what an assistant wrote. A task passes when all expected files exist,
`xoong check` reports no errors, the required operations and constructs are used, and nothing forbidden appears (hand-written
`fetch`, an HTTP library, `innerHTML`, utility classes, inline handlers). A test keeps the scorer honest: every reference solution must
pass and typical mistakes must fail.

### First measurement (2026-11-08)

One attempt per task, by a small model (Claude Haiku) that could read only `llms.txt` and the operations list and could not run
`xoong check` (so no feedback loop, which is the pessimistic case):

| Task | Result |
|---|---|
| CRUD admin | pass |
| Shared-data dashboard | pass |
| Live updates | pass |
| Small site | scorer first said fail, see below |

What this does and does not show:

* **n = 4, one run each, one model.** It is an existence proof that the spec carries first attempts, not a rate. Do not quote
  "100%".
* The small-site "failure" was a defect in the scorer, not in the attempt: it demanded `p-id` on the view, while the assistant used
  `view.params = { id }` from a script, which `llms.txt` documents. I fixed the scorer to accept either, and re-scored (4/4).
  I changed the scorer after seeing the result; treat the number with that in mind.
* It exposed a real gap: a public page that shows one item selected by `?id=` needed JavaScript. `p-id="?id"` now reads the
  page URL declaratively (also in prerendering with the `url` option), and `llms.txt` says so.
* Not measured yet: the loop with feedback (`check` through MCP), other models, harder tasks, or whether the page *works* in a browser
  (the scorer is static; the reference solutions are what the end-to-end tests cover).

To repeat it: give an assistant `llms.txt`, a task from `tools/benchmark/tasks/*/task.md` and the matching operations list
(`list_operations` of `@xoong/mcp` prints it), collect the files in `<folder>/<task>/`, run `run.mjs`.

## 6. Fine-tuning (later)

A small assistant model is considered only after the CLI and MCP have
collected real (code, error, fix) data. Until then, spec + validator + examples
carry the load. See [roadmap.md](roadmap.md).
