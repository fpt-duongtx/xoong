// `xoong build` lists the modules a page's scripts import as <link rel="modulepreload">: the browser would otherwise find them one import level at a time.
import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, preloadModules } from '../src/build.js';

async function app() {
  const root = await mkdtemp(join(tmpdir(), 'xoong-pre-'));
  const w = async (p, t) => { await mkdir(join(root, p, '..'), { recursive: true }); await writeFile(join(root, p), t); };
  await w('index.html', '<!doctype html><html><head><title>x</title></head><body><script type="module" src="/app.js"></script></body></html>');
  await w('plain.html', '<!doctype html><html><head><title>p</title></head><body><p>no script</p></body></html>');
  await w('some.html', '<!doctype html><html><head><link rel="modulepreload" href="/sub/b.js"><script type="module" src="/app.js"></script></head><body></body></html>');
  await w('app.js', "import './a.js';\nconsole.log('app');\n");
  await w('a.js', "import { b } from './sub/b.js';\nexport * from './c.js';\nexport const a = b;\n");
  await w('sub/b.js', "export const b = 1;\nexport const lazy = () => import('../lazy.js');\n");
  await w('c.js', "export const c = 3;\n");
  await w('lazy.js', "export const lazy = true;\n");
  return root;
}
const links = (html) => [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);

describe('xoong build: modulepreload', () => {
  it('a page lists every module its script imports (the whole graph), but not the script itself and not a dynamic import', async () => {
    const root = await app();
    const out = join(root, 'dist');
    await build({ root, out });
    const html = await readFile(join(out, 'index.html'), 'utf8');
    expect(links(html)).toEqual(['/a.js', '/c.js', '/sub/b.js']);
    expect(html.indexOf('modulepreload')).toBeLessThan(html.indexOf('<script type="module"')); // ahead of the script that starts the chain
    expect(links(await readFile(join(out, 'plain.html'), 'utf8'))).toEqual([]); // no script, nothing to preload
  });

  it('a module the page already preloads is not listed twice', async () => {
    const root = await app();
    const out = join(root, 'dist');
    await build({ root, out });
    const html = await readFile(join(out, 'some.html'), 'utf8');
    expect(links(html)).toEqual(['/sub/b.js', '/a.js', '/c.js']); // the author's own link first, the build adds the rest
  });

  it('--base prefixes the links like every other URL; preload: false leaves the pages as they were', async () => {
    const root = await app();
    await build({ root, out: join(root, 'dist-base'), base: '/admin' });
    expect(links(await readFile(join(root, 'dist-base/index.html'), 'utf8'))).toEqual(['/admin/a.js', '/admin/c.js', '/admin/sub/b.js']);
    await build({ root, out: join(root, 'dist-off'), preload: false });
    expect(links(await readFile(join(root, 'dist-off/index.html'), 'utf8'))).toEqual([]);
    await writeFile(join(root, 'xoong.config.json'), JSON.stringify({ build: { preload: false } }));
    await build({ root, out: join(root, 'dist-config') });
    expect(links(await readFile(join(root, 'dist-config/index.html'), 'utf8'))).toEqual([]);
  });

  it('preloadModules leaves external scripts and non-module scripts alone', () => {
    const written = new Map([
      ['/p.html', '<html><head><script src="/classic.js"></script><script type="module" src="https://cdn.example/x.js"></script></head></html>'],
      ['/classic.js', "import './d.js';"],
      ['/d.js', 'export {};'],
    ]);
    preloadModules(written, '');
    expect(written.get('/p.html')).not.toContain('modulepreload');
  });
});

describe('xoong build: first load per page and --budget', () => {
  it('counts the HTML, the stylesheets and the static module graph, never a dynamic import, and a page with no script is only its HTML', async () => {
    const root = await app();
    await writeFile(join(root, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="/s.css"></head><body><script type="module" src="/app.js"></script></body></html>');
    await writeFile(join(root, 's.css'), 'body{margin:0}');
    const r = await build({ root, out: join(root, 'dist') });
    const index = r.firstLoad.find((p) => p.page === '/index.html');
    expect(index.files).toBe(6); // page, css, app, a, sub/b, c: not lazy.js
    const plain = r.firstLoad.find((p) => p.page === '/plain.html');
    expect(plain.files).toBe(1);
    expect(index.gzip).toBeGreaterThan(plain.gzip);
    const report = JSON.parse(await readFile(join(root, 'dist/build-report.json'), 'utf8'));
    expect(report.firstLoad.map((p) => p.page)).toEqual(['/index.html', '/plain.html', '/some.html']);
    expect(r.failed).toBe(false);
  });

  it('a budget marks the pages over it and fails the build; a bad budget is refused', async () => {
    const root = await app();
    const r = await build({ root, out: join(root, 'dist'), budget: 0.2 });
    expect(r.firstLoad.find((p) => p.page === '/index.html').over).toBe(true);
    expect(r.firstLoad.find((p) => p.page === '/plain.html').over).toBe(false);
    expect(r.failed).toBe(true);
    expect((await build({ root, out: join(root, 'dist2'), budget: 50 })).failed).toBe(false);
    await expect(build({ root, out: join(root, 'dist3'), budget: Number('x') })).rejects.toThrow(/budget/);
  });
});
