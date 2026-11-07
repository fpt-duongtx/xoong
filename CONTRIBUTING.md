# Contributing to xoong

xoong is a small framework with a deliberately small surface. Read [docs/design-principles.md](docs/design-principles.md)
first: a change that breaks a principle needs an ADR in [docs/decisions/](docs/decisions).

## Run it

```bash
npm ci
npx playwright install chromium     # real-browser tests (or set XOONG_CHROMIUM=/path/to/chromium)
npm test                            # unit, screen and end-to-end tests
npm run test:coverage               # same, with the coverage thresholds CI enforces
```

Node 22.12 or newer is needed for development (Vitest 5). Try the packages in a new project before they are
published: `node packages/cli/src/cli.js new /tmp/demo --spec examples/admin/openapi.json --link $(pwd)`.

## Rules

* **Every change has tests**, and every bug fix has a regression test that fails without the fix. Coverage thresholds in
  `vitest.config.mjs` are never lowered to make CI pass.
* **`llms.txt` is part of the public API.** Update it in the same change as any public API change; tests tie it to
  `xoong check`, the CLI and the runtime, and cap it at 3,000 tokens.
* **Zero runtime dependencies** in `core` and `data` (and `ui` may use only those two). The architecture test enforces
  it, and the size budgets next to it (gzip of the code without comments).
* **Light DOM, plain CSS, native elements.** No Shadow DOM, no CSS-in-JS, no utility classes. HTML in docs and examples
  must pass `xoong check`.
* **One way to do each thing.** Before adding an attribute or an option, show why an existing one cannot do the job.
* **The HTML syntax is Draft.** Change it only with evidence from real use, and update `llms.txt`, `check`, the editor
  data (`html-data.js`) and the docs together.
* External OpenAPI documents and sample data must be **anonymised** before they enter the repository.
* Code, docs and commit messages are in English. Commits are small and by area (`feat(data): ...`, `fix(ui): ...`,
  `docs: ...`); no "fix typo" series.

## Pull requests

Describe the problem, the change and how you tested it. CI must be green on Node 22 and 24. Explain any new public
name (attribute, element, option, hint) against the principles.

## Architecture decisions

Copy the shape of an existing ADR (`Context`, `Decision`, `Consequences`), number it, and link it from the change that
needs it.
