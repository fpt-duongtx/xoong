# @xoong/xoong

One install for xoong, a small standards-first web framework: signals and templates, the OpenAPI data layer, forms, the admin set and the `xoong` command.

Stability: **core**, see [docs/stability.md](https://github.com/fpt-duongtx/xoong/blob/main/docs/stability.md).

## Use

```bash
npm install @xoong/xoong
npx xoong sync openapi.json
```
```js
import { configure, signal, html } from '@xoong/xoong';
import '@xoong/xoong/view';
import '@xoong/xoong/ui';
```
More parts, installed separately: `@xoong/controls`, `@xoong/richtext`, `@xoong/i18n`, `@xoong/test`, `@xoong/ssr`, `@xoong/mcp`, `@xoong/lsp`.

## Measured, not promised

Median of 5 runs in real Chromium on Apple M5 Pro (2026-11-17); React stack = React + TanStack Query and Table + React Hook Form + zod, Vue stack = Vue + TanStack + vee-validate + zod, Angular stack = Angular with signals and reactive forms and no extra library; xoong has two columns because its default output is unminified and readable while the others ship minified bundles, and the --minify column counts esbuild too; every library a stack needs counts in full. The slow case is a 4x slower CPU and slow 4G. One machine, one screen: the spread, the method and what was not measured are on the [benchmarks page](https://fpt-duongtx.github.io/xoong/benchmarks.html) and in [benchmarks/](https://github.com/fpt-duongtx/xoong/tree/main/benchmarks).

| The same people screen | xoong (bundled, minified) | React stack | Vue stack | Angular stack |
|---|---|---|---|---|
| Browser JS, CSS and HTML, brotli | 31.6 kB | 102.2 kB | 64.0 kB | 59.0 kB |
| Third-party packages in the browser build | 0 | 7 | 6 | 7 |
| Screen usable, slow 4G and 4x slower CPU | 836 ms | 1,069 ms | 852 ms | 836 ms |
| Show 1,000 rows, unthrottled | 58.0 ms | 61.7 ms | 81.0 ms | 49.4 ms |
| Lines written for the same screen | 39 | 213 | 180 | 229 |
| Packages npm installs for the screen | 14 | 52 | 83 | 362 |

xoong (bundled and minified like the others, with esbuild counted) has the lowest number in 4 of 6 rows; by median; where another column wins, it wins, and some medians are within the spread. Lower is better in every row. Lines of code and packages are proxies for effort, not time.

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/xoong
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
