// A dissection of where xoong's bytes and time go (benchmarks/perf/PROFILE.md and results/profile.json). Nothing is tuned: the plain screens, as a user writes them.
//   node benchmarks/perf/profile.mjs [--out ../results/profile.json]
// Passes (each on a fresh page, so one instrument does not distort another): bytes of the built files; JS coverage with call counts (precise coverage);
// a sampling CPU profile; a sampling heap profile (allocations); a Chromium trace (layout, style, paint, GC, compile); the load waterfall and start-up milestones;
// effect runs and DOM changes per update path.
import { writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { build, CSP } from '../../packages/cli/src/build.js';
import { sync } from '../../packages/cli/src/commands.js';
import { serve } from '../lib/serve.mjs';
import { launchChromium } from '../../tools/browser.mjs';
import { startBackend } from '../../examples/admin/backend.mjs';
import { environment } from '../lib/env.mjs';
import { mode } from '../lib/acceptance.mjs';

const repo = new URL('../..', import.meta.url).pathname;
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : join(repo, 'benchmarks/results/profile.json');
const tmp = await mkdtemp(join(tmpdir(), 'xoong-profile-'));
const browser = await launchChromium();
const R = { environment: environment({ browser: `Chromium ${browser.version()}` }), bytes: {}, coverage: {}, cpu: {}, calls: {}, alloc: {}, trace: {}, load: {}, init: {}, updates: {} };
const pkgOf = (url) => { const m = /\/@xoong\/([^/]+)\//.exec(url); return m ? `@xoong/${m[1]}` : /^https?:\/\/[^/]+\/?$/.test(url) ? 'page' : /\.(js|ts)$/.test(url) ? 'page code' : url ? 'other' : '(native)'; };
const kb = (x) => Math.round(x / 102.4) / 10;

// ---- workloads: how to open, what to do --------------------------------------------------------------------------------------------------
const flat = { name: 'flat', root: join(repo, 'benchmarks/apps/xoong/dist'), rows: 10000, ready: () => document.querySelector('tbody tr td:nth-child(2)')?.textContent.trim(),
  scenarios: { 'create 1,000 rows': (p) => p.evaluate(() => window.__p.setSize(1000)), 'create 10,000 rows': (p) => p.evaluate(() => window.__p.setSize(10000)) } };
const nestedApp = join(repo, 'benchmarks/perf/nested');
await sync(join(nestedApp, 'openapi.json'), { out: join(nestedApp, '.xoong'), hints: join(nestedApp, 'xoong.hints.json') });
const nestedDist = join(tmp, 'nested'); await build({ root: nestedApp, out: nestedDist });
const nestedData = (n) => Array.from({ length: n }, (_, a) => ({ id: a + 1, name: `Account ${a + 1}`, orders: Array.from({ length: 5 }, (_, o) => ({ id: (a + 1) * 10 + o, status: o === 3 ? 'overdue' : 'paid', items: Array.from({ length: 4 }, (_, i) => ({ id: ((a + 1) * 10 + o) * 10 + i, sku: `SKU-${a}-${o}-${i}`, qty: 1 + i })) })) }));
const nestedHandler = (req, res, url) => { if (url.pathname === '/api/accounts') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ items: nestedData(Number(url.searchParams.get('limit') ?? 200)) })); return true; } return false; };
const nested = { name: 'nested 200x5x4', root: nestedDist, handler: nestedHandler, query: '?limit=200', ready: () => document.querySelectorAll('li span').length === 4000 };
const adminApp = join(repo, 'examples/admin');
await sync(join(adminApp, 'openapi.json'), { out: join(adminApp, '.xoong'), hints: join(adminApp, 'xoong.hints.json') });
const adminDist = join(tmp, 'admin'); await build({ root: adminApp, out: adminDist });
const backend = await startBackend();
const adminHandler = async (req, res, url) => { if (!url.pathname.startsWith('/api/')) return false; const r = await fetch(backend.url + url.pathname.slice(4) + url.search, { method: req.method }); res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'text/plain' }); res.end(Buffer.from(await r.arrayBuffer())); return true; };
const admin = { name: 'examples/admin', root: adminDist, handler: adminHandler, ready: () => document.querySelector('tbody tr td')?.textContent.trim() };
const siteDir = join(repo, 'site');
await sync(join(siteDir, 'demo/openapi.json'), { out: join(siteDir, '.xoong'), hints: join(siteDir, 'demo/xoong.hints.json') });
const siteDist = join(tmp, 'site'); await build({ root: siteDir, out: siteDist, include: ['img', 'brand', 'fonts'] });
const docs = { name: 'docs: reference.html', root: siteDist, page: 'reference.html', ready: () => document.readyState === 'complete' && document.querySelector('main') };
const WORKLOADS = [flat, nested, admin, docs];

const HELPERS = () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const until = (fn) => new Promise((res) => { const check = () => { let ok = false; try { ok = fn(); } catch { /* not yet */ } if (ok) res(); else setTimeout(check, 10); }; check(); });
  window.__p = {
    setSize: async (n) => { const t0 = performance.now(); const s = document.querySelector('nav select'); s.value = String(n); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); await until(() => document.querySelectorAll('tbody tr').length === n); await frame(); return performance.now() - t0; },
    click: async (sel, done) => { const t0 = performance.now(); document.querySelector(sel).click(); await until(done); await frame(); return performance.now() - t0; },
    type: async (v, n) => { const t0 = performance.now(); const i = document.querySelector('input[type=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); await until(() => document.querySelectorAll('tbody tr').length === n); await frame(); return performance.now() - t0; },
  };
};

const INIT = () => { // timestamps of the runtime's start: custom element definitions and the first request
  const t = (window.__init = { defines: [], firstFetch: null, firstRow: null });
  const define = customElements.define.bind(customElements);
  customElements.define = (name, ctor, o) => { const t0 = performance.now(); define(name, ctor, o); t.defines.push([name, t0, performance.now() - t0]); };
  const f = window.fetch.bind(window); window.fetch = (...a) => { t.firstFetch ??= performance.now(); return f(...a); };
  new MutationObserver(() => { if (t.firstRow === null && document.querySelector('tbody tr td, li span')) t.firstRow = performance.now(); }).observe(document, { childList: true, subtree: true });
};

async function openPage(w, { network = null, cpu = 1, protocol = 'http1', root, init = false } = {}) {
  const server = await serve({ root: root ?? w.root, rows: w.rows ?? 1000, csp: CSP, handler: w.handler, protocol });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (init) await page.addInitScript(INIT);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (network) await cdp.send('Network.enable').then(() => cdp.send('Network.emulateNetworkConditions', network));
  const go = async () => { if (w.rows) await mode(page, server.url, 'normal', w.rows); await page.goto(`${server.url}/${w.page ?? ''}${w.query ?? ''}`); await page.waitForFunction(w.ready, null, { timeout: 90000 }); await page.waitForTimeout(300); if (w.scenarios === flat.scenarios) await page.evaluate(HELPERS); };
  return { server, ctx, page, cdp, go, close: async () => { await ctx.close(); await server.close(); } };
}
const gc = async (cdp) => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); };

// ---- 1. bytes -----------------------------------------------------------------------------------------------------------------------
async function bytes() {
  const { readdir, stat } = await import('node:fs/promises');
  for (const w of WORKLOADS) {
    const files = []; const walk = async (d) => { for (const n of await readdir(d)) { const p = join(d, n); if ((await stat(p)).isDirectory()) await walk(p); else if (/\.(js|css|html)$/.test(n)) files.push(p); } };
    await walk(w.root);
    const rows = []; for (const f of files) { const b = await readFile(f); const url = f.slice(w.root.length); rows.push({ url, raw: b.length, gzip: gzipSync(b, { level: 9 }).length, brotli: brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length }); }
    const byPkg = {}; for (const r of rows) { const k = pkgOf(r.url) === 'page' ? 'page' : r.url.endsWith('.css') ? `${pkgOf(r.url)} css` : pkgOf(r.url); (byPkg[k] ??= { raw: 0, gzip: 0, brotli: 0, files: 0 }); for (const m of ['raw', 'gzip', 'brotli']) byPkg[k][m] += r[m]; byPkg[k].files++; }
    R.bytes[w.name] = { files: rows.sort((a, b) => b.raw - a.raw).slice(0, 25), byPackage: byPkg, total: Object.values(byPkg).reduce((t, p) => ({ raw: t.raw + p.raw, gzip: t.gzip + p.gzip, brotli: t.brotli + p.brotli }), { raw: 0, gzip: 0, brotli: 0 }), fileCount: rows.length };
  }
}

// ---- 2. coverage and call counts (precise coverage) -------------------------------------------------------------------------------------
async function coverage(w, scenarioName) {
  const o = await openPage(w); const { cdp, page } = o;
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  await o.go();
  let rowsMade = 0;
  if (scenarioName) { await w.scenarios[scenarioName](page); rowsMade = Number(/[\d,]+/.exec(scenarioName)[0].replace(',', '')); }
  const { result } = await cdp.send('Profiler.takePreciseCoverage');
  const files = []; const funcs = [];
  for (const s of result) {
    if (!s.url.startsWith(o.server.url) || !/\.js$/.test(s.url)) continue;
    const path = new URL(s.url).pathname; const src = (await readFile(join(w.root, path), 'utf8').catch(() => ''));
    const used = new Uint8Array(src.length);
    for (const f of s.functions) for (const r of f.ranges) used.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset);
    let unused = 0; for (const u of used) if (!u) unused++;
    files.push({ url: path, pkg: pkgOf(path), bytes: src.length, unused });
    for (const f of s.functions) { const r = f.ranges[0]; funcs.push({ fn: f.functionName || '(anonymous)', url: path, pkg: pkgOf(path), size: r.endOffset - r.startOffset, calls: r.count }); }
  }
  await o.close();
  const total = files.reduce((t, f) => t + f.bytes, 0), unusedAll = files.reduce((t, f) => t + f.unused, 0);
  const byPkg = {}; for (const f of files) { (byPkg[f.pkg] ??= { bytes: 0, unused: 0 }); byPkg[f.pkg].bytes += f.bytes; byPkg[f.pkg].unused += f.unused; }
  const key = `${w.name}${scenarioName ? ': ' + scenarioName : ''}`;
  R.coverage[key] = { totalBytes: total, unusedBytes: unusedAll, unusedShare: unusedAll / total, byPackage: byPkg, worstFiles: files.sort((a, b) => b.unused - a.unused).slice(0, 12), neverCalledBiggestFunctions: funcs.filter((f) => f.calls === 0).sort((a, b) => b.size - a.size).slice(0, 15) };
  if (rowsMade) {
    const hot = funcs.filter((f) => f.calls > 0).map((f) => ({ ...f, perRow: f.calls / rowsMade })).sort((a, b) => b.calls - a.calls).slice(0, 30);
    R.calls[key] = { rows: rowsMade, topByCalls: hot };
  }
}

// ---- 3. CPU profile (sampling), aggregated by function and by package -------------------------------------------------------------------
async function cpuProfile(w, scenarioName) {
  const o = await openPage(w); const { cdp, page } = o;
  await o.go();
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  const ms = scenarioName ? await w.scenarios[scenarioName](page) : 0;
  const { profile } = await cdp.send('Profiler.stop');
  await o.close();
  const byId = new Map(profile.nodes.map((n) => [n.id, n])); const self = new Map(); const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const selfOf = new Map(); const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => selfOf.set(id, (selfOf.get(id) ?? 0) + dt[i] / 1000));
  const fnSelf = new Map(), fnTotal = new Map(), pkgSelf = new Map(); let total = 0;
  const label = (n) => `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url ? new URL(n.callFrame.url).pathname.split('/').slice(-2).join('/') + ':' + n.callFrame.lineNumber : ''}`.trim();
  for (const [id, t] of selfOf) {
    const n = byId.get(id); total += t;
    fnSelf.set(label(n), (fnSelf.get(label(n)) ?? 0) + t);
    const pk = n.callFrame.url ? pkgOf(new URL(n.callFrame.url).pathname) : '(native / GC / idle)'; pkgSelf.set(pk, (pkgSelf.get(pk) ?? 0) + t);
    const seen = new Set(); for (let c = id; c; c = parent.get(c)) { const l = label(byId.get(c)); if (!seen.has(l)) { seen.add(l); fnTotal.set(l, (fnTotal.get(l) ?? 0) + t); } }
  }
  const rank = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([fn, t]) => ({ fn, ms: Math.round(t * 10) / 10, pct: Math.round((t / total) * 1000) / 10 }));
  R.cpu[`${w.name}${scenarioName ? ': ' + scenarioName : ''}`] = { measuredMs: Math.round(ms), sampledMs: Math.round(total), topSelf: rank(fnSelf, 30), topTotal: rank(fnTotal, 15), byPackage: Object.fromEntries(rank(pkgSelf, 10).map((r) => [r.fn, { ms: r.ms, pct: r.pct }])) };
}

// ---- 4. allocations (sampling heap profile) --------------------------------------------------------------------------------------------
async function allocations(w, scenarioName) {
  const o = await openPage(w); const { cdp, page } = o;
  await o.go(); await gc(cdp);
  await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  await w.scenarios[scenarioName](page);
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  await o.close();
  const rows = Number(/[\d,]+/.exec(scenarioName)[0].replace(',', ''));
  const by = new Map(); let total = 0;
  const walk = (n) => { const l = `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url ? new URL(n.callFrame.url).pathname.split('/').slice(-2).join('/') + ':' + n.callFrame.lineNumber : '(native)'}`; by.set(l, (by.get(l) ?? 0) + n.selfSize); total += n.selfSize; for (const c of n.children) walk(c); };
  walk(profile.head);
  R.alloc[`${w.name}: ${scenarioName}`] = { rows, totalKB: Math.round(total / 1024), bytesPerRow: Math.round(total / rows), top: [...by].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([fn, b]) => ({ fn, kb: Math.round(b / 102.4) / 10, bytesPerRow: Math.round(b / rows), pct: Math.round((b / total) * 1000) / 10 })) };
}

// ---- 5. trace: layout, style, paint, GC, compile -------------------------------------------------------------------------------------
async function trace(w, scenarioName, { angular = false } = {}) {
  const root = angular ? join(repo, 'benchmarks/apps/angular/dist/browser') : undefined;
  const o = await openPage(w, { root }); const { cdp, page } = o;
  await o.go();
  const events = []; cdp.on('Tracing.dataCollected', (e) => events.push(...e.value));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.compile', transferMode: 'ReportEvents' });
  const ms = await w.scenarios[scenarioName](page);
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done;
  await o.close();
  const tot = {}; for (const e of events) if (e.ph === 'X' && e.dur) tot[e.name] = (tot[e.name] ?? 0) + e.dur / 1000;
  const pick = (names) => Math.round(names.reduce((t, n) => t + (tot[n] ?? 0), 0));
  const gcMain = Object.entries(tot).filter(([k]) => /^V8\.GC_(SCAVENGER|MC_INCREMENTAL|MC_FINALIZE|MC_MARK|MC_SWEEP)$|^MinorGC$|^MajorGC$/.test(k)).reduce((t, [, v]) => t + v, 0);
  R.trace[`${angular ? 'Angular (context)' : 'xoong'}: ${scenarioName}`] = { measuredMs: Math.round(ms), layoutMs: pick(['Layout']), styleMs: pick(['UpdateLayoutTree']), prePaintMs: pick(['PrePaint']), paintMs: pick(['Paint']), jsMicrotasksMs: pick(['RunMicrotasks']), jsFunctionCallMs: pick(['FunctionCall', 'TimerFire']), gcMainThreadMs: Math.round(gcMain), gcBackgroundMarkingMs: pick(['V8.GC_MC_BACKGROUND_MARKING']), compileMs: pick(['V8.CompileCode', 'v8.compile', 'V8.CompileFullCode', 'V8.CompileLazy', 'V8.ParseFunction']) };
}

// ---- 6. load waterfall and start-up milestones ---------------------------------------------------------------------------------------
const SLOW = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
async function load(w, label, opts) {
  const o = await openPage(w, { ...opts, init: true }); const { page } = o;
  await o.go();
  const d = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource').filter((r) => !/\/api\//.test(r.name));
    const lastModule = Math.max(...res.filter((r) => /\.js/.test(r.name)).map((r) => r.responseEnd));
    return { ttfb: nav.responseStart, requests: res.length, bytes: Math.round(res.reduce((t, r) => t + (r.encodedBodySize || 0), 0)), jsRequests: res.filter((r) => /\.js/.test(r.name)).length, graphReady: lastModule, firstFetch: window.__init.firstFetch, firstRow: window.__init.firstRow, definitions: window.__init.defines.length, definitionsMs: Math.round(window.__init.defines.reduce((t, x) => t + x[2], 0) * 10) / 10, firstDefine: window.__init.defines[0]?.[1] ?? null, lastDefine: window.__init.defines.at(-1)?.[1] ?? null, slowest: [...res].sort((a, b) => b.responseEnd - a.responseEnd).slice(0, 3).map((r) => [new URL(r.name).pathname.split('/').slice(-2).join('/'), Math.round(r.startTime), Math.round(r.responseEnd)]), defines: window.__init.defines.map((x) => [x[0], Math.round(x[2] * 100) / 100]).sort((a, b) => b[1] - a[1]).slice(0, 6) };
  });
  await o.close();
  R.load[label] = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 10) / 10 : v]));
}

// ---- 7. update paths: effect runs by source, DOM changes, time ----------------------------------------------------------------------
async function updates() {
  const counter = (path, body) => (path.endsWith('/@xoong/core/src/signals.js') ? Buffer.from(body.toString().replace('  run() {\n    if (this.disposed) return;\n    this.cleanup?.();', "  run() {\n    if (this.disposed) return;\n    { const k = this.fn.toString().replace(/\\s+/g, ' ').slice(0, 90); (globalThis.__fx ??= {})[k] = (globalThis.__fx[k] || 0) + 1; }\n    this.cleanup?.();")) : body);
  const server = await serve({ root: flat.root, rows: 10000, csp: CSP, transform: counter });
  const paths = { 'change one field (disable one row)': ['() => window.__p.click("tbody tr button", () => document.querySelector("tbody tr td:nth-child(5)").textContent.trim() === "disabled")'], 'sort by name': ['() => window.__p.click("th button:not([hidden])", () => document.querySelector("th[aria-sort]"))'], 'filter (search 11 of 1,000)': ['() => window.__p.type("person99", 111)'], 'tick one row': ['() => window.__p.click("tbody input[type=checkbox]", () => document.querySelectorAll("tbody input:checked").length === 1)'] };
  for (const [name, [fn]] of Object.entries(paths)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await mode(page, server.url, 'normal', 10000); await page.goto(server.url); await page.waitForSelector('tbody tr td'); await page.evaluate(HELPERS);
    await page.evaluate(() => window.__p.setSize(1000)); await page.waitForTimeout(500);
    await page.evaluate(() => { globalThis.__fx = {}; window.__rec = []; window.__mo = new MutationObserver((r) => window.__rec.push(...r)); window.__mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true }); });
    const m0 = (await cdp.send('Performance.getMetrics')).metrics; const g = (m, n) => m.find((x) => x.name === n)?.value ?? 0;
    const ms = await page.evaluate(`(${fn})()`); await page.waitForTimeout(400);
    const m1 = (await cdp.send('Performance.getMetrics')).metrics;
    const d = await page.evaluate(() => { const r = [...window.__rec, ...window.__mo.takeRecords()]; let added = 0, removed = 0, attrs = 0, text = 0; for (const x of r) { if (x.type === 'childList') { added += x.addedNodes.length; removed += x.removedNodes.length; } else if (x.type === 'attributes') attrs++; else text++; } return { fx: globalThis.__fx, added, removed, attrs, text }; });
    const runs = Object.entries(d.fx).sort((a, b) => b[1] - a[1]); const totalRuns = runs.reduce((t, [, v]) => t + v, 0);
    R.updates[name] = { ms: Math.round(ms * 10) / 10, layoutMs: Math.round((g(m1, 'LayoutDuration') - g(m0, 'LayoutDuration')) * 10000) / 10, styleMs: Math.round((g(m1, 'RecalcStyleDuration') - g(m0, 'RecalcStyleDuration')) * 10000) / 10, effectRuns: totalRuns, effectRunsBySource: runs.slice(0, 6), nodesAdded: d.added, nodesRemoved: d.removed, attributeWrites: d.attrs, textWrites: d.text };
    await ctx.close();
  }
  await server.close();
}

// ---- run ------------------------------------------------------------------------------------------------------------------------------
const step = async (label, f) => { process.stdout.write(label + ' ... '); const t = Date.now(); await f(); console.log(`${Date.now() - t} ms`); };
await step('bytes', bytes);
for (const sc of Object.keys(flat.scenarios)) {
  await step(`coverage + calls ${sc}`, () => coverage(flat, sc));
  await step(`cpu ${sc}`, () => cpuProfile(flat, sc));
  await step(`allocations ${sc}`, () => allocations(flat, sc));
  await step(`trace ${sc}`, () => trace(flat, sc));
}
for (const w of [nested, admin, docs]) { await step(`coverage ${w.name}`, () => coverage(w)); }
nested.scenarios = { 'create 4,000 lines': async (p) => p.evaluate(() => 0) };
await step('cpu nested load', async () => {
  const o = await openPage(nested); const { cdp, page } = o;
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  const t0 = Date.now(); await o.go(); const ms = Date.now() - t0;
  const { profile } = await cdp.send('Profiler.stop'); await o.close();
  const byId = new Map(profile.nodes.map((n) => [n.id, n])); const selfOf = new Map(); profile.samples.forEach((id, i) => selfOf.set(id, (selfOf.get(id) ?? 0) + profile.timeDeltas[i] / 1000));
  const fn = new Map(); let total = 0; for (const [id, t] of selfOf) { const n = byId.get(id); total += t; const l = `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url ? new URL(n.callFrame.url).pathname.split('/').slice(-2).join('/') + ':' + n.callFrame.lineNumber : ''}`.trim(); fn.set(l, (fn.get(l) ?? 0) + t); }
  R.cpu['nested 200x5x4: load and render'] = { measuredMs: ms, sampledMs: Math.round(total), topSelf: [...fn].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([f, t]) => ({ fn: f, ms: Math.round(t * 10) / 10, pct: Math.round((t / total) * 1000) / 10 })) };
});
await step('trace angular create 10,000 (context)', () => trace({ ...flat, root: join(repo, 'benchmarks/apps/angular/dist/browser') }, 'create 10,000 rows', { angular: true }));
for (const [label, w, opts] of [['flat, h1, no throttle', flat, {}], ['flat, h2, slow 4G', flat, { protocol: 'h2', network: SLOW }], ['flat, h1, slow 4G', flat, { protocol: 'http1', network: SLOW }], ['flat no modulepreload, h2, slow 4G', flat, { protocol: 'h2', network: SLOW, root: join(repo, 'benchmarks/apps/xoong/dist-nopreload') }], ['flat minified, h2, slow 4G', flat, { protocol: 'h2', network: SLOW, root: join(repo, 'benchmarks/apps/xoong/dist-min') }], ['nested, h2, slow 4G', nested, { protocol: 'h2', network: SLOW }], ['examples/admin, h2, slow 4G', admin, { protocol: 'h2', network: SLOW }], ['docs reference.html, h2, slow 4G', docs, { protocol: 'h2', network: SLOW }]]) await step(`load ${label}`, () => load(w, label, opts));
await step('update paths', updates);
await backend.close();
await browser.close();
await writeFile(out, JSON.stringify(R, null, 1) + '\n');
console.log('wrote', out);
