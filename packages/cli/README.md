# @xoong/cli

The `xoong` command: turns an OpenAPI document into typed operations, lints your screens, runs the dev server and builds static output that runs under a strict Content-Security-Policy.

## Install

```bash
npm install @xoong/cli
```

## Use

```bash
npx xoong sync openapi.json        # writes .xoong/operations.json, api.d.ts and the editor data
npx xoong doctor openapi.json      # what in the document (and in xoong.hints.json) limits xoong
npx xoong check index.html         # lint screens against the API (--format json, --exclude)
npx xoong dev                      # static server with an API proxy
npx xoong build --out dist         # strict-CSP static output (--base, --include, --exclude, --no-preload)
npx xoong render page.html --api http://localhost:8080   # prerender a page (needs @xoong/ssr)
npx xoong i18n extract src --out catalogs/en.json         # the xo-t messages; i18n check <catalog> --source <en.json>
npx xoong --help                   # every command and option; an option that does not exist is refused
```
Exit code: 0 done, 1 findings or a failure, 2 an unknown command or a missing argument.

## Measured, not promised

Median of 10 runs of the whole process on Apple M1 (2026-11-09); one machine, so use it to compare rows, not to predict yours. Method and raw runs: [benchmarks/](https://github.com/fpt-duongtx/xoong/tree/main/benchmarks).

| Command | xoong | Comparison |
|---|---|---|
| `xoong --version` (Node start-up included) | 52.5 ms | `node -e 0`: 26.9 ms |
| `xoong sync`, 4 operations | 59.1 ms | `openapi-typescript` 7.13.0: 291 ms (types only) |
| `xoong sync`, generated 500 operations | 79.3 ms | `openapi-typescript`: 437 ms (types only) |
| `xoong check`, 1 screen | 62.3 ms | no comparable tool |
| `xoong check`, 100 screens | 94.0 ms | no comparable tool |
| `xoong check`, 1,000 screens | 250 ms | no comparable tool |
| `xoong build`, people screen | 176 ms | `vite build` 8.3.6, React stack: 202 ms (bundles and minifies; xoong does not) |
| `xoong dev`, start to first response | 110 ms | `vite` (React stack): 147 ms |

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/cli
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
