// The "Benchmarks" page, the "Measured, not promised" block of the home page and the table of the npm READMEs: all generated from
// benchmarks/results/*.json, so a number on the site cannot differ from the data (test/benchmarks.test.mjs fails when it does).
// Rerun the benchmarks (benchmarks/README.md), commit the new JSON, run `npm run site` and `node tools/package-files.mjs`.
import { readFileSync, existsSync } from 'node:fs';
import { esc, tabs } from './lib.mjs';

const results = new URL('../../benchmarks/results/', import.meta.url);
const load = (name) => (existsSync(new URL(name, results)) ? JSON.parse(readFileSync(new URL(name, results), 'utf8')) : null);
const R = load('runtime.json'), E = load('effort.json'), C = load('cli.json'), M = load('mcp.json'), B = load('install.json');
export const hasBenchmarks = !!(R && E && C && M);

const REPO = 'https://github.com/fpt-duongtx/xoong';
export const BENCH_URL = `${REPO}/tree/main/benchmarks`;
const VARIANT_NAMES = { xoong: 'xoong', 'xoong-nopreload': 'xoong, no modulepreload', 'xoong-http1': 'xoong, HTTP/1.1', react: 'React stack', vue: 'Vue stack' };
const IDS = ['xoong', 'xoong-nopreload', 'xoong-http1', 'react', 'vue'];

// ---- formatting -----------------------------------------------------------------------------------------------------------------
const n = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const kb = (bytes) => `${n(bytes / 1000, 1)} kB`;
/** "median (min to max)" of a summary, with a formatter for each number. */
const spread = (s, f) => `${f(s.median)} <small>(${f(s.min)} to ${f(s.max)})</small>`;
const ms = (x) => (x >= 100 ? n(x) : n(x, 1)) + ' ms';
const plain = (html) => html.replace(/<[^>]+>/g, '');
const table = (head, rows, cls = '') => `<div class="table-wrap"><table${cls ? ` class="${cls}"` : ''}>
<thead><tr>${head.map((h, i) => `<th${i ? ' scope="col"' : ' scope="col"'}>${h}</th>`).join('')}</tr></thead>
<tbody>
${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('\n')}
</tbody></table></div>`;

const memNote = () => {
  const mem = (id) => prof(id, 'local').memPer1000Rows.median, nodes = (id) => prof(id, 'local').domNodes10000.median / 10;
  return ['xoong', 'react', 'vue'].map((id) => `${VARIANT_NAMES[id]}: ${n(mem(id) / 1024, 1)} MB of JS heap and ${n(nodes(id))} DOM nodes per 1,000 rows`).join('; ');
};
const variants = R ? IDS.filter((id) => R.variants[id]) : [];
const head = (first) => [first, ...variants.map((id) => VARIANT_NAMES[id])];
const prof = (id, p) => R.variants[id].profiles[p];
const row = (label, f) => [label, ...variants.map((id) => f(id))];

const runtimeRows = (p, keys) => keys.map(([label, key, fmt]) => row(label, (id) => spread(prof(id, p)[key], fmt)));

const loadKeys = [['First contentful paint', 'fcp', ms], ['Largest contentful paint', 'lcp', ms], ['Screen usable (first data row drawn)', 'usable', ms], ['Total blocking time up to usable', 'tbt', ms], ['JS heap after load', 'heapLoadKB', (x) => `${n(x / 1024, 1)} MB`]];
const rowKeys = [
  ['Show 100 rows (page size 10 to 100)', 'render100', ms], ['Show 1,000 rows', 'render1000', ms], ['Show 10,000 rows', 'render10000', ms],
  ['Sort by name, 1,000 rows shown', 'sort1000', ms], ['Search, 1,000 rows shown', 'filter1000', ms], ['Disable one person, 1,000 rows shown', 'update1000', ms],
  ['JS heap per 1,000 rows drawn', 'memPer1000Rows', (x) => `${n(x / 1024, 1)} MB`], ['DOM nodes per 1,000 rows drawn', 'domNodes10000', (x) => n(x / 10)],
];

function sizesTable() {
  const s = (id, k, f) => R.variants[id].sizes[k][f];
  const rows = [
    row('Requests for the first view', (id) => n(prof(id, 'local').requests.median)),
    row('JS, as written to disk', (id) => kb(s(id, 'js', 'raw'))), row('JS, gzip', (id) => kb(s(id, 'js', 'gzip'))), row('JS, brotli', (id) => kb(s(id, 'js', 'brotli'))),
    row('CSS, brotli', (id) => kb(s(id, 'css', 'brotli'))), row('HTML, brotli', (id) => kb(s(id, 'html', 'brotli'))),
    row('Total, brotli (JS, CSS and HTML)', (id) => kb(s(id, 'js', 'brotli') + s(id, 'css', 'brotli') + s(id, 'html', 'brotli'))),
    row('Third-party packages bundled into the browser build', (id) => (id.startsWith('xoong') ? '0' : n(E.stacks[id.replace('-http1', '')].dependencies.runtimeInBrowser))),
  ];
  return table(head('Delivered'), rows);
}

function effortTable() {
  const ids = ['xoong', 'react', 'vue'].filter((id) => E.stacks[id]);
  const label = { xoong: 'xoong', react: 'React stack', vue: 'Vue stack' };
  const cell = (f) => ids.map((id) => f(E.stacks[id]));
  const rows = [
    ['Files you write', ...cell((s) => n(s.files))],
    ['Lines: markup', ...cell((s) => n(s.loc.markup))], ['Lines: script', ...cell((s) => n(s.loc.script))], ['Lines: style', ...cell((s) => n(s.loc.style))],
    ['Lines: total', ...cell((s) => `<strong>${n(s.loc.all)}</strong>`)],
    ['Direct dependencies', ...cell((s) => n(s.dependencies.direct))],
    ['Packages npm installs for them', ...cell((s) => n(s.dependencies.installedTotal))],
  ];
  return table(['The same screen', ...ids.map((id) => label[id])], rows);
}

function buildTable() {
  if (!C) return '';
  const rows = Object.entries(C.build).map(([name, v]) => [esc(name), spread(v.time, ms), n(v.output.files), kb(v.output.raw), kb(v.output.gzip)]);
  return table(['Build', 'Time', 'Files', 'Output', 'Output, gzip'], rows);
}

function devTable() {
  const rows = Object.entries(C.dev).map(([name, v]) => [esc(name), spread(v, ms)]);
  return table(['Dev server', 'Time from start to first response'], rows);
}

function cliTables() {
  const startup = Object.entries(C.startup).map(([name, v]) => [`<code>${esc(name)}</code>`, spread(v, ms)]);
  const sync = Object.entries(C.sync).map(([name, v]) => [esc(name) + ` <small>(${kb(v.bytes)})</small>`, spread(v.xoong, ms), spread(v['openapi-typescript'], ms)]);
  const check = Object.entries(C.check).map(([k, v]) => [`<code>xoong check</code>, ${n(k)} screen${k === '1' ? '' : 's'}`, spread(v, ms)]);
  return `${table(['Start-up (Node included)', 'Time'], startup)}
<h3>Sync</h3>
<p><code>xoong sync</code> writes the typed operations and <code>api.d.ts</code>; <code>openapi-typescript</code> ${esc(C.versions['openapi-typescript'])} writes TypeScript types only, so it does less. It is the closest installable tool, not an equal.</p>
${table(['OpenAPI document', '<code>xoong sync</code>', '<code>openapi-typescript</code>'], sync)}
<h3>Check, build, dev and render</h3>
${table(['Command', 'Time'], check)}
${buildTable()}
${devTable()}
${C.render ? `<p><code>xoong render</code> of the people screen with its data (needs the API running; ${kb(C.renderBytes)} of HTML written): ${spread(C.render, ms)}.</p>` : ''}`;
}

function mcpTables() {
  const names = Object.keys(M.servers);
  const [x, ref] = names.map((k) => M.servers[k]);
  const p = (l) => `${n(l.p50, 2)} / ${n(l.p95, 2)} ms`;
  const rows = [
    ['Start-up: process start to the <code>initialize</code> answer', spread(x.startup, ms), spread(ref.startup, ms)],
    ['<code>tools/list</code>, p50 / p95', p(x.toolsList), p(ref.toolsList)],
    ['<code>explain_error</code>, p50 / p95', p(x.calls.explain_error), p(ref.calls.explain_error)],
    [`Throughput, ${n(x.throughput.requests)} <code>explain_error</code> requests sent back to back (at least: the test client is part of the limit)`, `${n(x.throughput.perSecond)} per second`, `${n(ref.throughput.perSecond)} per second`],
    ['Memory (RSS), idle', `${n(x.rssMB.idle, 1)} MB`, `${n(ref.rssMB.idle, 1)} MB`],
    ['Memory (RSS), after 1,000 <code>explain_error</code> calls', `${n(x.rssMB.after1000ExplainError, 1)} MB`, `${n(ref.rssMB.after1000ExplainError, 1)} MB`],
  ];
  const toolRows = Object.entries(x.calls).map(([k, v]) => [`<code>${esc(k.replace('_small', '</code> (small input)<code>').replace('_large', '</code> (large input)<code>'))}</code>`.replace('<code></code>', ''), p(v), `${n(v.responseChars)} characters`]);
  return `${table(['xoong-mcp against a minimal server on the official SDK', 'xoong-mcp (no SDK)', `TypeScript SDK ${esc(M.versions['@modelcontextprotocol/sdk'])}, one tool`], rows)}
<h3>Every tool of xoong-mcp</h3>
<p>Per-call latency over real stdio JSON-RPC, ${n(M.calls)} sequential calls after 20 warm-up calls. Sizes of the inputs of <code>check</code>: ${n(M.inputBytes.check_small)} and ${n(M.inputBytes.check_large)} characters. After 1,000 calls of the whole tool set the process uses ${n(x.rssMB.after1000Mixed, 1)} MB.</p>
${table(['Tool', 'p50 / p95', 'Answer size'], toolRows)}`;
}

// ---- the page -------------------------------------------------------------------------------------------------------------------
const env = R?.environment;
export const benchmarksPage = !hasBenchmarks ? null : {
  file: 'benchmarks.html', section: 'docs', group: 'Start', nav: 'Benchmarks', title: 'Benchmarks',
  description: 'Measured, not promised: the same admin screen in xoong, React and Vue in real Chromium, and the speed of the xoong command line and MCP server. Every number comes from a script in the repository.',
  body: `
<h1>Benchmarks</h1>
<p class="lead">Measured, not promised. The same people screen built in xoong, in a React stack and in a Vue stack, run in real Chromium; plus the speed of the <code>xoong</code> command and of <code>xoong-mcp</code>. Every number below is generated from <a href="${BENCH_URL}/results">JSON files in the repository</a> by scripts you can run, and the page is rebuilt from that data, so the two cannot drift apart.</p>

<aside class="notice warn"><span class="ic" data-ic="warning" aria-hidden="true"></span><p><strong>Read this first.</strong> These are the results of one machine (${esc(env.machine)}, ${esc(env.os)}, ${esc(env.browser)}, Node ${esc(env.node.replace(/^v/, ''))}, ${esc(env.date)}) with ${n(R.runs)} runs per number after one warm-up run: the median is shown with the smallest and largest run in brackets. Numbers depend on the machine, so use them to compare the columns of one table, not to predict your users' devices. One screen, one team of one author: this is an honest comparison of this screen, not a verdict on the frameworks.</p></aside>

<h2>What was compared</h2>
<p>One admin screen: a people list with server-side sort, search and paging, a rows-per-page choice up to 10,000, row selection with a bulk delete behind a confirm dialog, a disable action per row, an add dialog with a validated form (client rules and server field errors), and loading, error and empty states. All three implementations talk to the same mock API process and pass the same Playwright acceptance test, which uses only roles and accessible names and includes an axe-core check (WCAG 2 A and AA): ${n(15)} checks, run by <code>npm run accept</code>.</p>
<ul>
<li><strong>xoong</strong> ${esc(env.xoong)}: <code>&lt;xo-view&gt;</code>, <code>&lt;xo-table&gt;</code>, <code>&lt;xo-form&gt;</code> and <code>&lt;xo-dialog&gt;</code> from the OpenAPI document, built with <code>xoong build</code> (not minified, not bundled, modulepreload links).</li>
<li><strong>React stack</strong>: React ${esc(R.versions.react.react)}, TanStack Query ${esc(R.versions.react['@tanstack/react-query'])}, TanStack Table ${esc(R.versions.react['@tanstack/react-table'])}, React Hook Form ${esc(R.versions.react['react-hook-form'])}, zod ${esc(R.versions.react.zod)}, built with Vite ${esc(R.versions.react.vite)} (minified, one JS file).</li>
<li><strong>Vue stack</strong>: Vue ${esc(R.versions.vue.vue)}, TanStack Query and Table for Vue ${esc(R.versions.vue['@tanstack/vue-query'])}, vee-validate ${esc(R.versions.vue['vee-validate'])}, zod ${esc(R.versions.vue.zod)}, built with Vite ${esc(R.versions.vue.vite)}.</li>
</ul>
<p>The competitors are written the way their documentation shows, with the libraries most teams reach for, and with the native <code>&lt;dialog&gt;</code> that xoong also uses; none uses a component library, so the stylesheet is a few lines of plain CSS (xoong's comes with the package). All three are served by the same HTTP/2 server (self-signed certificate) with the same brotli compression and the same strict Content-Security-Policy; nothing was tuned per stack. Pages are loaded in a fresh browser context each run, so the cache is cold.</p>

<h2>What gets delivered</h2>
<p>Sizes are of the files the first view loads, computed from the built files (gzip level 9, brotli level 11), so you can recompute them. xoong's output is not minified: its files are the ones you wrote. A bundler with minification and tree-shaking, applied to the same sources, would make the xoong column smaller; the page compares what <code>xoong build</code> produces today.</p>
${sizesTable()}

<h2>Load and interaction, unthrottled</h2>
<p>Loopback network, no CPU throttling. "Screen usable" is the first data row drawn and followed by a frame. Interaction times run from the DOM event to the frame after the expected change, so they include the request to the mock API (the same for every stack: sorting is served from a cache there). The search box waits 250 ms after typing in all three, as the xoong search box does; that wait is inside the search time. "Disable one person" is the time until the cell reads "disabled": xoong's entity store updates the row from the server's answer (and, by its default rule, refetches the list in the background afterwards); the two other screens patch their cached pages from the answer and do not refetch.</p>
${table(head('Median (smallest to largest of ' + R.runs + ' runs)'), [...runtimeRows('local', loadKeys), ...runtimeRows('local', rowKeys)])}
<p>"JS heap" is the JavaScript heap after a forced garbage collection (CDP <code>Performance.getMetrics</code>). It does not count the memory of the DOM itself, which is why the number of DOM nodes is listed beside it: the stacks differ in both, in opposite directions (${memNote()}). Neither row is "the memory" of the page. "Total blocking time" is the sum of the time beyond 50 ms of every long task between first paint and "usable"; 0 means no such task, not that no long task ran (script that runs before the first paint does not count).</p>

<h2>Load and interaction, throttled</h2>
<p>The same runs with the CPU slowed 4 times and, while the page loads, a slow 4G network (150 ms round trip, 1.6 Mbit/s down, 0.75 Mbit/s up). The network is set back to normal before the interactions, because a 10,000-row answer is about a megabyte and would turn those rows into a download test. The CPU stays slowed.</p>
${table(head('Median (smallest to largest of ' + R.runs + ' runs)'), [...runtimeRows('mobile', loadKeys), ...runtimeRows('mobile', rowKeys)])}

<h3>Unbundled modules: with and without the preload links</h3>
<p><code>xoong build</code> does not bundle: the first view is ${n(prof('xoong', 'local').requests.median)} files. The build writes a <code>&lt;link rel="modulepreload"&gt;</code> for every module of the graph so the browser does not find them one import at a time. The first three columns are the same files: with the links, without them, and over HTTP/1.1 (the worst case for many small files). On the throttled profile the screen is usable after ${ms(prof('xoong', 'mobile').usable.median)} with the links, ${ms(prof('xoong-nopreload', 'mobile').usable.median)} without them and ${ms(prof('xoong-http1', 'mobile').usable.median)} over HTTP/1.1; unthrottled, on loopback, the three are within ${ms(Math.max(...['xoong', 'xoong-nopreload', 'xoong-http1'].map((id) => prof(id, 'local').usable.median)) - Math.min(...['xoong', 'xoong-nopreload', 'xoong-http1'].map((id) => prof(id, 'local').usable.median)))} of each other. First paint comes earlier without the links on the throttled profile (${ms(prof('xoong-nopreload', 'mobile').fcp.median)} against ${ms(prof('xoong', 'mobile').fcp.median)}); that was measured, not explained.</p>

<h2>Effort: the same screen, written three times</h2>
<p>Lines of code are non-blank, non-comment lines of the files a developer writes (markup, script, stylesheet); JSX is counted as script, <code>.vue</code> files are split by block. <code>package.json</code>, lockfiles and the build config are not counted. These are proxies for how much there is to write and read. They are not time: <strong>time to a passing screen was not measured</strong>, and nobody should infer it from line counts. Two things favour xoong in the table and should be said: its screen assumes an OpenAPI document exists (the other two have a hand-written 25-line API client instead, and would shrink with a code generator), and its look comes from the bundled stylesheet while the other two carry 18 lines of their own. What xoong gives up is control: a table or a form outside what <code>xo-table</code> and <code>xo-form</code> draw is yours to write.</p>
${effortTable()}

<h2>Build, dev server and install</h2>
<p>Build times are wall time of the whole process, Node start-up included. <code>vite build</code> bundles and minifies; <code>xoong build</code> copies, rewrites imports and writes preload links, so the two do different work to reach the same goal: files a browser can run under a strict CSP.</p>
${buildTable()}
${devTable()}
${B ? `<h3>Install</h3>
${table(['Install (cold npm cache)', 'Time', 'Packages', 'node_modules'], Object.entries(B.install).map(([k, v]) => [esc(k), spread(v.time, (x) => `${n(x / 1000, 1)} s`), n(v.packages), kb(v.bytes)]))}
<p>Install time depends on the network and on the registry; it is listed so you can run it yourself, not as a claim.</p>` : ''}

<h2>The <code>xoong</code> command</h2>
<p>Wall time of <code>node packages/cli/src/cli.js &lt;command&gt;</code>, Node start-up included (about ${ms(C.startup['node (empty script)'].median)} of every number below is Node starting). ${n(C.runs)} runs per number. The "generated" document has 500 operations and exists because no large real API description ships with this repository; a real one has more irregularities.</p>
${cliTables()}
<p>No comparable tool was measured for <code>check</code> (nothing else checks xoong screens against an OpenAPI document), <code>render</code> and the dev server's start (<code>vite dev</code> is listed above, but it prepares an app with a bundler pipeline, not static files).</p>

<h2>The MCP server</h2>
<p>Real stdio JSON-RPC against <code>xoong-mcp</code>, which has no SDK, and against a one-tool server written on the official TypeScript SDK that answers the same <code>explain_error</code> call with the same text. The SDK server is the reference for what the protocol layer itself costs; it is not a product comparison (it does one thing).</p>
${mcpTables()}

<h2>What was not measured</h2>
<ul>
<li>How long it takes a person to learn xoong or to build the screen. Not measurable by a script; only lines and dependencies are listed.</li>
<li>How well an AI assistant writes xoong on the first try. The scoring harness exists (<code>tools/benchmark/</code>) but no model was run, so there is no score.</li>
<li>Real devices, Firefox and Safari, a real network, a long-running page, and screens other than this one (a form-heavy or a rich-text screen may tell a different story).</li>
<li>Other frameworks (Angular, Svelte, Solid) and component libraries (MUI, Radix). Adding one means writing the screen and passing the acceptance test.</li>
<li>Server-sent live updates: xoong has them built in, the other two screens were not given a live connection, so none was measured.</li>
</ul>

<h2>Run it yourself</h2>
${tabs('Run it', [['Terminal', 'bash', `cd benchmarks
npm run setup          # npm ci for the competitors and the comparison tools (their own lockfiles; the repository's npm ci is untouched)
npm run accept xoong   # the acceptance test, also: react, vue
npm run bench          # build everything, then runtime.mjs (all tables above except the tools)
npm run cli            # the xoong command, build and dev server
npm run mcp            # the MCP server`]])}
<p>The methodology, the environment, the pinned versions and the limitations are in <a href="${BENCH_URL}/README.md">benchmarks/README.md</a>; the raw per-run numbers are in <a href="${BENCH_URL}/results">benchmarks/results</a>.</p>
`,
};

// ---- the home page block --------------------------------------------------------------------------------------------------------
/** The headline numbers: only metrics where the stacks measure the same thing; each links to the section that explains it. */
function headlines() {
  const p = (id, key) => prof(id, 'local')[key].median;
  const m = (id, key) => prof(id, 'mobile')[key].median;
  const sz = (id) => R.variants[id].sizes.js.brotli + R.variants[id].sizes.css.brotli + R.variants[id].sizes.html.brotli;
  const L = (id) => E.stacks[id].loc.all;
  const row = (what, f, fmt, href) => ({ what, values: ['xoong', 'react', 'vue'].map(f), fmt, href });
  return [
    row('Browser JS, CSS and HTML, brotli', sz, kb, '#what-gets-delivered'),
    row('Third-party packages in the browser build', (id) => (id === 'xoong' ? 0 : E.stacks[id].dependencies.runtimeInBrowser), n, '#what-gets-delivered'),
    row('Screen usable, slow 4G and 4x slower CPU', (id) => m(id, 'usable'), ms, '#load-and-interaction-throttled'),
    row('Show 1,000 rows, unthrottled', (id) => p(id, 'render1000'), ms, '#load-and-interaction-unthrottled'),
    row('Lines written for the same screen', L, n, '#effort-the-same-screen-written-three-times'),
    row('Packages npm installs for the screen', (id) => E.stacks[id].dependencies.installedTotal, n, '#build-dev-server-and-install'),
  ].map((r) => ({ ...r, cells: r.values.map((v) => r.fmt(v)) }));
}
/** "xoong is lowest in 4 of 6 rows": said by the data, so it cannot flatter. */
const standing = () => { const h = headlines(); const lowest = h.filter((r) => r.values[0] <= Math.min(...r.values)).length; return `xoong has the lowest number in ${lowest} of ${h.length} rows; by median; where another column wins, it wins, and some medians are within the spread. Lower is better in every row.`; };

export function homeBenchmarks() {
  if (!hasBenchmarks) return '';
  const rows = headlines().map((r) => `<tr><th scope="row"><a href="benchmarks.html${r.href}">${esc(r.what)}</a></th>${r.cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n');
  return `
  <section>
    <div class="wrap">
      <div class="head"><span class="eyebrow">Measured, not promised</span><h2>The same screen, three ways.</h2><p>A people list with server-side sort, search and paging, bulk delete and an add dialog, built in xoong, in React and in Vue, run in real Chromium. Median of ${n(R.runs)} runs on one machine (${esc(env.machine.split(',')[0])}); the spread, the method and what was not measured are on the <a href="benchmarks.html">benchmarks page</a>, and every number comes from a script you can run.</p></div>
      <div class="table-wrap" tabindex="0"><table aria-label="The same admin screen in xoong, a React stack and a Vue stack">
        <thead><tr><th scope="col">Metric</th><th scope="col">xoong</th><th scope="col">React stack</th><th scope="col">Vue stack</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table></div>
      <p class="hint">${standing()} Lines of code and packages are proxies for effort, not time, and xoong\'s screen assumes an OpenAPI document. <a href="benchmarks.html">All the numbers, the command line and the MCP server, and what was not measured</a>.</p>
    </div>
  </section>`;
}

/** A short Markdown table for README files (npm shows it): the same headline numbers, a link for the rest. */
export function readmeTable({ links = true, cli = false } = {}) {
  if (!hasBenchmarks) return '';
  const h = headlines();
  const lines = [
    '| The same people screen | xoong | React stack | Vue stack |',
    '|---|---|---|---|',
    ...h.map((r) => `| ${r.what} | ${r.cells.map(plain).join(' | ')} |`),
  ];
  const sync = C.sync['generated, 500 operations'];
  const extra = cli
    ? `\n\`xoong sync\` of a generated 500-operation API: ${plain(ms(sync.xoong.median))} (\`openapi-typescript\` ${esc(C.versions['openapi-typescript'])}: ${plain(ms(sync['openapi-typescript'].median))}); \`xoong --version\`: ${plain(ms(C.startup['xoong --version'].median))}, of which Node starts in ${plain(ms(C.startup['node (empty script)'].median))}.\n`
    : '';
  return `Median of ${R.runs} runs in real Chromium on ${R.environment.machine.split(',')[0]} (${R.environment.date}); React stack = React + TanStack Query and Table + React Hook Form + zod, Vue stack = Vue + TanStack + vee-validate + zod, all built with Vite. The slow case is a 4x slower CPU and slow 4G. One machine, one screen: the spread, the method and what was not measured are on ${links ? 'the [benchmarks page](https://fpt-duongtx.github.io/xoong/benchmarks.html) and in [benchmarks/](' + BENCH_URL + ')' : 'the benchmarks page'}.\n\n${lines.join('\n')}\n\n${standing()} Lines of code and packages are proxies for effort, not time.\n${extra}`;
}

/** READMEs of @xoong/cli and @xoong/mcp: the numbers of their own tool, with the comparison that was measured (and where none was). */
export function readmeCli() {
  if (!hasBenchmarks) return '';
  const s = C.sync['generated, 500 operations'], a = C.sync['examples/admin (4 operations)'];
  const b = C.build;
  const rows = [
    ['`xoong --version` (Node start-up included)', plain(ms(C.startup['xoong --version'].median)), `\`node -e 0\`: ${plain(ms(C.startup['node (empty script)'].median))}`],
    ['`xoong sync`, 4 operations', plain(ms(a.xoong.median)), `\`openapi-typescript\` ${C.versions['openapi-typescript']}: ${plain(ms(a['openapi-typescript'].median))} (types only)`],
    ['`xoong sync`, generated 500 operations', plain(ms(s.xoong.median)), `\`openapi-typescript\`: ${plain(ms(s['openapi-typescript'].median))} (types only)`],
    ...['1', '100', '1000'].map((k) => [`\`xoong check\`, ${n(k)} screen${k === '1' ? '' : 's'}`, plain(ms(C.check[k].median)), 'no comparable tool']),
    ['`xoong build`, people screen', plain(ms(b['xoong build (people screen)'].time.median)), `\`vite build\` ${C.versions.vite}, React stack: ${plain(ms(b['vite build (react screen)'].time.median))} (bundles and minifies; xoong does not)`],
    ['`xoong dev`, start to first response', plain(ms(C.dev['xoong dev'].median)), `\`vite\` (React stack): ${plain(ms(C.dev['vite dev (react)'].median))}`],
  ];
  return `Median of ${C.runs} runs of the whole process on ${C.environment.machine.split(',')[0]} (${C.environment.date}); one machine, so use it to compare rows, not to predict yours. Method and raw runs: [benchmarks/](${BENCH_URL}).\n\n| Command | xoong | Comparison |\n|---|---|---|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
}
export function readmeMcp() {
  if (!hasBenchmarks) return '';
  const [x, ref] = Object.values(M.servers);
  const p = (l) => `${n(l.p50, 2)} / ${n(l.p95, 2)} ms`;
  const rows = [
    ['Start to `initialize` answer', plain(ms(x.startup.median)), plain(ms(ref.startup.median))],
    ['`tools/list`, p50 / p95', p(x.toolsList), p(ref.toolsList)],
    ['`explain_error`, p50 / p95', p(x.calls.explain_error), p(ref.calls.explain_error)],
    ['Throughput, back-to-back requests', `${n(x.throughput.perSecond)} per second`, `${n(ref.throughput.perSecond)} per second`],
    ['Memory (RSS), idle / after 1,000 calls', `${n(x.rssMB.idle, 1)} / ${n(x.rssMB.after1000ExplainError, 1)} MB`, `${n(ref.rssMB.idle, 1)} / ${n(ref.rssMB.after1000ExplainError, 1)} MB`],
  ];
  return `Real stdio JSON-RPC, ${n(M.calls)} sequential calls per tool, ${M.runs} start-ups, on ${M.environment.machine.split(',')[0]} (${M.environment.date}). The reference is a one-tool server on the official TypeScript SDK ${M.versions['@modelcontextprotocol/sdk']} answering the same call: it shows what the protocol layer costs, it is not a product comparison. Every tool and the method: [benchmarks/](${BENCH_URL}).\n\n| | xoong-mcp (no SDK) | SDK reference |\n|---|---|---|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;
}
