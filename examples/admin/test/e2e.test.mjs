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
const statuses = (page) => page.$$eval('tbody tr', (rows) => rows.map((r) => r.children[3].textContent.trim()));
const pager = (page) => page.$$eval('.xo-pager button', (b) => b.map((x) => x.textContent.trim()));
const waitNames = (page, expected) => page.waitForFunction((want) => JSON.stringify([...document.querySelectorAll('tbody tr')].map((r) => r.children[0].textContent.trim())) === JSON.stringify(want), expected, { timeout: 5000 });
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
  await waitRows(page1, 2);
}, 60000);

afterAll(async () => { await browser?.close(); await dev?.close(); await backend?.close(); });

describe('admin example in a real browser (declarations only, no application JavaScript beyond configure())', () => {
  it('its HTML passes `xoong check` against the synced API', async () => {
    const table = JSON.parse(await readFile(join(dir, '.xoong/operations.json'), 'utf8'));
    const { findings } = await checkFiles([join(dir, 'index.html')], table);
    expect(findings).toEqual([]);
  });

  it('renders the first page declared by <xo-table page-size>, with the layout and tokens from xoong.css', async () => {
    expect(await names(page1)).toEqual(['Ada Lovelace', 'Grace Hopper']);
    expect(await statuses(page1)).toEqual(['active', 'active']);
    expect(await pager(page1)).toEqual(['Next']);
    expect(backend.hits.list).toBe(1);
    expect(await page1.$eval('body', (b) => getComputedStyle(b).display)).toBe('grid'); // .xo-admin layout
    const css = await fetch(dev.url + '/@xoong/ui/src/xoong.css');
    expect(css.status).toBe(200);
  });

  it('paging asks the server for the next page and Previous goes back', async () => {
    await page1.click('.xo-pager button:text("Next")');
    await waitNames(page1, ['Alan Turing']);
    expect(await pager(page1)).toEqual(['Previous']);
    await page1.click('.xo-pager button:text("Previous")');
    await waitNames(page1, ['Ada Lovelace', 'Grace Hopper']);
  });

  it('sorting is done by the server: ascending, descending, ascending again', async () => {
    await page1.click('thead button:text("name")');
    await waitNames(page1, ['Ada Lovelace', 'Alan Turing']);
    await page1.click('thead button:text("name")');
    await waitNames(page1, ['Grace Hopper', 'Alan Turing']);
    await page1.click('thead button:text("name")');
    await waitNames(page1, ['Ada Lovelace', 'Alan Turing']);
  });

  it('a row action calls the operation and updates in place; another tab sees it live, with no list request', async () => {
    await page1.evaluate(() => { document.querySelector('tbody tr').dataset.keep = '1'; });
    await page2.goto(dev.url);
    await waitRows(page2, 2);
    await expect.poll(() => backend.streams.size).toBe(2);
    const listBefore = backend.hits.list;
    await page1.click('tbody tr:nth-child(1) button:text("Disable")');
    await page2.waitForFunction(() => document.querySelector('tbody tr').children[3].textContent.trim() === 'disabled', null, { timeout: 5000 });
    await page1.waitForFunction(() => document.querySelector('tbody tr').children[3].textContent.trim() === 'disabled', null, { timeout: 5000 });
    expect(await statuses(page1)).toEqual(['disabled', 'active']);
    expect(await page1.$eval('tbody tr', (r) => r.dataset.keep)).toBe('1'); // same DOM node: no re-render of the row
    expect(backend.hits.disable).toBe(1);
    await expect.poll(() => backend.hits.list).toBe(listBefore + 1); // only the acting tab refetched
  });

  it('the dialog opens, shows a form generated from the request schema, and closes after a successful add', async () => {
    expect(await page1.$eval('dialog', (d) => d.open)).toBe(false);
    await page1.click('button:text("Add a person")');
    expect(await page1.$eval('dialog', (d) => d.open)).toBe(true);
    expect(await page1.$$eval('dialog label > span', (s) => s.map((x) => x.textContent))).toEqual(['Name', 'Email', 'Role']);
    await page1.fill('dialog input[name=name]', 'Dana Scott');
    await page1.fill('dialog input[name=email]', 'dana@example.com');
    await page1.selectOption('dialog select[name=role]', 'member');
    await page1.click('dialog form button');
    await page1.waitForFunction(() => !document.querySelector('dialog').open, null, { timeout: 5000 });
    await expect.poll(() => backend.users.size).toBe(4);
    expect(await page1.inputValue('dialog input[name=name]')).toBe(''); // the form was reset
    // the other tab got a resync event and refetched; the new person is on its second page
    await page2.click('.xo-pager button:text("Next")');
    await waitNames(page2, ['Alan Turing', 'Dana Scott']);
  });

  it('a validation error from the server appears beside the field and the dialog stays open', async () => {
    await page1.click('button:text("Add a person")');
    await page1.fill('dialog input[name=name]', '   ');
    await page1.fill('dialog input[name=email]', 'x@example.com');
    await page1.selectOption('dialog select[name=role]', 'admin');
    await page1.click('dialog form button');
    await page1.waitForSelector('dialog .xo-error');
    expect((await page1.textContent('dialog .xo-error')).trim()).toBe('name is required');
    expect(await page1.$eval('dialog input[name=name]', (i) => i.getAttribute('aria-invalid'))).toBe('true');
    expect(await page1.$eval('dialog', (d) => d.open)).toBe(true);
    expect(await page1.inputValue('dialog input[name=email]')).toBe('x@example.com'); // typed values survive an error
    expect(backend.users.size).toBe(4);
    await page1.click('dialog button:text("Cancel")');
    expect(await page1.$eval('dialog', (d) => d.open)).toBe(false);
  });

  it('deleting removes the row in both tabs', async () => {
    await page1.click('tbody tr:nth-child(2) button.danger'); // Alan Turing
    await waitNames(page1, ['Ada Lovelace', 'Dana Scott']);
    await waitNames(page2, ['Dana Scott']);
  });

  it('produced no browser errors, and the dev server stripped the TypeScript on the way', async () => {
    // The browser logs every failed response; the only one this run causes on purpose is the 422 validation error.
    expect(errors.filter((e) => !/status of 422/.test(e))).toEqual([]);
    if ((process.env.XOONG_BROWSER ?? 'chromium') === 'chromium') expect(errors.filter((e) => /status of 422/.test(e))).toHaveLength(1); // Chromium logs failed responses, Firefox and WebKit do not
    const main = await (await fetch(dev.url + '/src/main.ts')).text();
    expect(main).not.toMatch(/Parameters<typeof configure>/);
  });
});
