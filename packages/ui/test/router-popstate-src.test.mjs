// Back/Forward when a lazy route or layout `src` fails. Real history, so `history.go` and the stored position are the browser's.
// Spec: docs/admin.md ("A failed src") and docs/decisions/0011-popstate-src-failure.md.
// Chromium runs in the main test job; Firefox and WebKit run this file from `npm run test:browsers`.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, context, page;

const PAGE = `<!doctype html><html><head><title>App</title></head><body>
<xo-router>
  <template xo-route="/" title="Home"><h1>Home</h1></template>
  <template xo-route="/a" title="A"><h1>Page A</h1></template>
  <template xo-route="/b" title="B"><h1>Page B</h1></template>
  <template xo-route="/lazy" title="Lazy" src="/lazy.html"></template>
  <template xo-layout="shell" src="/shell.html"></template>
  <template xo-route="/laid" layout="shell" title="Laid"><h1>Laid</h1></template>
</xo-router>
<script type="module">
import '@xoong/ui';
import { router } from '@xoong/ui';
window.router = router;
window.__errors = [];
document.querySelector('xo-router').addEventListener('xo-error', (e) => {
  window.__errors.push(e.detail && e.detail.message ? e.detail.message : String(e.detail));
});
window.ready = true;
</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-pop-src-'));
  await writeFile(join(root, 'index.html'), PAGE);
  await writeFile(join(root, 'lazy.html'), '<h1>Lazy</h1>');
  await writeFile(join(root, 'shell.html'), '<nav>Shell</nav><main xo-outlet></main>');
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  context = await browser.newContext();
}, 60000);

afterAll(async () => { await browser?.close(); await dev?.close(); });

beforeEach(async () => {
  page = await context.newPage();
  await page.goto(dev.url + '/');
  await page.waitForFunction(() => window.ready && window.router.current);
});

afterEach(async () => { await page?.close(); });

const h1 = () => page.locator('.xo-router-root h1').innerText();
const path = () => page.evaluate(() => location.pathname);
const errors = () => page.evaluate(() => window.__errors.slice());
const go = (to) => page.evaluate((p) => window.router.navigate(p), to);

/** The route was already shown, so its template is full. Swap in an empty one: the next visit fetches again. */
async function refetch(attr, value, src) {
  await page.evaluate(({ attr, value, src }) => {
    const t = document.querySelector(`template[${attr}="${value}"]`);
    const fresh = document.createElement('template');
    for (const a of t.attributes) fresh.setAttribute(a.name, a.value);
    fresh.setAttribute('src', src);
    t.replaceWith(fresh);
  }, { attr, value, src });
}

function fail(url) {
  return page.route(`**${url}`, (route) => route.fulfill({ status: 503, contentType: 'text/html', body: 'no' }));
}

/** The fetch has failed and the router has had a turn to put the address bar back. */
async function settled() {
  await page.waitForFunction(() => window.__errors.length >= 1);
  await page.waitForTimeout(200);
}

describe('router popstate with lazy src', () => {
  it('a failed src on Back restores the URL and the screen, and fires one xo-error', async () => {
    await go('/lazy');
    await page.waitForFunction(() => document.querySelector('.xo-router-root h1')?.textContent === 'Lazy');
    await go('/b');
    await page.waitForFunction(() => location.pathname === '/b');
    await fail('/lazy-fail.html');
    await refetch('xo-route', '/lazy', '/lazy-fail.html');
    await page.evaluate(() => { window.__errors = []; });
    await page.goBack();
    await settled();
    expect(await path()).toBe('/b');
    expect(await h1()).toBe('Page B');
    expect(await errors()).toEqual([expect.stringMatching(/lazy-fail\.html 503/)]);
  });

  it('a failed src on Forward restores the URL and the screen, and fires one xo-error', async () => {
    await go('/b');
    await go('/lazy');
    await page.waitForFunction(() => location.pathname === '/lazy');
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/b');
    await fail('/lazy-fail.html');
    await refetch('xo-route', '/lazy', '/lazy-fail.html');
    await page.evaluate(() => { window.__errors = []; });
    await page.goForward();
    await settled();
    expect(await path()).toBe('/b');
    expect(await h1()).toBe('Page B');
    expect(await errors()).toEqual([expect.stringMatching(/lazy-fail\.html 503/)]);
  });

  it('after a failed Back, a further Back and then Forward land on the right URL and screen', async () => {
    await go('/a');
    await go('/lazy');
    await go('/b');
    await page.waitForFunction(() => location.pathname === '/b');
    const length = await page.evaluate(() => history.length);
    await fail('/lazy-fail.html');
    await refetch('xo-route', '/lazy', '/lazy-fail.html');
    await page.evaluate(() => { window.__errors = []; });
    await page.goBack();
    await settled();
    expect(await path()).toBe('/b');
    expect(await h1()).toBe('Page B');
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page.unroute('**/lazy-fail.html');
    await page.route('**/lazy-fail.html', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Lazy</h1>' }));
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/lazy' && document.querySelector('.xo-router-root h1')?.textContent === 'Lazy');
    await page.goForward();
    await page.waitForFunction(() => location.pathname === '/b' && document.querySelector('.xo-router-root h1')?.textContent === 'Page B');
    expect(await path()).toBe('/b');
    expect(await h1()).toBe('Page B');
  });

  it('after a failed Back, the next Back fetches the route again and renders it', async () => {
    await go('/lazy');
    await go('/b');
    await page.waitForFunction(() => location.pathname === '/b');
    await fail('/lazy-fail.html');
    await refetch('xo-route', '/lazy', '/lazy-fail.html');
    await page.evaluate(() => { window.__errors = []; });
    await page.goBack();
    await settled();
    expect(await path()).toBe('/b');
    expect(await errors()).toHaveLength(1);
    await page.unroute('**/lazy-fail.html');
    await page.route('**/lazy-fail.html', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Lazy again</h1>' }));
    await page.evaluate(() => { window.__errors = []; });
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('.xo-router-root h1')?.textContent === 'Lazy again');
    expect(await path()).toBe('/lazy');
    expect(await errors()).toEqual([]);
  });

  it('a second Back while a src fetch is in flight wins, with no stale screen and no stale xo-error', async () => {
    await go('/a');
    await go('/b');
    await page.waitForFunction(() => location.pathname === '/b');
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route('**/slow.html', async (route) => {
      await held;
      await route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>Stale</h1>' });
    });
    await refetch('xo-route', '/a', '/slow.html');
    await page.evaluate(() => { window.__errors = []; });
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/a');
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/' && document.querySelector('.xo-router-root h1')?.textContent === 'Home');
    release();
    await page.waitForTimeout(300);
    expect(await path()).toBe('/');
    expect(await h1()).toBe('Home');
    expect(await errors()).toEqual([]);
  });

  it('a layout src that fails on Back restores the URL and the screen, and fires one xo-error', async () => {
    await go('/laid');
    await page.waitForFunction(() => document.querySelector('.xo-router-root h1')?.textContent === 'Laid');
    await go('/b');
    await page.waitForFunction(() => location.pathname === '/b');
    await fail('/shell-fail.html');
    await refetch('xo-layout', 'shell', '/shell-fail.html');
    await page.evaluate(() => { window.__errors = []; });
    await page.goBack();
    await settled();
    expect(await path()).toBe('/b');
    expect(await h1()).toBe('Page B');
    expect(await errors()).toEqual([expect.stringMatching(/shell-fail\.html 503/)]);
  });
});
