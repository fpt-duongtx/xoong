// The confirmation dialog in real Chromium: `confirm()` and the dirty-form leave question must open a native <dialog class="xo-confirm">
// with Cancel and Confirm, and answer the router (a page error here once left every confirmation dead).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;
const pageErrors = [];

const PAGE = `<!doctype html><html><head><link rel="stylesheet" href="/@xoong/ui/src/xoong.css"></head><body>
<xo-router>
  <template xo-route="/"><h1>Home</h1><form id="f"><input name="a"></form><a id="go" href="/other">Other</a></template>
  <template xo-route="/other"><h1>Other</h1></template>
</xo-router>
<script type="module">import { router, confirm } from '@xoong/ui'; window.router = router; window.confirm2 = confirm; window.ready = true;</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-confirm-'));
  await writeFile(join(root, 'index.html'), PAGE);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

const texts = () => page.$$eval('dialog.xo-confirm button', (bs) => bs.map((b) => b.textContent));
const open = async () => { await page.goto(dev.url + '/'); await page.waitForFunction(() => window.ready && document.querySelector('h1')); };

describe('confirmation dialog', () => {
  it('confirm() opens a modal dialog with Cancel and Confirm, and resolves with the answer', async () => {
    await open();
    await page.evaluate(() => { window.answer = window.confirm2('Delete it?'); });
    await page.waitForSelector('dialog.xo-confirm[open]');
    expect(await texts()).toEqual(['Cancel', 'Confirm']);
    expect(await page.textContent('dialog.xo-confirm p')).toBe('Delete it?');
    await page.click('dialog.xo-confirm .xo-confirm-ok');
    expect(await page.evaluate(() => window.answer)).toBe(true);
    expect(await page.$('dialog.xo-confirm')).toBeNull();
  });

  it('a dirty form asks before a link leaves the page: Cancel stays, Confirm goes', async () => {
    await open();
    await page.evaluate(() => document.querySelector('#f').dispatchEvent(new CustomEvent('xo-dirty', { bubbles: true, detail: { dirty: true } })));
    await page.click('#go');
    await page.waitForSelector('dialog.xo-confirm[open]');
    expect(await texts()).toEqual(['Cancel', 'Confirm']);
    await page.click('dialog.xo-confirm button:first-child');
    await page.waitForSelector('dialog.xo-confirm', { state: 'detached' });
    expect(new URL(page.url()).pathname).toBe('/');
    await page.click('#go');
    await page.waitForSelector('dialog.xo-confirm[open]');
    await page.click('dialog.xo-confirm .xo-confirm-ok');
    await page.waitForFunction(() => location.pathname === '/other');
  });

  it('raised no page error', () => { expect(pageErrors).toEqual([]); });
});
