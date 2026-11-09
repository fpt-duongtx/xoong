# xoong benchmarks

Measured, not promised. Everything on the [benchmarks page](https://fpt-duongtx.github.io/xoong/benchmarks.html), in the home page block and in the npm READMEs comes
from the JSON files in [`results/`](results), written by the scripts in this folder. The page is generated from those files (`tools/site/benchmarks-page.mjs`) and a
test fails when it differs from them, so a number cannot be edited by hand.

Nothing here is a verdict on a framework. It is one screen, written once per stack by one author, measured on one machine. Use it to see what a stack costs
for *this* screen, and rerun it on yours.

## Publication switch and gate

What these scripts measure is always in this folder. Whether it is *published* (the benchmarks page, the home page block, the tables in the READMEs) is one switch:
`results/publish.json`, `{ "publish": false }`, **off by default**. While it is off, `tools/site/benchmarks-page.mjs` and `tools/package-files.mjs` generate none of those and
`benchmarks/` stays a working harness. Turn it on (`true`), then run `npm run site` and `node tools/package-files.mjs`; the drift tests cover both states.

Gate for turning it on: in the same session and on the same profile, xoong is the best or within 10% of the best in at least 4 of the 6 headline rows of the table, and is not behind
the best by more than 25% in any headline row. Otherwise report the table and what is still behind to the owner first. Numbers are never inflated and never left out of a published table.

## Re-render probe

`rerender.mjs` counts what the DOM does when one thing changes (nodes added and removed, text and attribute writes, rows that stay the same element, and for xoong the effect runs) on the
screen with 1,000 rows, for all four stacks: `results/rerender.json` (`xoongBefore` is xoong before its re-render fixes). It found, and `packages/data/src/view.js` now fixes: a refetch with
unchanged data re-ran every row's bindings and rewrote its text; deleting one row moved all the rows after it; ticking one row re-ran every checkbox; every `[...el.attributes]` made the browser keep an
Attr node per attribute (23 of 37 nodes per row); and rows of an earlier list stayed in memory after a sort or a search (a closure made inside the list effect kept that run's rows alive).
Regression tests: `packages/data/test/rerender.spec.mjs`, `packages/data/test/row-release.test.mjs`.

## What is not done yet

The richer nested "orders" screen, the written specification (`SPEC.md`) with a parity report across stacks, and the normalisation list (no icons, fonts, source maps; load average checks) were
requested after the numbers above were taken and are not done: the committed numbers are of the flat screen only.

## What is measured

| Script | Measures | Output |
|---|---|---|
| `runtime.mjs` | The same people screen in xoong, a React stack, a Vue stack and an Angular stack, in real Chromium over HTTP/2: bytes delivered, requests, first and largest contentful paint, blocking time, time until the screen is usable, JS heap, DOM nodes, time to show 100 / 1,000 / 10,000 rows, to sort, to search and to update one row. Unthrottled, and with a 4x slower CPU plus slow 4G while loading. Also xoong without modulepreload and over HTTP/1.1. | `results/runtime.json` |
| `effort.mjs` | Files, lines of code (markup, script, style), direct dependencies, installed packages and the list of libraries (with versions and purpose) of the four screens. | `results/effort.json` |
| `cli.mjs` | The `xoong` command: start-up, `sync` (against `openapi-typescript`), `check` on 1 / 100 / 1,000 screens, `build` (against `vite build` and `ng build`), dev server start (against `vite` and `ng serve`), `render`. | `results/cli.json` |
| `mcp.mjs` | `xoong-mcp` over real stdio JSON-RPC: start-up, `tools/list`, latency per tool (p50 / p95), throughput, memory; against a one-tool server on the official TypeScript SDK. | `results/mcp.json` |
| `install.mjs` | Cold-cache install time, packages and `node_modules` size. Needs the npm registry. | `results/install.json` |

Not measured, and said so on the page: how long a person takes to learn xoong or to build the screen; how well an AI assistant writes xoong (the scoring
harness in `tools/benchmark/` exists, no model was run, so there is no score); real devices, Firefox, Safari; other frameworks and component libraries; live updates.

## The screen and the rule that keeps it fair

`shared/openapi.json` describes the API and `shared/api.mjs` is the mock that serves it (10,000 seeded people, in memory; sorted copies are cached, so an answer costs a slice,
not a sort). The same process serves every stack. `lib/acceptance.mjs` is the acceptance test: 15 checks written against roles and accessible names only (never class names),
including an axe-core scan (WCAG 2 A and AA), server-side sort / search / paging, selection, bulk delete behind a confirm, an add dialog with client and server validation,
the disable action, and the loading, empty and error states. A stack that fails a check is not benchmarked. Run it with `npm run accept xoong` (or `react`, `vue`).

* `apps/xoong`: the screen as xoong writes it (`index.html` and a two-line script), built with `xoong build` (not minified, not bundled, modulepreload links).
* `apps/react`: React 19, TanStack Query and Table, React Hook Form, zod, the native `<dialog>`; built with Vite (minified).
* `apps/vue`: Vue 3, TanStack Query and Table for Vue, vee-validate, zod, the native `<dialog>`; built with Vite.
* `apps/angular`: Angular 22 (standalone components, signals, `resource()`, the new control flow, reactive forms, native `<dialog>`); built with `ng build` (esbuild). No Angular Material, CDK or other library: an expert could add them, none is needed for this screen. `rxjs` comes with the framework (used here for the search debounce).

**The rule: a stack is measured with everything it needs for the screen; each added library counts in full.** Its bytes are in the bundle, its packages in the install count (direct and total),
its size and time in the install benchmark, its entry in "third-party packages in the browser build", and the lines written to use it in the lines of code. Nothing is hidden or excluded.
The libraries of every stack, with versions and what each is for, are listed on the benchmarks page (generated from `results/effort.json`, `libraries`). Libraries a stack does not need are
not added to make it look worse either.

### The React screen: what changed, and why it is the fairer version

The first React screen was written like a translation of the xoong one (a hand-made `Dialog` component, separate files for the table and the dialog, sort and page state kept by hand and fed to
TanStack Table). It was replaced by what a React specialist would write with the same libraries (no library was added or removed): TanStack Table's own `sorting`, `pagination` and `rowSelection`
state with `manualSorting` / `manualPagination` / `rowCount`, so paging (`getCanNextPage`, `nextPage`, `setPageSize`), selection (`getToggleAllRowsSelectedHandler`) and sort toggling come from the table;
column definitions outside the component, with the row action reaching the mutation through the table's `meta`; a small `useDebounced` hook; React Hook Form with the zod resolver,
server field errors through `setError`; and the native `<dialog>` driven through refs (`showModal()`, `close()`) with no wrapper component. It is one component file instead of four, and
the same 15 acceptance checks and the same behaviour (250 ms search debounce, the row patched from the "disable" answer) hold. The Vue screen got the same treatment for its dialogs (the wrapper component
was removed in favour of the native `<dialog>` with template refs); its table and form code were left as they were.

### The Angular screen under the strict policy

The policy is the same for every stack (`script-src 'self'; style-src 'self'; base-uri 'none'` and the rest, see below). Angular needed three settings, none of which loosens the policy:
`optimization.styles.inlineCritical: false` in `angular.json` (the default writes an inline style and an `onload` handler into `index.html`); all CSS in one global stylesheet (`src/styles.css`),
because component styles are injected as `<style>` elements at run time and would need a nonce; and no `<base href>` in `index.html` (`ng new` writes one; `base-uri 'none'` forbids it, and this screen has no router).
No nonce, no `unsafe-inline`; every run records zero violations. The Angular CLI 22 needs Node 24.15 or newer (this machine's default Node was older), so **every benchmark of every stack in the committed
results ran on the same newer Node** (see `environment.node` in the results files).

The competitors follow their documentation and the libraries most teams use for this job. Neither uses a component library (xoong has its own admin set, and a fair
comparison with MUI or Radix would need a stack-by-stack decision this repository does not make), so they carry 18 lines of plain CSS. The search box waits 250 ms after typing in
all three, because xoong's does. After "disable", each stack does what its documentation shows: xoong's shared entity store updates the row from the answer at once and, by its default invalidation rule, also refetches the list in the background; the React and Vue screens patch the cached pages from the answer (`setQueriesData`) and do not refetch. The update time is the time until the cell reads "disabled", so it is the patch in all three.

## How a run is measured

* A fresh Chromium context per run (cold cache), one unmeasured warm-up run per configuration, then `--runs` (default 5) measured runs. The JSON keeps every run;
  the page shows the median with the smallest and largest run.
* All stacks are served by `lib/serve.mjs`: HTTP/2 over TLS with a throw-away self-signed certificate, brotli (quality 11, cached) or gzip, and this strict policy:
  `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'`.
  A CSP violation in any run is recorded (`cspViolations`, 0 for all).
* FCP and LCP come from `PerformanceObserver`. "Screen usable" is the first data row in the DOM followed by two animation frames. Total blocking time is the sum of long tasks
  beyond 50 ms between FCP and usable. Bytes are computed from the built files (gzip -9, brotli -11), so they can be recomputed; the page loads the same files.
* Interactions run inside the page, timed from the DOM event to the frame after the awaited DOM change. They include the request to the mock API, which is the same for all.
* JS heap is `JSHeapUsedSize` after two forced garbage collections; per 1,000 rows it is `(heap with 10,000 rows drawn - heap with 10) / 9.99`. The DOM's own memory is not in it,
  which is why DOM nodes are reported next to it.
* Throttled: CPU slowed 4x for the whole run; network 150 ms RTT, 1.6 Mbit/s down, 0.75 Mbit/s up while the page loads, then removed for the interactions
  (a 10,000-row answer is about a megabyte and would otherwise measure the link).
* CLI and MCP numbers are wall times of whole processes, Node start-up included, `--runs` (default 10) after one warm-up. MCP latency is per call over stdio,
  200 sequential calls after 20 warm-up calls, p50 and p95. Memory is the process RSS from `ps`.

## Run it

```bash
cd benchmarks
npm run setup          # xoong sync + build, then `npm ci` in apps/react, apps/vue, apps/angular and tooling/ (their own lockfiles)
npm run accept xoong   # the acceptance test for one stack
npm run bench          # build everything, then runtime.mjs and effort.mjs
npm run cli            # the xoong command
npm run mcp            # the MCP server
npm run install-times  # needs the registry
```

Needs Node 22.12+, the repository's `npm ci` done once at the root (Playwright, axe-core), a Chromium that Playwright can launch (`npx playwright install chromium`), and `openssl`.
The competitors' dependencies never enter the repository's lockfile or CI: they live in `apps/react/`, `apps/vue/`, `apps/angular/` and `tooling/`, each with an exact-version `package.json`
and a `package-lock.json`. Do not run other work while a benchmark runs: it shares the CPU.

After a run: commit `results/*.json`, run `npm run site` (and `node tools/package-files.mjs`) at the root so the page, the home block and the READMEs follow the data.

## Environment of the committed results

See the `environment` object at the top of every file in `results/` (machine, OS, Node, Chromium, xoong version, commit, date). Pinned versions of the competitors are in
their `package.json` files and in `results/runtime.json` (`versions`).

## Limitations

* One machine (a laptop with other background load), one run of the whole suite. Spread between runs is shown; the spread between machines and days is not.
* The xoong build is not minified; the others are. This is what `xoong build` does today and is shown as such.
* The competitor screens were written for this benchmark by the xoong author. They pass the same acceptance test and follow their documentation, but a specialist might write a
  faster or shorter one. Pull requests that improve them are welcome: the acceptance test keeps them honest.
* `generated, 500 operations` is a synthetic OpenAPI document; real ones are messier. No large real document ships with this repository.
* Lines of code, packages and sizes are proxies. They are not time to build or learn, which are not measured.
