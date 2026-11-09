// The prerendered admin page, opened in real Chromium: it already shows the data before any script runs, and the
// client then takes over from the saved template (actions work, no errors, no duplicated rows).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { sync } from '../../cli/src/commands.js';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';
import { startBackend } from '../../../examples/admin/backend.mjs';
import { renderPage } from '../src/render.js';

const repo = new URL('../../..', import.meta.url).pathname;
const dir = join(repo, 'examples/admin');
let backend, dev, browser, ssrHtml, page;
const errors = [];

beforeAll(async () => {
  await sync(join(dir, 'openapi.json'), { out: join(dir, '.xoong'), hints: join(dir, 'xoong.hints.json') });
  backend = await startBackend();
  dev = await startDev({ root: dir, resolveFrom: repo, port: 0, quiet: true, proxy: { '/api': backend.url } });
  const operations = JSON.parse(await readFile(join(dir, '.xoong/operations.json'), 'utf8'));
  const served = await (await fetch(dev.url)).text(); // includes the import map the dev server injects
  ssrHtml = await renderPage(served, { operations, baseUrl: backend.url });
  browser = await launchChromium();
  page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(dev.url + '/', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: ssrHtml }));
}, 60000);

afterAll(async () => { await browser?.close(); await dev?.close(); await backend?.close(); });

describe('prerendered page', () => {
  it('contains the data as plain HTML, with the original markup saved for the client', () => {
    expect(ssrHtml).toMatch(/Ada Lovelace/);
    expect(ssrHtml).toMatch(/<template data-xo-template/);
    expect(ssrHtml).toMatch(/<script type="importmap">/);
  });

  it('shows the data with JavaScript disabled', async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.route(dev.url + '/', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: ssrHtml }));
    await p.goto(dev.url);
    expect(await p.$$eval('tbody tr', (r) => r.length)).toBe(2);
    expect(await p.textContent('tbody tr')).toContain('Ada Lovelace');
    await ctx.close();
  });

  it('the client takes over: same rows, no duplicates, actions work, no browser errors', async () => {
    await page.goto(dev.url);
    await page.waitForFunction(() => !document.querySelector('template[data-xo-template]'), null, { timeout: 5000 }); // view restarted from the template
    expect(await page.$$eval('tbody tr', (r) => r.length)).toBe(2);
    expect(await page.$$eval('thead th', (h) => h.map((x) => x.textContent.trim()))).toEqual(['Name', 'E-mail', 'Role', 'Status', 'Actions']);
    await page.click('tbody tr:nth-child(1) button:text("Disable")');
    await page.waitForFunction(() => document.querySelector('tbody tr').children[3].textContent.trim() === 'disabled', null, { timeout: 5000 });
    expect(errors).toEqual([]);
  });
});
