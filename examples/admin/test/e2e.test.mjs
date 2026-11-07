// End to end: mock backend -> `xoong dev` (static, TypeScript stripping, proxy, SSE) -> real Chromium.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { sync } from '../../../packages/cli/src/commands.js';
import { checkFiles } from '../../../packages/cli/src/check.js';
import { startDev } from '../../../packages/cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';
import { startBackend } from '../backend.mjs';

const dir = new URL('..', import.meta.url).pathname;
const repo = new URL('../../..', import.meta.url).pathname;
let backend, dev, browser, page1, page2;
const errors = [];
const names = (page) => page.$$eval('tbody tr', (rows) => rows.map((r) => r.children[0].textContent.trim()));
const statuses = (page) => page.$$eval('tbody tr', (rows) => rows.map((r) => r.querySelector('.badge')?.textContent.trim()));
const waitRows = (page, n) => page.waitForFunction((count) => document.querySelectorAll('tbody tr').length === count, n, { timeout: 5000 });

beforeAll(async () => {
  await sync(join(dir, 'openapi.json'), { out: join(dir, '.xoong'), hints: join(dir, 'xoong.hints.json') });
  backend = await startBackend();
  dev = await startDev({ root: dir, resolveFrom: repo, port: 0, quiet: true, proxy: { '/api': backend.url } });
  browser = await launchChromium();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  for (const open of [async () => (page1 = await ctx.newPage()), async () => (page2 = await ctx.newPage())]) {
    const page = await open();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  }
  await page1.goto(dev.url);
  await waitRows(page1, 3);
}, 60000);

afterAll(async () => { await browser?.close(); await dev?.close(); await backend?.close(); });

describe('admin example in a real browser', () => {
  it('its HTML passes `xoong check` against the synced API', async () => {
    const table = JSON.parse(await readFile(join(dir, '.xoong/operations.json'), 'utf8'));
    const { findings } = await checkFiles([join(dir, 'index.html')], table);
    expect(findings).toEqual([]);
  });

  it('renders the list declared in HTML (no application JavaScript besides configure())', async () => {
    expect(await names(page1)).toEqual(['Ada Lovelace', 'Grace Hopper', 'Alan Turing']);
    expect(await statuses(page1)).toEqual(['active', 'active', 'active']);
    expect(backend.hits.list).toBe(1);
  });

  it('a click calls the operation, updates the row in place and refetches the list once', async () => {
    await page1.evaluate(() => { document.querySelector('tbody tr').dataset.keep = '1'; });
    await page1.click('tbody tr:nth-child(1) button:text("Disable")');
    await page1.waitForFunction(() => document.querySelector('tbody tr .badge').textContent.trim() === 'disabled');
    expect(await page1.$eval('tbody tr', (r) => r.dataset.keep)).toBe('1'); // same DOM node: no re-render of the row
    expect(backend.hits.disable).toBe(1);
    await expect.poll(() => backend.hits.list).toBe(2);
  });

  it('another browser tab sees a change live, without polling or any list request', async () => {
    await page2.goto(dev.url);
    await waitRows(page2, 3);
    expect(await statuses(page2)).toEqual(['disabled', 'active', 'active']);
    await expect.poll(() => backend.streams.size).toBe(2); // both tabs are subscribed
    const listBefore = backend.hits.list;
    await page1.click('tbody tr:nth-child(2) button:text("Disable")');
    await page2.waitForFunction(() => document.querySelectorAll('.badge')[1].textContent.trim() === 'disabled', null, { timeout: 5000 });
    await expect.poll(() => backend.hits.list).toBe(listBefore + 1); // only the acting tab refetched; tab 2 got the patch
  });

  it('adding a person refetches in the acting tab and, through a resync event, in the other one', async () => {
    await page1.fill('input[name=name]', 'Dana Scott');
    await page1.fill('input[name=email]', 'dana@example.com');
    await page1.click('form button');
    await waitRows(page1, 4);
    await waitRows(page2, 4);
    expect(await names(page2)).toContain('Dana Scott');
    expect(await page1.inputValue('input[name=name]')).toBe(''); // the form was reset after a successful send
  });

  it('an API error is normalised and shown (message comes from the { error: { code, message } } envelope)', async () => {
    await page1.fill('input[name=name]', '   ');
    await page1.fill('input[name=email]', 'x@example.com');
    await page1.click('form button');
    await page1.waitForSelector('#toast:not([hidden])');
    expect((await page1.textContent('#toast')).trim()).toBe('name is required');
    expect(backend.users.size).toBe(4); // nothing was created
  });

  it('deleting removes the row in both tabs', async () => {
    await page1.click('tbody tr:nth-child(3) button.danger');
    await waitRows(page1, 3);
    await waitRows(page2, 3);
    expect(await names(page2)).toEqual(['Ada Lovelace', 'Grace Hopper', 'Dana Scott']);
  });

  it('produced no browser errors, and the dev server stripped the TypeScript on the way', async () => {
    // The browser logs every failed response; the only one this run causes on purpose is the 422 validation error.
    expect(errors.filter((e) => !/status of 422/.test(e))).toEqual([]);
    expect(errors.filter((e) => /status of 422/.test(e))).toHaveLength(1);
    const main = await (await fetch(dev.url + '/src/main.ts')).text();
    expect(main).not.toMatch(/as HTMLElement|as CustomEvent/);
  });
});
