// <xo-router> in real Chromium: real history entries, Back/Forward, real link clicks, scrolling, and the dev server's fallback.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;
const errors = [];

const PAGE = `<!doctype html><html><head><title>App</title></head><body>
<xo-router base="/admin">
  <template xo-layout="shell"><nav><a id="home" href="/admin/">Home</a> <a id="users" href="/admin/users">Users</a> <a id="out" href="/elsewhere.html">Out</a></nav><main xo-outlet></main></template>
  <template xo-route="/" layout="shell" title="Home"><h1>Home</h1></template>
  <template xo-route="/users" layout="shell" title="Users"><h1>Users</h1><p style="height:3000px">tall</p></template>
  <template xo-route="/users/:id" layout="shell" title="User"><h1>User <span id="uid"></span></h1></template>
  <template xo-route="/login"><h1>Login</h1></template>
  <template xo-route="*"><h1>Not found</h1></template>
</xo-router>
<script type="module">
import '@xoong/ui';
import { router } from '@xoong/ui';
window.router = router;
window.ready = true;
</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-router-'));
  await writeFile(join(root, 'index.html'), PAGE);
  await writeFile(join(root, 'elsewhere.html'), '<h1>Elsewhere</h1>');
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(dev.url + '/admin/users/7');
  await page.waitForFunction(() => window.ready && window.router.current);
}, 60000);

afterAll(async () => { await browser?.close(); await dev?.close(); });

const h1 = () => page.textContent('main h1, .xo-router-root > h1');
const path = () => page.evaluate(() => location.pathname);

describe('<xo-router> in a real browser', () => {
  it('opens a deep link served by the dev fallback, with the right route, title and parameter', async () => {
    expect((await h1()).trim()).toBe('User');
    expect(await page.title()).toBe('User');
    expect(await page.evaluate(() => window.router.current.params)).toEqual({ id: '7' });
  });

  it('a click on a link changes the URL without reloading the page, and aria-current follows', async () => {
    await page.evaluate(() => { window.__marker = 1; });
    await page.click('#users');
    await page.waitForFunction(() => location.pathname === '/admin/users');
    expect((await h1()).trim()).toBe('Users');
    expect(await page.evaluate(() => window.__marker)).toBe(1); // same document: not a reload
    expect(await page.getAttribute('#users', 'aria-current')).toBe('page');
    expect(await page.getAttribute('#home', 'aria-current')).toBeNull();
  });

  it('Back and Forward walk the history and show the matching route', async () => {
    await page.click('#home');
    await page.waitForFunction(() => location.pathname === '/admin');
    expect((await h1()).trim()).toBe('Home');
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/admin/users');
    expect((await h1()).trim()).toBe('Users');
    await page.goForward();
    await page.waitForFunction(() => location.pathname === '/admin');
    expect((await h1()).trim()).toBe('Home');
  });

  it('navigation starts at the top of the page and moves focus into the new content', async () => {
    await page.click('#users');
    await page.waitForFunction(() => location.pathname === '/admin/users');
    await page.evaluate(() => window.scrollTo(0, 1500));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    await page.evaluate(() => window.router.navigate('/users/3'));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.activeElement?.hasAttribute('xo-outlet'))).toBe(true);
  });

  it('a link to another page of the site is left to the browser (a real navigation)', async () => {
    await Promise.all([page.waitForURL('**/elsewhere.html'), page.click('#out')]);
    expect(await page.textContent('h1')).toBe('Elsewhere');
    await page.goto(dev.url + '/admin/users');
    await page.waitForFunction(() => window.ready && window.router.current);
  });

  it('a vetoed Back is cancelled with history.go: the history is intact, and one Back press works afterwards', async () => {
    await page.goto(dev.url + '/admin');
    await page.waitForFunction(() => window.ready && window.router.current);
    await page.evaluate(() => window.router.navigate('/users'));
    await page.evaluate(() => window.router.navigate('/users/3'));
    await page.waitForFunction(() => location.pathname === '/admin/users/3');
    const length = await page.evaluate(() => history.length);
    await page.evaluate(() => { window.__off = window.router.beforeNavigate(() => false); });
    await page.goBack();
    await new Promise((r) => setTimeout(r, 200));
    expect(await path()).toBe('/admin/users/3'); // stayed
    expect(await page.evaluate(() => history.length)).toBe(length); // nothing pushed (the old fallback pushed a duplicate entry)
    await page.evaluate(() => window.__off());
    await page.goBack(); // ONE press goes to the previous page
    await page.waitForFunction(() => location.pathname === '/admin/users');
    await page.goForward(); // and the forward entry is still there
    await page.waitForFunction(() => location.pathname === '/admin/users/3');
  });

  it('Back restores the scroll position of the page you return to; a new navigation starts at the top', async () => {
    await page.goto(dev.url + '/admin/users');
    await page.waitForFunction(() => window.ready && window.router.current);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.evaluate(() => window.router.navigate('/users/9'));
    await page.waitForFunction(() => location.pathname === '/admin/users/9');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/admin/users');
    await page.waitForFunction(() => window.scrollY > 1000);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(1200);
  });

  it('a veto stops a link and Back, and the address bar is put back', async () => {
    await page.evaluate(() => { window.__off = window.router.beforeNavigate(() => false); });
    await page.click('#home');
    await new Promise((r) => setTimeout(r, 100));
    expect(await path()).toBe('/admin/users');
    expect((await h1()).trim()).toBe('Users');
    // Back (to wherever we came from) is vetoed too: the page and URL stay
    await page.evaluate(() => { window.__off(); window.router.navigate('/'); });
    await page.waitForFunction(() => location.pathname === '/admin');
    await page.evaluate(() => { window.__off = window.router.beforeNavigate(() => false); });
    await page.goBack();
    await new Promise((r) => setTimeout(r, 150));
    expect(await path()).toBe('/admin');
    expect((await h1()).trim()).toBe('Home');
    await page.evaluate(() => window.__off());
  });

  it('a guard can redirect to a login route', async () => {
    await page.evaluate(() => { window.router.guard((to) => (to.path.startsWith('/users') ? '/login' : true)); });
    await page.click('#users');
    await page.waitForFunction(() => location.pathname === '/admin/login');
    expect((await page.textContent('.xo-router-root > h1')).trim()).toBe('Login');
  });

  it('produced no browser errors', () => {
    expect(errors).toEqual([]);
  });
});
