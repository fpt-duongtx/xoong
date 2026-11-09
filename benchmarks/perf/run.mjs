// xoong-only performance suite: the framework's own cost on three workloads, so a gain has to show on all of them.
//   1. the people screen of benchmarks/apps/xoong (the plain, documented markup: a flat table of 10 to 10,000 rows)
//   2. nested lists: accounts > orders > line items (200 x 5 x 4, and 1,000 accounts), xo-if per order, one item updated through the entity store
//   3. other pages: examples/admin and pages of the documentation site (start-up cost of the runtime on an arbitrary app)
// Nothing here tunes a screen: the markup is the one a user writes. Times are measured in the page, CPU split from the DevTools metrics
// (ScriptDuration, LayoutDuration, RecalcStyleDuration), memory after a forced garbage collection.
//   node benchmarks/perf/run.mjs [--runs 5] [--out benchmarks/results/perf.json] [--only flat,nested,admin,docs]
import { writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { build, CSP } from '../../packages/cli/src/build.js';
import { sync } from '../../packages/cli/src/commands.js';
import { serve } from '../lib/serve.mjs';
import { launchChromium } from '../../tools/browser.mjs';
import { startBackend } from '../../examples/admin/backend.mjs';
import { summary, round } from '../lib/stats.mjs';
import { environment } from '../lib/env.mjs';
import { mode } from '../lib/acceptance.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('runs', 5));
const only = (arg('only', 'flat,nested,admin,docs')).split(',');
const outFile = arg('out', new URL('../results/perf.json', import.meta.url).pathname);
const repo = new URL('../..', import.meta.url).pathname;
const tmp = await mkdtemp(join(tmpdir(), 'xoong-perf-'));
const browser = await launchChromium();
const results = { environment: environment({ browser: `Chromium ${browser.version()}` }), runs: RUNS, workloads: {} };
const log = (...a) => console.log(...a);

// ---- in-page helpers (the same names in every workload) ------------------------------------------------------------------------------
const HELPERS = () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const until = (fn, timeout = 90000) => new Promise((res, rej) => {
    const t0 = performance.now();
    const check = () => { let ok = false; try { ok = fn(); } catch { /* not yet */ } if (ok) { mo.disconnect(); res(); } else if (performance.now() - t0 > timeout) { mo.disconnect(); rej(new Error('timeout')); } };
    const mo = new MutationObserver(check); mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    check(); setTimeout(function again() { if (performance.now() - t0 < timeout) { check(); setTimeout(again, 30); } }, 30);
  });
  const timed = async (act, done) => { const t0 = performance.now(); act(); await until(done); await frame(); return performance.now() - t0; };
  const count = (sel) => document.querySelectorAll(sel).length;
  const typeInto = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.__p = {
    frame, until, timed, count, typeInto,
    setSize: (n) => timed(() => { const s = document.querySelector('nav select'); s.value = String(n); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, () => count('tbody tr') === n),
    sortName: () => timed(() => [...document.querySelectorAll('th button')].find((b) => b.textContent.trim() === 'Name').click(), () => document.querySelector('th[aria-sort="ascending"]') && document.querySelector('tbody td:nth-child(2)').textContent.startsWith('Ada Lovelace')),
    search: (v, n) => timed(() => typeInto(document.querySelector('input[type=search]'), v), () => count('tbody tr') === n),
    disableFirst: () => timed(() => document.querySelector('tbody tr button').click(), () => document.querySelector('tbody tr td:nth-child(5)').textContent.trim() === 'disabled'),
    tickOne: () => timed(() => document.querySelectorAll('tbody input[type=checkbox]')[3].click(), () => count('tbody input:checked') === 1),
    tickAll: () => timed(() => document.querySelector('thead input[type=checkbox]').click(), () => count('tbody input:checked') === count('tbody tr')),
    next: (first) => timed(() => [...document.querySelectorAll('nav button')].find((b) => b.textContent.includes('') && /next/i.test(b.getAttribute('aria-label') ?? '')).click(), () => document.querySelector('tbody tr td:nth-child(3)').textContent.trim() === first),
  };
};

const metricsOf = async (cdp) => { const { metrics } = await cdp.send('Performance.getMetrics'); const g = (n) => metrics.find((m) => m.name === n)?.value ?? 0; return { script: g('ScriptDuration') * 1000, layout: g('LayoutDuration') * 1000, style: g('RecalcStyleDuration') * 1000, heapKB: g('JSHeapUsedSize') / 1024, nodes: g('Nodes'), gcMs: g('V8CompileDuration') * 1000 }; };
const gc = async (cdp) => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); };

/** One step: time in the page, and the CPU split of what it did. */
async function step(page, cdp, fn) {
  const a = await metricsOf(cdp);
  const ms = await page.evaluate(fn);
  const b = await metricsOf(cdp);
  return { ms, script: b.script - a.script, layout: b.layout - a.layout, style: b.style - a.style };
}

const collect = (runs) => {
  const out = {};
  for (const key of Object.keys(runs[0])) {
    const v = runs.map((r) => r[key]);
    if (typeof v[0] === 'number') { const s = summary(v); for (const k of ['median', 'min', 'max', 'q1', 'q3']) s[k] = round(s[k], key === 'bytes' || key === 'nodes' || key === 'heapKB' ? 0 : 1); s.runs = s.runs.map((x) => round(x, 1)); out[key] = s; } else out[key] = runs[0][key];
  }
  return out;
};
const repeatSteps = async (name, scenario) => {
  const per = {};
  for (let i = -1; i < RUNS; i++) { // the first, warm-up run is not counted
    const r = await scenario();
    if (i >= 0) for (const [k, v] of Object.entries(r)) (per[k] ??= []).push(v);
  }
  const out = {};
  for (const [k, runs] of Object.entries(per)) out[k] = collect(runs);
  results.workloads[name] = out;
  log(name.padEnd(8), Object.entries(out).map(([k, v]) => `${k}: ${v.ms?.median ?? v.usable?.median ?? ''}`).join(' | '));
};

async function open(base, { cpu = 1, init, rows } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const requests = []; page.on('response', (r) => { if (!/\/api\//.test(r.url())) requests.push(r.url()); });
  return { ctx, page, cdp, requests };
}
const startupOf = async (page, cdp, requests, ready) => {
  await page.waitForFunction(ready, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  const m = await metricsOf(cdp);
  const t = await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, p.startTime])); return { dcl: nav.domContentLoadedEventEnd, fcp: paint['first-contentful-paint'] ?? 0 }; });
  return { fcp: t.fcp, scriptAtStart: m.script, layoutAtStart: m.layout + m.style, modules: requests.filter((u) => /\.js(\?|$)/.test(u)).length, heapKB: m.heapKB, nodes: m.nodes };
};

// ---- 1. the people screen ------------------------------------------------------------------------------------------------------------
if (only.includes('flat')) {
  const dist = join(repo, 'benchmarks/apps/xoong/dist');
  const server = await serve({ root: dist, rows: 10000, csp: CSP });
  const base = server.url;
  const fresh = async () => { const o = await open(base); await mode(o.page, base, 'normal', 10000); await o.page.goto(base + '/'); await o.page.waitForSelector('tbody tr td'); await o.page.evaluate(HELPERS); await o.page.waitForTimeout(300); return o; };
  const wl = (name, f) => repeatSteps(name, async () => { const o = await fresh(); try { return await f(o); } finally { await o.ctx.close(); } });
  await wl('flat: create 1,000 rows', async (o) => ({ ms: (await step(o.page, o.cdp, () => window.__p.setSize(1000))) }));
  await wl('flat: create 10,000 rows', async (o) => ({ ms: (await step(o.page, o.cdp, () => window.__p.setSize(10000))) }));
  await wl('flat: update one field (1,000 rows)', async (o) => { await o.page.evaluate(() => window.__p.setSize(1000)); await o.page.waitForTimeout(300); return { ms: await step(o.page, o.cdp, () => window.__p.disableFirst()) }; });
  await wl('flat: sort (1,000 rows)', async (o) => { await o.page.evaluate(() => window.__p.setSize(1000)); await o.page.waitForTimeout(300); return { ms: await step(o.page, o.cdp, () => window.__p.sortName()) }; });
  await wl('flat: search, 11 of 1,000 stay', async (o) => { await o.page.evaluate(() => window.__p.setSize(1000)); await o.page.waitForTimeout(300); return { ms: await step(o.page, o.cdp, () => window.__p.search('person99', 111)) }; });
  await wl('flat: tick one row (1,000)', async (o) => { await o.page.evaluate(() => window.__p.setSize(1000)); await o.page.waitForTimeout(300); return { ms: await step(o.page, o.cdp, () => window.__p.tickOne()) }; });
  await wl('flat: tick all (1,000)', async (o) => { await o.page.evaluate(() => window.__p.setSize(1000)); await o.page.waitForTimeout(300); return { ms: await step(o.page, o.cdp, () => window.__p.tickAll()) }; });
  await wl('flat: memory and churn', async (o) => {
    await gc(o.cdp); const base0 = await metricsOf(o.cdp);
    await o.page.evaluate(() => window.__p.setSize(10000)); await o.page.waitForTimeout(300); await gc(o.cdp); const full = await metricsOf(o.cdp);
    for (let i = 0; i < 4; i++) { await o.page.evaluate(() => window.__p.setSize(1000)); await o.page.evaluate(() => window.__p.setSize(10)); }
    await o.page.waitForTimeout(300); await gc(o.cdp); const after = await metricsOf(o.cdp);
    return { mem: { heapKBPer1000Rows: (full.heapKB - base0.heapKB) / 9.99, nodesPer1000Rows: (full.nodes - base0.nodes) / 9.99, retainedHeapKBAfterChurn: after.heapKB - base0.heapKB, retainedNodesAfterChurn: after.nodes - base0.nodes } };
  });
  await repeatSteps('flat: start-up', async () => {
    const o = await open(base); await mode(o.page, base, 'normal', 10000);
    await o.page.goto(base + '/'); const s = await startupOf(o.page, o.cdp, o.requests, () => document.querySelector('tbody tr td:nth-child(2)')?.textContent.trim());
    await o.ctx.close(); return { start: s };
  });
  await server.close();
}

// ---- 2. nested lists -----------------------------------------------------------------------------------------------------------------
if (only.includes('nested')) {
  const app = join(repo, 'benchmarks/perf/nested');
  await sync(join(app, 'openapi.json'), { out: join(app, '.xoong'), hints: join(app, 'xoong.hints.json') });
  const dist = join(tmp, 'nested'); await build({ root: app, out: dist });
  const data = (n) => Array.from({ length: n }, (_, a) => ({ id: a + 1, name: `Account ${a + 1}`, orders: Array.from({ length: 5 }, (_, o) => ({ id: (a + 1) * 10 + o, status: o === 3 ? 'overdue' : 'paid', items: Array.from({ length: 4 }, (_, i) => ({ id: ((a + 1) * 10 + o) * 10 + i, sku: `SKU-${a}-${o}-${i}`, qty: 1 + i })) })) }));
  const bumped = new Map();
  const handler = (req, res, url) => {
    if (url.pathname === '/api/accounts') { const items = data(Number(url.searchParams.get('limit') ?? 200)); for (const a of items) for (const o of a.orders) for (const it of o.items) if (bumped.has(it.id)) it.qty = bumped.get(it.id); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ items })); return true; }
    const m = /^\/api\/items\/(\d+)\/bump$/.exec(url.pathname);
    if (m && req.method === 'POST') { const id = Number(m[1]); bumped.set(id, (bumped.get(id) ?? 1) + 100); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id, sku: 'x', qty: bumped.get(id) })); return true; }
    return false;
  };
  const server = await serve({ root: dist, csp: CSP, handler });
  const load = async (limit) => { bumped.clear(); const o = await open(server.url); await o.page.goto(`${server.url}/?limit=${limit}`); await o.page.waitForSelector('li span'); await o.page.waitForTimeout(500); await o.page.evaluate(HELPERS); return o; };
  const wl = (name, limit, f) => repeatSteps(name, async () => { const o = await load(limit); try { return await f(o); } finally { await o.ctx.close(); } });
  for (const [label, limit] of [['200 accounts x 5 orders x 4 items (4,000 lines)', 200], ['1,000 accounts (20,000 lines)', 1000]]) {
    await repeatSteps(`nested: create ${label}`, async () => {
      bumped.clear(); const o = await open(server.url);
      const a = await metricsOf(o.cdp); const t0 = Date.now();
      await o.page.goto(`${server.url}/?limit=${limit}`);
      await o.page.waitForFunction((n) => document.querySelectorAll('li span').length === n, limit * 20, { timeout: 90000 });
      await o.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const ms = Date.now() - t0; const b = await metricsOf(o.cdp);
      await gc(o.cdp); const m = await metricsOf(o.cdp);
      await o.ctx.close();
      return { ms: { ms, script: b.script - a.script, layout: b.layout - a.layout, style: b.style - a.style }, mem: { heapKB: m.heapKB, nodes: m.nodes, nodesPerLine: m.nodes / (limit * 20) } };
    });
  }
  await wl('nested: update one line item (4,000 lines)', 200, async (o) => ({ ms: await step(o.page, o.cdp, () => window.__p.timed(() => document.querySelector('li button').click(), () => document.querySelector('li b').textContent.trim() === '101')) }));
  await server.close();
}

// ---- 3. other pages: examples/admin and the documentation site -----------------------------------------------------------------------
if (only.includes('admin')) {
  const app = join(repo, 'examples/admin');
  await sync(join(app, 'openapi.json'), { out: join(app, '.xoong'), hints: join(app, 'xoong.hints.json') });
  const dist = join(tmp, 'admin'); await build({ root: app, out: dist });
  const backend = await startBackend();
  const server = await serve({ root: dist, csp: CSP, handler: async (req, res, url) => { if (!url.pathname.startsWith('/api/')) return false; const r = await fetch(backend.url + url.pathname.slice(4) + url.search, { method: req.method }); res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'text/plain' }); res.end(Buffer.from(await r.arrayBuffer())); return true; } });
  await repeatSteps('admin: start-up', async () => { const o = await open(server.url); await o.page.goto(server.url + '/'); const s = await startupOf(o.page, o.cdp, o.requests, () => document.querySelector('tbody tr td')?.textContent.trim()); await o.ctx.close(); return { start: s }; });
  await server.close(); await backend.close();
}
if (only.includes('docs')) {
  const site = join(repo, 'site');
  await sync(join(site, 'demo/openapi.json'), { out: join(site, '.xoong'), hints: join(site, 'demo/xoong.hints.json') });
  const dist = join(tmp, 'site'); await build({ root: site, out: dist, include: ['img', 'brand', 'fonts'] });
  const server = await serve({ root: dist, csp: CSP });
  for (const page of ['index', 'cli', 'recipes', 'reference', 'controls-demo']) {
    await repeatSteps(`docs: ${page}.html start-up`, async () => { const o = await open(server.url); await o.page.goto(`${server.url}/${page}.html`); const s = await startupOf(o.page, o.cdp, o.requests, () => document.readyState === 'complete' && document.querySelector('main')); await o.ctx.close(); return { start: s }; });
  }
  await server.close();
}

// ---- bytes of the people screen --------------------------------------------------------------------------------------------------------
if (only.includes('flat')) {
  const sizes = {};
  for (const name of ['dist', 'dist-min']) {
    const rep = JSON.parse(await readFile(join(repo, 'benchmarks/apps/xoong', name, 'build-report.json'), 'utf8'));
    let raw = 0, gz = 0, br = 0;
    for (const f of rep.files.filter((x) => /\.(js|css|html)$/.test(x.path))) { const buf = await readFile(join(repo, 'benchmarks/apps/xoong', name, f.path)); raw += buf.length; gz += gzipSync(buf, { level: 9 }).length; br += brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length; }
    sizes[name] = { files: rep.files.length, raw, gzip: gz, brotli: br };
  }
  results.bytes = sizes;
}
await writeFile(outFile, JSON.stringify(results, null, 1) + '\n');
await browser.close();
log('wrote', outFile);
