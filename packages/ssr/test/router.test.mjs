// Prerendering a router page per URL (static output for SEO), and opening that output in real Chromium.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';
import { renderPage } from '../src/render.js';

const repo = new URL('../../..', import.meta.url).pathname;
const operations = { version: 1, entities: { User: { id: 'id' } }, operations: { getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User' } } } };
const api = async (url) => {
  const id = Number(new URL(url, 'http://api.test').pathname.split('/').pop());
  return new Response(JSON.stringify({ id, name: `Ada ${id}` }), { status: 200 });
};
const PAGE = `<!doctype html><html lang="en"><head><title>App</title><script type="module" src="/main.js"></script></head><body>
<xo-router>
  <template xo-layout="shell"><nav><a id="home" href="/">Home</a></nav><main xo-outlet></main></template>
  <template xo-route="/" layout="shell" title="Home" description="The home page"><h1>Home</h1></template>
  <template xo-route="/users/:id" layout="shell" title="User page" description="One user"><xo-view get="getUser" p-id=":id"><h1>{name}</h1></xo-view></template>
</xo-router></body></html>`;

describe('prerendering a page with <xo-router>', () => {
  it('renders the route of the URL with its data, title and description, one copy of the layout', async () => {
    const html = await renderPage(PAGE, { operations, fetch: api, url: 'http://site.test/users/7' });
    expect(html).toMatch(/<title>User page<\/title>/);
    expect(html).toMatch(/<meta name="description" content="One user">/);
    expect(html).toMatch(/<h1>Ada 7<\/h1>/);
    expect(html.match(/<nav>/g)).toHaveLength(2); // the layout template (inert) and the rendered layout
    const other = await renderPage(PAGE, { operations, fetch: api, url: 'http://site.test/' });
    expect(other).toMatch(/<title>Home<\/title>/);
    expect(other).toMatch(/<h1>Home<\/h1>/);
    expect(other).not.toMatch(/Ada/);
  });

  it('a different URL on the next render is not polluted by the previous one', async () => {
    await renderPage(PAGE, { operations, fetch: api, url: 'http://site.test/users/1' });
    const html = await renderPage(PAGE, { operations, fetch: api, url: 'http://site.test/users/2' });
    expect(html).toMatch(/Ada 2/);
    expect(html).not.toMatch(/Ada 1/);
  });
});

describe('the prerendered output in real Chromium', () => {
  let dev, browser, page, html;
  const errors = [];
  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-ssr-router-'));
    await writeFile(join(root, 'index.html'), PAGE);
    await writeFile(join(root, 'main.js'), "import '@xoong/ui'; import { configure } from '@xoong/data'; import ops from '/ops.json' with { type: 'json' }; configure({ api: ops, baseUrl: '/api' }); window.ready = true;");
    await writeFile(join(root, 'ops.json'), JSON.stringify(operations));
    dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true, proxy: { '/api': 'http://127.0.0.1:1' } });
    html = await renderPage(await (await fetch(dev.url)).text(), { operations, fetch: api, url: dev.url + '/users/7' });
    browser = await launchChromium();
    page = await (await browser.newContext()).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ECONNREFUSED|502|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.route(dev.url + '/users/7', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  }, 60000);
  afterAll(async () => { await browser?.close(); await dev?.close(); });

  it('shows the content with JavaScript disabled', async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.route(dev.url + '/users/7', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await p.goto(dev.url + '/users/7');
    expect(await p.textContent('main h1')).toBe('Ada 7');
    expect(await p.title()).toBe('User page');
    await ctx.close();
  });

  it('the router takes over without duplicating the page, and navigation still works', async () => {
    await page.goto(dev.url + '/users/7');
    await page.waitForFunction(() => window.ready);
    await page.waitForFunction(() => document.querySelectorAll('.xo-router-root').length === 1);
    expect(await page.$$eval('main h1', (h) => h.length)).toBe(1);
    expect(await page.$$eval('nav', (n) => n.length)).toBe(1);
    await page.click('#home');
    await page.waitForFunction(() => location.pathname === '/');
    expect(await page.textContent('main h1')).toBe('Home');
    expect(await page.title()).toBe('Home');
    expect(errors).toEqual([]);
  });
});
