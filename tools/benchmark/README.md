# First-attempt correctness: the AI benchmark

How well can an assistant that has only the xoong spec (`llms.txt`) and the list of an API's operations write a working screen in **one attempt**? That is the claim behind
"made for AI and people" ([docs/ai-integration.md](../../docs/ai-integration.md) section 5). This folder is the suite that measures it, written so the same measurement can be
repeated later (a new model, a changed `llms.txt`, a new xoong version) and the results compared.

## What is measured

Nine tasks (`tasks/tasks.json`), from a public blog to an admin table with a dialog, each with an OpenAPI file, a task text and a reference solution. The last three were added in suite
version 3 and were **not** used to find the gaps that `llms.txt`, `xoong check` and the operations list were fixed for (the first six were), so they are the check that those fixes are not only
tuned to their own tasks:

| Task | What it asks for | Tests |
|---|---|---|
| `small-site` | a list page and a detail page picked by `?id=` | reads, links, the page URL |
| `crud-admin` | users table, an add form, Disable and Delete on every row | reads, `xo-click`, `xo-submit` |
| `shared-data` | orders and customers on one page, consistent | entities shared between two views |
| `live-updates` | a list that updates when the server pushes | `live`, stream events |
| `admin-table` | sortable, searchable table, 10 per page, an Add dialog with a form | the admin set: `xo-table`, `xo-dialog`, `xo-form` |
| `paging-filter` | 5 per page, Previous/Next, Draft/Published filters | `xo-param`, `$hasPrev`, `$hasNext` |
| `edit-article` | edit the article whose id is in `?id=`, a filled form, Save | `p-id="?id"`, a form filled from the record, `PUT` with the id |
| `bulk-delete` | a table with a checkbox per row and Delete selected, one request | `xo-table selectable`, `xo-selected`, a body with `ids` |
| `error-retry` | Loading…, the server's error message and Retry, then the notes | `$loading`, `$error`, `xo-refresh` |

An attempt passes when **both** stages pass:

1. **Static** (`score.mjs`): every expected file exists, `xoong check` reports no errors, the required operations and constructs are used, nothing forbidden appears
   (a hand-written `fetch`, an HTTP library, `innerHTML`, utility classes, inline handlers).
2. **Behaviour** (`behavior.mjs`): the page is mounted in happy-dom with the real runtime and a mock of the task's API, and exercised the way a person would: the data
   shows, a button calls the right operation with the right id, a form sends what was typed, a pushed event changes the list, Next asks for the next page. The checks look for
   text, button labels and field names, never for a class or a selector the assistant could not know.

The rate is `passed / attempts`. The static stage alone is recorded too, so you can see how much "looks right" overstates "works".

The reference solution of every task must pass both stages, and typical mistakes must fail them: `test/benchmark.test.mjs` keeps the scorer honest.

## The protocol

**Single turn, no feedback loop**: the model gets one prompt (the instructions, `llms.txt`, the operations of the API, the task) and answers once with the files. It cannot run
`xoong check` or ask a question. This is the pessimistic case on purpose; the loop with feedback (check through MCP) is a separate, later measurement.

`prepare.mjs` writes that prompt and a manifest of hashes. A result is comparable with another only when the hashes match (`suiteVersion`, `llmsSha256`, `instructionsSha256` and
the hash of the task's prompt).

## Run it again

```bash
# 1. the prompts, and what identifies them
node tools/benchmark/prepare.mjs /tmp/kit                     # /tmp/kit/<task>/prompt.md and /tmp/kit/manifest.json

# 2. give each prompt to the model as the whole user message, no tools, and save its answer
#    as <answers>/<task>/run1.md, run2.md, ... (3 or more attempts per task is better than 1)

# 3. score the answers and append the run to benchmarks/results/ai.json
node tools/benchmark/record.mjs <answers> --model "claude-sonnet-5-5" --note "what is special about this run"
```

`record.mjs` takes the raw answers (`<task>/run1.md`: the files are read from `FILE: path` + a fenced block, see `suite.mjs`) or folders of files (`<task>/run1/index.html`).
Add `--no-write` to only look at the score. The answers of a recorded run are kept in `benchmarks/ai/answers/<run id>/`, so a later change of the scorer can be re-applied to the same
answers.

A model that runs through an API needs nothing else from this folder: send `prompt.md` as the user message and save the text of the reply.

## What the numbers do and do not show

* A rate over a handful of tasks and a few attempts is an estimate with a wide error bar, not a score: say "5 of 6 tasks passed in 3 of 3 attempts", not "92%".
* One model's number is that model's. Compare the same prompts across models and across xoong versions, not across suites.
* The behaviour stage is a mock of the API in happy-dom, not a browser against a real backend. It catches a page that does not work; it does not prove a page that passes is pretty or
  accessible.
* A failure is as useful as a pass: `benchmarks/results/ai.json` keeps the reasons, and the failures that repeat across attempts point at a gap in `llms.txt`, in `xoong check`
  or in the framework. The first measurement found one that way (see docs/ai-integration.md).
* When the scorer is wrong about an attempt (it happened once, 2026-11-08), fix the scorer, re-score the same answers, and say so next to the number.
