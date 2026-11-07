# AI integration

Status: `llms.txt`, `xoong check` (HTML) and `xoong doctor` are **implemented**; the MCP server and the
first-attempt-correctness benchmark are **planned**. Packages: `@xoong/cli`, `@xoong/mcp`.

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

**Implemented for HTML** (`xoong check <files|folders> [--format json]`; JS/TS templates are not checked yet).
Codes: XO201 unknown operation (with closest match), XO202 xo-click on a GET, XO203 get on a non-GET,
XO210 missing `p-*`, XO220 xo-submit not on a form, XO221 empty expression, XO230 unknown xo-* attribute or
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

Tools exposed to an AI assistant:

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

Success metric: **first-attempt correctness**. A fixed set of tasks (small
site, CRUD admin, shared-data dashboard, live updates) is given to an assistant
with only `llms.txt` and MCP access; we track the share that pass `check` and
run correctly without human edits. The suite lives in `examples/` and is run
before each release.

## 6. Fine-tuning (later)

A small assistant model is considered only after the CLI and MCP have
collected real (code, error, fix) data. Until then, spec + validator + examples
carry the load. See [roadmap.md](roadmap.md).
