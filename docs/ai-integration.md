# AI integration

Status: `llms.txt`, `xoong check` (HTML, JavaScript and TypeScript), `xoong doctor` and the MCP server are **implemented**; the
first-attempt-correctness benchmark harness (with a first small measurement) is **implemented**; the `scaffold` tool is **planned**. Packages: `@xoong/cli`, `@xoong/mcp`.

Goal: an AI assistant that has never seen xoong should write correct code on
the first attempt, using only a short spec and fast, precise feedback.

## 1. `llms.txt`

**Implemented** (`/llms.txt`, ~1.8k tokens). A test fails if it exceeds 3k tokens, mentions a CLI command
that does not exist, mentions an `xo-*` attribute `xoong check` does not know, or if `check` knows an
attribute the file does not document. Update it in the same change as any API change. Elements are held to the same rule with
one exception: thirteen of them (`xo-pager` and the controls that came after the first ones) are not named in the file because of the
token budget; they are listed in `test/architecture.test.mjs` (`NOT_IN_LLMS`), all of them are in `docs/`, and the MCP tool
`explain_syntax` describes every element and attribute, so an assistant that has the MCP server is not limited by the file. The test
fails when an element is added to `syntax.js` and neither named in `llms.txt` nor on that list.

A single file at the repo root (and served on the docs site) containing the
entire public API in under ~3,000 tokens: concepts, element attributes, data
rules, three complete examples. It is generated from the source of truth where
possible so it cannot drift.

## 2. `xoong check`

**Implemented** for HTML files and for JavaScript/TypeScript (`xoong check <files|folders> [--format json]`): in `.js`, `.mjs`, `.ts`
and `.mts` files it checks the HTML inside html`...` templates (findings point at the file's own lines) and the operation named in a
string literal passed to `client.load/query/mutate/stream`. Calls that build the name dynamically are not checked, and only calls on something that looks like a xoong client (`client`,
`apiClient`, `getClient()`, `xo`) are examined, so `db.query('SELECT 1')` is left alone. The template scanner is a small scanner, not a
JavaScript parser: it skips comments, strings and regex literals and keeps line and column exact, and skips what it cannot read.

Codes (every one has a message that names the fix, and the MCP tool `explain_error` explains each; a test keeps the lists in step):

| Code | What it finds |
|---|---|
| XO201 | unknown operation (with the closest match), in `xo-click`, `xo-submit`, `get`, `op` and in `client.load/query/mutate/stream` |
| XO202 / XO203 | `xo-click` on a GET operation / `get` on a non-GET operation |
| XO204 | read/write method mismatch in JavaScript (`load` on a write, `mutate` on a GET) |
| XO210 | a path parameter of the view's operation with no `p-<name>` |
| XO220 / XO222 | `xo-submit` not on a `<form>` / a `<form xo-submit>` outside an `<xo-view>` (it never binds) |
| XO221 | an attribute that needs a value is empty (`xo-each`, `xo-if`, `xo-body`, `xo-then`, `xo-confirm`, `xo-with`, `xo-optimistic`, `xo-open`, the array buttons) |
| XO230 | unknown `xo-*` element or attribute (with the closest) |
| XO240 / XO241 | a button or link triggered by `xo-click` without an accessible name / an `xo-click` that keyboards cannot reach |
| XO242 / XO243 | `<xo-image>` without `alt` / `<img src="{path}">` inside a view |
| XO250 / XO251 | `<xo-table>` with `sortable` or `page-size`, or `<xo-pager>`, and the view's operation lacks `sort`, `limit` or `offset` / the table or pager is outside `<xo-view get>` |
| XO252 / XO255 | `<xo-form op>` has no simple request fields / requires nested fields it cannot generate without a request schema |
| XO253 | `<xo-table filters="f">` and the operation has no query parameter `f` |
| XO254 | `xo-selected` without `xo-click`, `xo-select` off a checkbox |
| XO260 / XO261 / XO262 / XO263 | routes and layouts: a bad or repeated route path / an undeclared `layout` / a layout without `xo-outlet` / `p-x=":name"` without such a route parameter |
| XO270 | an attribute that does nothing where it is: `xo-then`, `xo-notice`, `xo-confirm`, `xo-body`, `xo-optimistic`, `xo-with`, `xo-keep` without `xo-click`/`xo-submit`; `xo-confirm-*` without `xo-confirm`; `<xo-dialog size>` without `heading` |
| XO271 | a value outside the fixed set (`xo-confirm-kind`, `<xo-dialog size>`, the sizes and statuses of the controls); the runtime silently uses the default |
| XO272 | a malformed `field=value` list (`xo-with`, `xo-optimistic`), `xo-param`, `xo-move` or `xo-select` |
| XO273 | `xo-open` names something that is not an `<xo-dialog>` (or nothing in the file); `xo-close` outside an `<xo-dialog>` |
| XO274 | `xo-with` (or the field of `xo-selected="ids"`) names a field the request body of the operation does not have |
| XO275 | `xo-param` sets a parameter the view's operation does not take (it will not filter) |
| XO276 | an attribute outside the element that gives it meaning: `xo-route`/`xo-layout` off a router template, `xo-tab`, `xo-menu-trigger`, `xo-guard`, the array buttons |

Locations are line:column. `--format json` prints the findings as a list. The exit code is 1 when there is an error (warnings do not fail
it), 0 otherwise. Options that do not exist are refused for every command (`xoong check --exclud` is an error, not a silent no-op), and
`xoong --help` lists every command with every option; a test keeps the help in step with what the code accepts. `--exclude <glob>` and
`"check": { "exclude": [...] }` in `xoong.config.json` keep files out.

A fast static check that returns errors in a fixed, machine- and human-readable
shape:

```
error XO201 views/users.html:12  xo-click calls "POST /user/{id}/disable"
  unknown operation. Closest: "POST /users/{id}/disable"
  fix: change the path
```

Planned: leaking CSS selectors, deprecated attributes (with the codemod to run), unknown `{path}` fields (against `api.d.ts`).

## 3. `xoong doctor`

Audits the OpenAPI document (and `xoong.hints.json`) and reports what limits xoong: missing `operationId` (XO110, XO111), undocumented
path parameters (XO112), constructs xoong does not apply (XO113: a required header or cookie parameter, HEAD/OPTIONS operations, `servers`, a query `style` or `explode: false`), no response schema (XO120), undocumented errors (XO130), schemas that look like entities but are not treated as
such (XO140), broken or external `$ref`s (XO150, XO151), unions that cannot be told apart (XO160, XO161), a document without paths and a bad `x-xoong-id` (XO100, XO101, XO102)
and mistakes in the hints file: a key that is not a hint (XO171), a `fields` or `idempotencyKeys` entry that names nothing in the document
(XO170, XO172). `xoong sync` prints the same errors, one line per kind of XO113 (what the document asks for that xoong does not do, and what to put in `configure()`), and counts the other warnings. Exit code 1 when there is an error.

## 4. MCP server

**Implemented** as `@xoong/mcp` (`xoong-mcp [--operations .xoong/operations.json] [--llms llms.txt] [--docs docs]`):
JSON-RPC over stdio, no SDK, no dependency beyond `@xoong/cli`. Register it in an assistant, for example
`{ "mcpServers": { "xoong": { "command": "npx", "args": ["xoong-mcp"] } } }`. Tools: `get_spec`, `list_operations`, `check`, `explain_error`,
`explain_syntax`, `search_docs`. `scaffold` is not built yet. It reports the version of the package in `initialize`.

The spec and the documentation **ship inside the package** (`prepack.mjs` copies `llms.txt` and `docs/*.md` into `src/` when the package is
packed, because the tarball may only hold `src/`; the copies are not committed). So `get_spec` and `search_docs` work in a project that
installed `@xoong/mcp` from npm; in this repository the server reads the files at the root. `--llms` replaces the spec, and `--docs` (or a
`docs/` folder in the working directory) adds the project's own docs, which `search_docs` searches first. A test packs a copy of the
package into a `node_modules` layout and asks it for the spec from an empty project.

Tests keep it complete: `explain_error` for every code `check` and `doctor` can print, `explain_syntax` for every element and attribute
of `packages/core/src/syntax.js` (`test/architecture.test.mjs`).

| Tool | Purpose |
|---|---|
| `get_spec` | Returns `llms.txt` |
| `search_docs` | Searches the xoong documentation (the `docs/` folder, shipped with the package; for example the dialogs from JavaScript, `confirm`, `alert`, `prompt`, `ask`) and the project's own docs |
| `list_operations` | Lists operations from the synced OpenAPI document |
| `scaffold` (planned) | Generates a view, form or admin screen for an operation |
| `check` | Runs `xoong check` on HTML source text (or `script` source: `html` templates and `client.*` calls) and returns structured errors |
| `explain_error` | Explains an error code (XO2xx from `check`, XO1xx from `doctor`) with the fix |
| `explain_syntax` | Explains an element or attribute: what it does, its attributes, the values it takes (without a name, the list of all) |

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
