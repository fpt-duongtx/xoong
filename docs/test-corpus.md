# Real-world OpenAPI corpus

Status: **Draft**. Purpose: make sure xoong's `sync` and `doctor` survive real APIs, not only
hand-written fixtures. The specs are public vendor documents kept **outside** this repository
(each has its own license). Anonymise any private spec before putting it in a corpus
(project name, tags, hosts, default locales, example data).

## Running it

```bash
node tools/corpus.mjs <folder-of-specs> --tsc [--hints <folder-of-hints>]
```

For each `*.openapi.json|yaml` it analyses the document, generates `api.d.ts`, type-checks it with
`tsc --strict` (`--tsc`) and compares each YAML file with its JSON twin. Per-spec hints live in
`<name>.hints.json` (see below). `tools/corpus.mjs` exits non-zero on any type error or YAML/JSON
mismatch.

## Result (19 logical documents, 33 files)

| Check | Result |
|---|---|
| OpenAPI 3.0 / 3.1 documents analysed | all, none crashed |
| Largest spec (GitHub REST, 14 MB, 1,272 operations) | 190 ms from JSON, 3.9 s from YAML |
| Generated `api.d.ts` compiles under `tsc --strict` | 100% (incl. 1.5 MB GitHub types) |
| YAML twin gives the same result as JSON twin | all 8 pairs |
| Deliberately broken specs (missing `paths`, dangling `$ref`) | reported as errors `XO100`, `XO150` |
| Swagger 2.0 (Kubernetes, Mall admin/portal, Apache Answer) | **not supported yet** (4 of 19); the error names the converter |

Operations / entities with one-line hints (`idNames`):
Asana 271 / 210 (`gid`), Authentik 1,196 / 181 (`pk`), Box 295 / 109, GitHub 1,272 / 238,
Stripe 612 / 170, OpenAI 388 / 388, Prefect 442 / 116, Invoice Ninja 365 / 42.

## What the corpus taught us (all fixed unless marked)

* Duplicate parameters declared at path and operation level produced invalid types. Fixed.
* Schemas named like TypeScript keywords or built-ins (`import`, `Record`, `Array`) and name
  collisions after sanitising (`Dto.User` vs `Dto_User`) produced invalid types. Fixed.
* `$ref` to a missing target and a missing `paths` were silently accepted. Now errors.
* `anyOf: [X, null]` (Pydantic / OpenAPI 3.1 nullable) hid entities inside. Fixed.
* Identity is not always `id`: Asana uses `gid`, Authentik `pk`. Fixed with `hints.idNames`.
* Doctor printed hundreds of warnings. Now grouped (5 examples per code, `--all` for everything).
* YAML was unreadable. Now supported (the only CLI dependency is `yaml`).

## Unions (resolved where the document allows)

| Shape | Example | How xoong handles it |
|---|---|---|
| `anyOf: [string, X]` ("expandable": an id or the full object) | Stripe `charge.customer` | Describes `X`; a plain id stays an id |
| `anyOf: [X, null]` | Pydantic / OpenAPI 3.1 | Describes `X` |
| Members told apart by a fixed property (`type: "file"`, Stripe `object`) or an OpenAPI `discriminator` | Box items, OpenAI | Union keyed by that property |
| `X \| deleted_X` (one member fixes a flag such as `deleted: true`, the other lacks it) | Stripe, 135+ operations | Flagged member by the flag, default member otherwise |
| Anything else | GitHub `simple-user \| enterprise` | Left inline, reported as `XO160` with the member names |

`XO160` counts on the corpus: Stripe 211 to 6, OpenAI 30 to 0, Box 7 to 0, GitHub 76 to 73.

## Open problems found

| Problem | Seen in | Impact |
|---|---|---|
| Unions of entities **with no tag at all** (GitHub `simple-user \| enterprise`; Stripe `bank_account \| card \| deleted_*` needs two tags) are reported (`XO160`) but not normalised | GitHub 73 ops, Stripe 6 | Those responses are not shared through the entity store. A per-union hint is planned |
| Swagger 2.0 not read directly | Kubernetes, Mall, Apache Answer | Convert first with `swagger2openapi`; built-in conversion is backlog (low priority) |
| Composite identity (Kubernetes `namespace` + `name`) | Kubernetes | Not expressible by `x-xoong-id` yet |
| Response envelope (`{code, message, data}` on every endpoint) | Mall admin (160/160 ops) | Works, but screens read `{data.name}`; an `unwrap` hint is planned |
| `multipart/form-data` uploads | Invoice Ninja, Box | Types generate, but `xo-submit` sends JSON only |
| Auto-generated, very long `operationId`s | FastAPI | Use `METHOD /path` in templates; hint for short aliases planned |

Coverage here means real documents as input. It does **not** mean cache, invalidation, streaming or
optimistic behaviour were exercised against those APIs: that needs recorded responses (planned).

## Hints

A hints file lets the frontend declare identity without editing the backend's document:

```json
{
  "idNames": ["id", "gid"],
  "schemas": {
    "SessionResponse": { "entity": "Session", "id": "session_id" },
    "ChatResponse":    { "entity": "Session", "id": "session_id" },
    "TaskView":        { "id": "task_id" }
  }
}
```

* `idNames`: any schema with one of these properties is an entity keyed by it.
* `schemas.<Name>.id`: identity property for one schema.
* `schemas.<Name>.entity`: several schemas that describe the same thing share one entity name, so
  their data is shared and merged.

Pass it with `xoong sync <spec> --hints xoong.hints.json` (and to `doctor`).
