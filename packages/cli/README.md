# @xoong/cli

The `xoong` command: turns an OpenAPI document into typed operations, lints your screens, runs the dev server and builds static output that runs under a strict Content-Security-Policy.

Stability: **core**, see [docs/stability.md](https://github.com/fpt-duongtx/xoong/blob/main/docs/stability.md).

## Install

```bash
npm install @xoong/cli
```

## Use

```bash
npx xoong sync openapi.json        # writes .xoong/operations.json, api.d.ts and the editor data
npx xoong doctor openapi.json      # what in the document (and in xoong.hints.json) limits xoong
npx xoong check index.html         # lint screens against the API (--format json, --exclude)
npx xoong dev --base /admin        # static server with an API proxy, mounted at /admin
npx xoong build --out dist         # strict-CSP static output (--base, --bundle, --include, --exclude, --no-preload)
npx xoong render page.html --api http://localhost:8080   # prerender a page (needs @xoong/ssr)
npx xoong i18n extract src --out catalogs/en.json         # the xo-t messages; i18n check <catalog> --source <en.json>
npx xoong --help                   # every command and option; an option that does not exist is refused
```
Exit code: 0 done, 1 findings or a failure, 2 an unknown command or a missing argument.

## Measured, not promised

Median of 10 runs of the whole process on Apple M5 Pro (2026-11-17); one machine, so use it to compare rows, not to predict yours. Method and raw runs: [benchmarks/](https://github.com/fpt-duongtx/xoong/tree/main/benchmarks).

| Command | xoong | Comparison |
|---|---|---|
| `xoong --version` (Node start-up included) | 83.1 ms | `node -e 0`: 65.3 ms |
| `xoong sync`, 4 operations | 87.7 ms | `openapi-typescript` 7.13.0: 215 ms (types only) |
| `xoong sync`, generated 500 operations | 94.4 ms | `openapi-typescript`: 301 ms (types only) |
| `xoong check`, 1 screen | 86.7 ms | no comparable tool |
| `xoong check`, 100 screens | 104 ms | no comparable tool |
| `xoong check`, 1,000 screens | 185 ms | no comparable tool |
| `xoong build`, people screen | 139 ms | `vite build` 8.3.6, React stack: 184 ms (bundles and minifies; xoong does not) |
| `xoong dev`, start to first response | 114 ms | `vite` (React stack): 141 ms |

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/cli
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
