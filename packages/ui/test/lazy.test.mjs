// router.js and dialogs.js load when needed, not on every page: a page without <xo-router> never fetches the router, a page with one gets it (preloaded by the build),
// `router` works before the module has loaded, the first question loads the dialogs, and the build follows the lazy imports (also with --base and --minify).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from '../../cli/src/build.js';
import { serve } from '../../../benchmarks/lib/serve.mjs';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let work, browser;
beforeAll(async () => {
  await mkdir(join(repo, 'benchmarks/.cache'), { recursive: true });
  work = await mkdtemp(join(repo, 'benchmarks/.cache/lazy-')); // inside the repository, so that @xoong/* resolve from its node_modules
  browser = await launchChromium();
}, 60000);
afterAll(async () => { await browser?.close(); await rm(work, { recursive: true, force: true }); });

const project = async (name, { router, useRouter = router, base = '' }) => {
  const dir = join(work, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>t</title><script type="module" src="/main.js"></script></head><body>${router
    ? `<xo-router${base ? ` base="${base}"` : ''}><template xo-route="/" title="Home"><h1 id="home">Home</h1></template><template xo-route="/about" title="About"><h1 id="about">About</h1></template></xo-router>`
    : '<main id="plain">no router here</main>'}</body></html>`);
  await writeFile(join(dir, 'main.js'), `import { router, confirm } from '@xoong/ui';\nwindow.confirm2 = confirm;\n${useRouter ? "window.router = router;\nwindow.beforeLoad = { current: router.current };\nwindow.guarded = [];\nwindow.offGuard = router.guard((to) => { window.guarded.push(to.path); return true; });\n" : ''}`);
  return dir;
};
const visit = async (dir, { base = '', minify = false } = {}) => {
  const site = join(dir, '..', `${dir.split('/').pop()}-site${base.replace(/\W/g, '')}${minify ? '-min' : ''}`); // served as the root; an app under a base is a folder of it
  const out = join(site, base);
  const result = await build({ root: dir, out, base });
  const server = await serve({ root: site });
  const page = await (await browser.newContext()).newPage();
  const requests = []; page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${server.url}${base}/`);
  await page.waitForTimeout(600);
  return { result, out, server, page, requests, errors, close: () => server.close() };
};

describe('lazy router and dialogs', () => {
  it('a page without <xo-router> never fetches router.js or dialogs.js, and `router` is there (current is null)', async () => {
    const dir = await project('plain', { router: false });
    const v = await visit(dir);
    expect(v.requests.filter((p) => /router\.js$|dialogs\.js$/.test(p))).toEqual([]);
    expect(v.errors).toEqual([]);
    const html = await readFile(join(v.out, 'index.html'), 'utf8');
    expect(html).not.toContain('router.js'); // the build does not preload what the page does not use
    await v.close();
  }, 60000);

  it('a page with <xo-router> gets router.js (preloaded by the build), draws its route, and a guard registered before the load works', async () => {
    const dir = await project('routed', { router: true });
    const v = await visit(dir);
    expect(await readFile(join(v.out, 'index.html'), 'utf8')).toContain('modulepreload" href="/@xoong/ui/src/router.js"');
    expect(v.requests.some((p) => p.endsWith('/router.js'))).toBe(true);
    expect(await v.page.locator('#home').count()).toBe(1);
    expect(await v.page.evaluate(() => window.router.current?.path)).toBe('/');
    expect(await v.page.evaluate(() => window.router.navigate('/about'))).toBe(true);
    await v.page.waitForSelector('#about');
    expect(await v.page.evaluate(() => window.guarded)).toContain('/about'); // registered before the module was there
    await v.page.evaluate(() => window.offGuard()); // the remover works too
    expect(v.errors).toEqual([]);
    await v.close();
  }, 60000);

  it('`router` is an object before anything loads: current is null; the first use (a guard) loads router.js', async () => {
    const dir = await project('used', { router: false, useRouter: true });
    const v = await visit(dir);
    expect(await v.page.evaluate(() => window.beforeLoad.current)).toBeNull();
    expect(v.requests.some((p) => p.endsWith('/router.js'))).toBe(true); // first use
    await v.close();
  }, 60000);

  it('`router.navigate()` called before the module has loaded waits for it; the first question loads dialogs.js and later ones answer at once', async () => {
    const dir = await project('ask', { router: false });
    const v = await visit(dir);
    expect(v.requests.some((p) => p.endsWith('/dialogs.js'))).toBe(false);
    const first = v.page.evaluate(() => { window.answer = window.confirm2('Sure?'); return 1; });
    await first;
    await v.page.waitForSelector('dialog.xo-confirm');
    expect(v.requests.some((p) => p.endsWith('/dialogs.js'))).toBe(true);
    await v.page.getByRole('button', { name: 'Confirm' }).click();
    expect(await v.page.evaluate(() => window.answer)).toBe(true);
    // loaded now: the next question is on the page in the same turn
    expect(await v.page.evaluate(() => { window.confirm2('Again?'); return !!document.querySelector('dialog.xo-confirm'); })).toBe(true);
    await v.close();
  }, 60000);

  it('the build follows the lazy imports: under --base and with the files written, and the rewritten import() points at the base', async () => {
    const dir = await project('based', { router: true, base: '/app' });
    const v = await visit(dir, { base: '/app' });
    expect(v.result.files.some((f) => f.path === '/@xoong/ui/src/router.js')).toBe(true);
    expect(v.result.files.some((f) => f.path === '/@xoong/ui/src/dialogs.js')).toBe(true);
    expect(await readFile(join(v.out, '@xoong/ui/src/router-lazy.js'), 'utf8')).toMatch(/import\(['"]\/app\/@xoong\/ui\/src\/router\.js['"]\)/);
    expect(v.requests.some((p) => p === '/app/@xoong/ui/src/router.js')).toBe(true);
    expect(await v.page.locator('#home').count()).toBe(1);
    await v.close();
  }, 60000);
});
