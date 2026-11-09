// `xoong build` output, served with a strict Content-Security-Policy (no unsafe-eval, no unsafe-inline), in real Chromium:
// the admin example must work and the browser must report zero violations.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { readFile, readdir, stat, mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { Readable } from 'node:stream';
import { build, CSP } from '../src/build.js';
import { sync } from '../src/commands.js';
import { launchChromium } from '../../../tools/browser.mjs';
import { startBackend } from '../../../examples/admin/backend.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
const example = join(repo, 'examples/admin');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/** Static files from `dir`, `/api/*` forwarded to the backend, every response carrying the policy. */
function host(dir, backend) {
  return createServer(async (req, res) => {
    res.setHeader('content-security-policy', CSP);
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      const upstream = await fetch(backend + url.pathname.slice(4) + url.search, { method: req.method, headers: { 'content-type': req.headers['content-type'] ?? 'application/json' }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((r) => { let t = ''; req.on('data', (c) => { t += c; }); req.on('end', () => r(t)); }) }).catch(() => null);
      if (!upstream) { res.writeHead(502); return res.end(); }
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'text/plain', 'cache-control': 'no-cache' });
      if (upstream.body) Readable.fromWeb(upstream.body).pipe(res); else res.end();
      req.on('close', () => res.destroy());
      return;
    }
    let file = join(dir, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!(await stat(file).then((s) => s.isFile(), () => false))) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  });
}

const files = async (dir, base = dir) => (await Promise.all((await readdir(dir)).map(async (n) => { const p = join(dir, n); return (await stat(p)).isDirectory() ? files(p, base) : [p.slice(base.length)]; }))).flat();

describe('xoong build', () => {
  let out, backend, server, base, browser, page;
  const violations = [];
  const errors = [];

  beforeAll(async () => {
    await sync(join(example, 'openapi.json'), { out: join(example, '.xoong'), hints: join(example, 'xoong.hints.json') });
    out = await mkdtemp(join(tmpdir(), 'xoong-build-'));
    var result = await build({ root: example, out });
    expect(result.warnings).toEqual([]);
    backend = await startBackend();
    server = host(out, backend.url);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    browser = await launchChromium();
    page = await (await browser.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
    await page.addInitScript(() => {
      window.__violations = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`));
    });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/status of 422/.test(m.text())) errors.push(m.text()); });
    await page.goto(base);
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    void violations;
  }, 60000);

  afterAll(async () => { await browser?.close(); await new Promise((r) => server?.close(r)); await backend?.close(); });

  it('writes static files: no import map, no bare imports, TypeScript turned into JavaScript, packages under the URLs the dev server uses', async () => {
    const all = await files(out);
    expect(all).toEqual(expect.arrayContaining(['/index.html', '/src/main.js', '/@xoong/core/src/index.js', '/@xoong/data/src/view.js', '/@xoong/forms/src/form-dom.js', '/@xoong/ui/src/xoong.css', '/.xoong/operations.json', '/build-report.json']));
    expect(all.some((f) => f.endsWith('.ts'))).toBe(false);
    const html = await readFile(join(out, 'index.html'), 'utf8');
    expect(html).not.toMatch(/importmap/);
    expect(html).toContain('src="/src/main.js"');
    for (const f of all.filter((f) => f.endsWith('.js'))) {
      const code = await readFile(join(out, f), 'utf8');
      expect(code, f).not.toMatch(/\b(?:from|import)\s*\(?\s*['"](?:@xoong|xoong)[/'"]/); // every package import is a URL now
      expect(code, f).not.toMatch(/\.m?ts['"]/);
    }
    const report = JSON.parse(await readFile(join(out, 'build-report.json'), 'utf8'));
    expect(report.csp).toBe(CSP);
    expect(report.files.every((f) => f.gzip > 0)).toBe(true);
  });

  it('the app runs under the policy: data renders, styles apply, actions work, no violation of any kind', async () => {
    expect(await page.$$eval('tbody tr', (r) => r.length)).toBe(2);
    expect(await page.$eval('body', (b) => getComputedStyle(b).display)).toBe('grid'); // xoong.css (an external file) applied
    await page.click('tbody tr:nth-child(1) button:text("Disable")');
    await page.waitForFunction(() => document.querySelector('tbody tr').children[3].textContent.trim() === 'disabled', null, { timeout: 5000 });
    await page.click('button:text("Add a person")');
    expect(await page.$eval('dialog', (d) => d.open)).toBe(true);
    await page.fill('dialog input[name=name]', 'Dana Scott');
    await page.fill('dialog input[name=email]', 'dana@example.com');
    await page.selectOption('dialog select[name=role]', 'member');
    await page.click('dialog form button');
    await page.waitForFunction(() => !document.querySelector('dialog').open, null, { timeout: 5000 });
    expect(await page.evaluate(() => window.__violations)).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('the policy is really enforced in this setup (an inline script is blocked)', async () => {
    const blocked = await page.evaluate(() => new Promise((resolve) => {
      const s = document.createElement('script');
      s.textContent = 'window.__inline = true';
      document.body.append(s);
      setTimeout(() => resolve({ ran: window.__inline === true, violations: window.__violations.length }), 50);
    }));
    expect(blocked.ran).toBe(false);
    expect(blocked.violations).toBeGreaterThan(0);
  });
});

describe('xoong build: options and warnings', () => {
  it('warns about what a strict policy blocks (inline script, style attribute, inline style), and about unresolved imports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-build-warn-'));
    await writeFile(join(root, 'index.html'), '<!doctype html><html><head><style>p{}</style><script type="module" src="/a.js"></script></head><body style="margin:0"><script>alert(1)</script></body></html>');
    await writeFile(join(root, 'a.js'), "import 'lodash'; import './b.js';");
    await writeFile(join(root, 'b.js'), 'export const b = 1;');
    const r = await build({ root, out: join(root, 'dist') });
    const text = r.warnings.join('\n');
    expect(text).toMatch(/inline <style> is blocked/);
    expect(text).toMatch(/style="" attribute is blocked/);
    expect(text).toMatch(/inline <script> is blocked/);
    expect(text).toMatch(/cannot resolve "lodash"/);
    expect((await files(join(root, 'dist'))).sort()).toEqual(['/a.js', '/b.js', '/build-report.json', '/index.html']);
  });

  it('--base prefixes URLs; --include adds files the build cannot see; TypeScript is stripped; relative imports and CSS urls are followed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-build-base-'));
    await mkdir(join(root, 'src'));
    await mkdir(join(root, 'data'));
    await writeFile(join(root, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="/src/a.css"><script type="module" src="./src/main.ts"></script></head><body><a href="/other">x</a></body></html>');
    await writeFile(join(root, 'src/main.ts'), "import { n } from './lib.ts';\nconst x: number = n;\nexport { x };\nimport('./lazy.ts');");
    await writeFile(join(root, 'src/lib.ts'), 'export const n: number = 1;');
    await writeFile(join(root, 'src/lazy.ts'), 'export default 1;');
    await writeFile(join(root, 'src/a.css'), "body { background: url('/src/bg.png'); }");
    await writeFile(join(root, 'src/bg.png'), 'png');
    await writeFile(join(root, 'data/list.json'), '[]');
    const r = await build({ root, out: join(root, 'dist'), base: '/admin/', include: ['data'] });
    expect(r.warnings).toEqual([]);
    expect((await files(join(root, 'dist'))).sort()).toEqual(['/build-report.json', '/data/list.json', '/index.html', '/src/a.css', '/src/bg.png', '/src/lazy.js', '/src/lib.js', '/src/main.js']);
    const html = await readFile(join(root, 'dist/index.html'), 'utf8');
    expect(html).toContain('href="/admin/src/a.css"');
    expect(html).toContain('src="/admin/src/main.js"');
    expect(html).toContain('href="/other"'); // a link to a route is not a file: untouched
    const main = await readFile(join(root, 'dist/src/main.js'), 'utf8');
    expect(main).toContain("from '/admin/src/lib.js'");
    expect(main).toContain("import('/admin/src/lazy.js')");
    expect(main).not.toMatch(/: number/);
    expect(await readFile(join(root, 'dist/src/a.css'), 'utf8')).toContain("url('/admin/src/bg.png')");
  });

  it('refuses a folder with no page', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-build-empty-'));
    await expect(build({ root, out: join(root, 'dist') })).rejects.toThrow(/no \.html page/);
  });
});

describe('xoong build --minify', () => {
  const project = async (extra = {}) => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-min-'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>t</title><link rel="stylesheet" href="/app.css"><script type="module" src="/main.js"></script><p id="p">x</p>');
    await writeFile(join(dir, 'main.js'), 'import { greet } from "./lib.js";\n// a comment that costs bytes\nconst message   =   greet( "hello" );\ndocument.getElementById("p").textContent = message;\n');
    await writeFile(join(dir, 'lib.js'), 'export function greet(  value  ) {\n  /* spaces and comments */\n  return value + "!";\n}\n');
    await writeFile(join(dir, 'app.css'), '/* comment */\np {\n  color :  red ;\n}\n');
    for (const [name, text] of Object.entries(extra)) { await mkdir(join(dir, 'node_modules', name), { recursive: true }); await writeFile(join(dir, 'node_modules', name, 'package.json'), JSON.stringify({ name, main: 'index.js' })); await writeFile(join(dir, 'node_modules', name, 'index.js'), text); }
    return dir;
  };
  const outside = async (name) => join(await mkdtemp(join(tmpdir(), 'xoong-minout-')), name); // outputs next to the project, not inside it (a folder inside the root is searched for pages)
  // a stand-in for esbuild: the build only needs `transform(code, options)` to return `{ code }`
  const stub = 'exports.transform = async (code, o) => ({ code: "/*min:" + o.loader + (o.minify ? ":minify" : "") + "*/" + code.replace(/\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$/gm, "").replace(/\\s+/g, " ") });';

  it('uses the esbuild the project has installed for scripts and stylesheets, and rewrites imports as usual', async () => {
    const dir = await project({ esbuild: stub });
    const plainOut = await outside('plain'), minOut = await outside('min');
    const plain = await build({ root: dir, out: plainOut });
    const min = await build({ root: dir, out: minOut, minify: true });
    expect(min.minified).toBe(true);
    const js = await readFile(join(minOut, 'main.js'), 'utf8');
    expect(js.startsWith('/*min:js:minify*/')).toBe(true);
    expect(js).toContain('"/lib.js"'); // the import is still rewritten to a root URL
    expect((await readFile(join(minOut, 'app.css'), 'utf8')).startsWith('/*min:css:minify*/')).toBe(true);
    expect(min.files.reduce((n, f) => n + f.bytes, 0)).toBeLessThan(plain.files.reduce((n, f) => n + f.bytes, 0));
    expect(await readFile(join(minOut, 'index.html'), 'utf8')).toContain('modulepreload'); // the pages are as before
  });

  it('is on by default only when asked: not by default, and "build": { "minify": true } in xoong.config.json asks', async () => {
    const dir = await project({ esbuild: stub });
    expect((await build({ root: dir, out: await outside('a') })).minified).toBe(false);
    await writeFile(join(dir, 'xoong.config.json'), JSON.stringify({ build: { minify: true } }));
    expect((await build({ root: dir, out: await outside('b') })).minified).toBe(true);
    expect((await build({ root: dir, out: await outside('c'), minify: false })).minified).toBe(false);
  });

  it('without esbuild in the project it warns and writes the files as they are (no failure)', async () => {
    const dir = await project();
    const out = await outside('out');
    const r = await build({ root: dir, out, minify: true });
    expect(r.minified).toBe(false);
    expect(r.warnings.join('\n')).toMatch(/--minify: esbuild is not installed/);
    expect(await readFile(join(out, 'main.js'), 'utf8')).toContain('// a comment that costs bytes');
  });
});

describe('xoong build --minify with the real esbuild (when the project has it)', () => {
  const esbuildHere = existsSync(join(repo, 'benchmarks/apps/xoong/node_modules/esbuild'));
  it.skipIf(!esbuildHere)('the minified benchmark screen is smaller and runs in the browser under the policy', async () => {
    const app = join(repo, 'benchmarks/apps/xoong');
    await sync(join(repo, 'benchmarks/shared/openapi.json'), { out: join(app, '.xoong'), hints: join(app, 'xoong.hints.json') });
    const out = join(await mkdtemp(join(tmpdir(), 'xoong-minreal-')), 'dist');
    const plainOut = join(await mkdtemp(join(tmpdir(), 'xoong-plainreal-')), 'dist');
    const plain = await build({ root: app, out: plainOut });
    const min = await build({ root: app, out });
    void min;
    const m = await build({ root: app, out: join(out, '..', 'min'), minify: true });
    expect(m.minified).toBe(true);
    expect(m.files.reduce((n, f) => n + f.gzip, 0)).toBeLessThan(plain.files.reduce((n, f) => n + f.gzip, 0) * 0.7);
    const { serve } = await import('../../../benchmarks/lib/serve.mjs');
    const server = await serve({ root: join(out, '..', 'min'), rows: 50, csp: CSP });
    const browser = await launchChromium();
    const page = await browser.newPage();
    const violations = [];
    page.on('console', (c) => { if (/Content Security Policy|Refused to/.test(c.text())) violations.push(c.text()); });
    page.on('pageerror', (e) => violations.push(e.message));
    await page.goto(server.url);
    await page.waitForSelector('tbody tr');
    expect(await page.locator('tbody tr').count()).toBe(10);
    await page.getByRole('button', { name: 'Name' }).click();
    await page.waitForSelector('th[aria-sort="ascending"]');
    expect(violations).toEqual([]);
    await browser.close(); await server.close();
  }, 120000);
});
