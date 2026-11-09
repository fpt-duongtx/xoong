// Runtime benchmark: the same people screen (xoong, React, Vue) in real Chromium, served over HTTP/2 with the same strict CSP,
// measured through the DevTools protocol. Usage: node benchmarks/runtime.mjs [--runs 5] [--only xoong,react] [--out results/runtime.json]
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { serve } from './lib/serve.mjs';
import { launchChromium } from '../tools/browser.mjs';
import { apps, root } from './lib/apps.mjs';
import { summary, round } from './lib/stats.mjs';
import { environment, pinned } from './lib/env.mjs';

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('runs', 5));
const only = arg('only', '')?.split(',').filter(Boolean);
const outFile = arg('out', join(root, 'results/runtime.json'));

// The same Content-Security-Policy for every screen: what `xoong build` prints as the policy its output runs under.
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'";

const VARIANTS = [
  { id: 'xoong', label: 'xoong (xoong build, modulepreload)', app: 'xoong', dist: 'dist', protocol: 'h2' },
  { id: 'xoong-min', label: 'xoong, minified (xoong build --minify)', app: 'xoong', dist: 'dist-min', protocol: 'h2' },
  { id: 'xoong-nopreload', label: 'xoong, no modulepreload', app: 'xoong', dist: 'dist-nopreload', protocol: 'h2' },
  { id: 'xoong-http1', label: 'xoong over HTTP/1.1', app: 'xoong', dist: 'dist', protocol: 'http1' },
  { id: 'react', label: 'React + TanStack + RHF + zod (vite build)', app: 'react', dist: 'dist', protocol: 'h2' },
  { id: 'vue', label: 'Vue + TanStack + vee-validate + zod (vite build)', app: 'vue', dist: 'dist', protocol: 'h2' },
  { id: 'angular', label: 'Angular, signals and reactive forms (ng build)', app: 'angular', dist: 'dist/browser', protocol: 'h2' },
].filter((v) => !only.length || only.includes(v.id));

export const PROFILES = [
  { id: 'local', label: 'Unthrottled (loopback)', cpu: 1, network: null },
  { id: 'mobile', label: '4x CPU slowdown + slow 4G (150 ms RTT, 1.6 Mbit/s down, 0.75 Mbit/s up) during load', cpu: 4, network: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 } },
];

const INIT = () => {
  const m = (window.__m = { fcp: null, lcp: null, long: [], usable: null });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) m.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  // "usable": the first data row is in the DOM and a frame has been drawn after it
  const mo = new MutationObserver(() => {
    if (m.usable === null && document.querySelector('tbody tr td:nth-child(2)')?.textContent.trim()) {
      m.usable = -1; requestAnimationFrame(() => requestAnimationFrame(() => { m.usable = performance.now(); mo.disconnect(); }));
    }
  });
  mo.observe(document, { childList: true, subtree: true, characterData: true });
};

// Helpers injected after load. Every interaction is timed inside the page: from the DOM event to the frame that follows the awaited change.
const HELPERS = () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const until = (fn, timeout = 90000) => new Promise((res, rej) => {
    const t0 = performance.now();
    const check = () => { let ok = false; try { ok = fn(); } catch { /* not yet */ } if (ok) { mo.disconnect(); res(); } else if (performance.now() - t0 > timeout) { mo.disconnect(); rej(new Error('timeout')); } };
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    check();
    setTimeout(function again() { if (performance.now() - t0 < timeout) { check(); setTimeout(again, 50); } }, 50);
  });
  const rows = () => document.querySelectorAll('tbody tr').length;
  const cell = (r, c) => document.querySelectorAll('tbody tr')[r]?.children[c]?.textContent.trim();
  const timed = async (act, done) => { const t0 = performance.now(); act(); await until(done); await frame(); return performance.now() - t0; };
  const setSize = (n) => timed(() => { const s = document.querySelector('nav select'); s.value = String(n); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, () => rows() === n && document.querySelector('nav[aria-label="Pagination"]').textContent.includes(`of 10000`));
  const clickSort = (dir) => timed(() => [...document.querySelectorAll('th button')].find((b) => b.textContent.trim() === 'Name').click(), () => document.querySelector(`th[aria-sort="${dir}"]`) && (dir === 'ascending' ? cell(0, 1).startsWith('Ada Lovelace') : !cell(0, 1).startsWith('Ada Lovelace')));
  const search = (v, n) => timed(() => { const i = document.querySelector('input[type=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); }, () => rows() === n);
  const disableFirst = () => timed(() => document.querySelector('tbody tr button').click(), () => cell(0, 4) === 'disabled');
  window.__b = { setSize, clickSort, search, disableFirst, until, frame, rows };
};

async function heap(cdp) {
  await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (n) => metrics.find((x) => x.name === n).value;
  return { heapKB: get('JSHeapUsedSize') / 1024, nodes: get('Nodes') };
}

const log = (...a) => process.env.BENCH_DEBUG && console.error(...a);
const kind = (type, url) => (type === 'Document' ? 'html' : type === 'Script' ? 'js' : type === 'Stylesheet' ? 'css' : /\/api\//.test(url) ? 'api' : 'other');

async function oneRun(browser, variant, profile, base, server) {
  await server.api.handle({ url: '/__bench/mode', method: 'POST', [Symbol.asyncIterator]: async function* () { yield '{"mode":"normal","rows":10000}'; } }, { writeHead() {}, end() {} });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const violations = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) violations.push(m.text()); });
  page.on('pageerror', (e) => violations.push('pageerror: ' + e.message));
  await page.addInitScript(INIT);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Performance.enable');
  const res = new Map();
  cdp.on('Network.responseReceived', (e) => res.set(e.requestId, { url: e.response.url, type: e.type, status: e.response.status }));
  cdp.on('Network.loadingFinished', (e) => { const r = res.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  if (profile.network) await cdp.send('Network.emulateNetworkConditions', profile.network);
  log('goto');
  await page.goto(base + '/', { waitUntil: 'load', timeout: 120000 });
  log('loaded');
  await page.waitForFunction(() => window.__m.usable > 0, null, { timeout: 120000 });
  await page.waitForTimeout(profile.cpu > 1 ? 1500 : 800); // let LCP settle and the first API response finish
  const m = await page.evaluate(() => window.__m);
  // network back to normal for the interaction phase: the 10,000-row response alone is ~1 MB, which a slow 4G link would turn into a download benchmark
  if (profile.network) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const fcp = m.fcp ?? m.usable;
  const tbt = m.long.filter(([s]) => s >= fcp && s <= m.usable + 50).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
  const bytes = { html: 0, js: 0, css: 0, api: 0, other: 0 };
  const count = { static: 0, api: 0 };
  const loaded = [];
  for (const r of res.values()) {
    if (r.bytes === undefined) continue;
    const k = kind(r.type, r.url);
    bytes[k] += r.bytes; count[k === 'api' ? 'api' : 'static']++;
    if (k !== 'api') loaded.push(new URL(r.url).pathname);
  }
  const out = { fcp: m.fcp, lcp: m.lcp, usable: m.usable, tbt, bytes, count, loaded, csp: violations.length };
  log('helpers');
  await page.evaluate(HELPERS);
  const h0 = await heap(cdp); out.heapLoadKB = h0.heapKB; out.nodesLoad = h0.nodes;
  out.render = {};
  for (const n of [100, 1000, 10000]) {
    log('render', n);
    out.render[n] = await page.evaluate((x) => window.__b.setSize(x), n);
    if (n === 1000) {
      out.sortAsc = await page.evaluate(() => window.__b.clickSort('ascending'));
      out.filter = await page.evaluate(() => window.__b.search('person99', 111));
      await page.evaluate(() => window.__b.search('', 1000));
      out.disable = await page.evaluate(() => window.__b.disableFirst());
    }
    if (n === 10000) { const h = await heap(cdp); out.heap10000KB = h.heapKB; out.nodes10000 = h.nodes; }
    await page.evaluate(() => window.__b.setSize(10));
  }
  out.csp = violations.length;
  await ctx.close();
  return out;
}

const results = { environment: null, runs: RUNS, csp: CSP, profiles: Object.fromEntries(PROFILES.map((p) => [p.id, p.label])), variants: {} };
const browser = await launchChromium();
results.environment = environment({ browser: `Chromium ${browser.version()}` });
const servers = new Map();
for (const v of VARIANTS) {
  const dir = join(apps[v.app].dir, v.dist);
  const key = `${dir}|${v.protocol}`;
  if (!servers.has(key)) servers.set(key, await serve({ root: dir, protocol: v.protocol, csp: CSP }));
  const server = servers.get(key);
  results.variants[v.id] = { label: v.label, protocol: v.protocol, profiles: {} };
  for (const profile of PROFILES) {
    const runs = [];
    await oneRun(browser, v, profile, server.url, server).catch(() => {}); // one warm-up run (JIT of the browser process, the server's compression cache), not counted
    for (let i = 0; i < RUNS; i++) { runs.push(await oneRun(browser, v, profile, server.url, server)); process.stdout.write('.'); }
    const col = (f) => runs.map(f);
    const s = (f, d = 1) => { const x = summary(col(f)); for (const k of ['median', 'min', 'max', 'q1', 'q3']) x[k] = round(x[k], d); x.runs = x.runs.map((r) => round(r, d)); return x; };
    // memory per 1,000 rows: (heap with 10,000 rows drawn - heap with the first 10) / 9.99, after a forced garbage collection
    results.variants[v.id].profiles[profile.id] = {
      fcp: s((r) => r.fcp ?? r.usable), lcp: s((r) => r.lcp ?? r.usable), usable: s((r) => r.usable), tbt: s((r) => r.tbt),
      requests: s((r) => r.count.static, 0),
      bytesJs: s((r) => r.bytes.js, 0), bytesCss: s((r) => r.bytes.css, 0), bytesHtml: s((r) => r.bytes.html, 0),
      heapLoadKB: s((r) => r.heapLoadKB, 0), render100: s((r) => r.render[100]), render1000: s((r) => r.render[1000]), render10000: s((r) => r.render[10000]),
      sort1000: s((r) => r.sortAsc), filter1000: s((r) => r.filter), update1000: s((r) => r.disable),
      memPer1000Rows: s((r) => (r.heap10000KB - r.heapLoadKB) / 9.99, 0), domNodes10000: s((r) => r.nodes10000, 0),
      cspViolations: Math.max(...runs.map((r) => r.csp)),
    };
    results.variants[v.id].loaded ??= runs[0].loaded;
    console.log(`\n${v.id} / ${profile.id}: usable ${results.variants[v.id].profiles[profile.id].usable.median} ms, 10k rows ${results.variants[v.id].profiles[profile.id].render10000.median} ms`);
  }
}
// bytes of what the page loaded (decoded, gzip -9, brotli -11), computed from the built files so anyone can recompute them
for (const v of VARIANTS) {
  const dir = join(apps[v.app].dir, v.dist);
  const t = { js: [0, 0, 0], css: [0, 0, 0], html: [0, 0, 0] };
  for (const p of results.variants[v.id].loaded) {
    const ext = p.endsWith('.js') ? 'js' : p.endsWith('.css') ? 'css' : p.endsWith('/') || p.endsWith('.html') ? 'html' : null;
    if (!ext) continue;
    const buf = await readFile(join(dir, p.endsWith('/') ? p + 'index.html' : p));
    t[ext][0] += buf.length; t[ext][1] += gzipSync(buf, { level: 9 }).length; t[ext][2] += brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
  }
  results.variants[v.id].sizes = Object.fromEntries(Object.entries(t).map(([k, [raw, gz, br]]) => [k, { raw, gzip: gz, brotli: br }]));
  delete results.variants[v.id].loaded;
}
results.versions = { react: pinned(apps.react.dir), vue: pinned(apps.vue.dir), angular: pinned(apps.angular.dir) };
await writeFile(outFile, JSON.stringify(results, null, 1) + '\n');
await browser.close();
for (const s of servers.values()) await s.close();
console.log('\nwrote', outFile);
