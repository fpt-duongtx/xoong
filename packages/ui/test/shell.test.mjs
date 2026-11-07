// The admin shell of xoong.css in real Chromium, with the router's wrapper elements between the body and the layout.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;

const ROUTER = (attrs = '') => `<xo-router ${attrs}>
  <template xo-layout="shell"><header>Header</header><nav><a href="/">Home</a></nav><main xo-outlet></main></template>
  <template xo-layout="inner" layout="shell"><section><header id="inner-header">inner</header><main id="inner-main" xo-outlet></main></section></template>
  <template xo-route="/" layout="shell"><h1>Home</h1></template>
  <template xo-route="/nested" layout="inner"><h1>Nested</h1></template>
</xo-router>`;
const PAGE = (body, bodyClass = '') => `<!doctype html><html><head><link rel="stylesheet" href="/@xoong/ui/src/xoong.css"></head><body class="${bodyClass}">${body}
<script type="module">import { router } from '@xoong/ui'; window.router = router; window.ready = true;</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-shell-'));
  await writeFile(join(root, 'index.html'), PAGE(ROUTER(), 'xo-admin'));
  await mkdir(join(root, 'router-class'));
  await writeFile(join(root, 'router-class', 'index.html'), PAGE(ROUTER('class="xo-admin" base="/router-class"')));
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

const box = (selector) => page.$eval(selector, (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
const open = async (path) => { await page.goto(dev.url + path); await page.waitForFunction(() => window.ready && document.querySelector('main h1')); };

for (const [name, path] of [['body.xo-admin', '/'], ['xo-router.xo-admin', '/router-class/']]) {
  describe(`shell with ${name}`, () => {
    it('header on top across the full width, sidebar on the left, main to its right (the router wrappers do not break the grid)', async () => {
      await open(path);
      const header = await box('header');
      const nav = await box('nav');
      const main = await box('main');
      expect(header).toMatchObject({ x: 0, y: 0, w: 1200 });
      expect(nav.x).toBe(0);
      expect(nav.w).toBe(224); // 14rem
      expect(nav.y).toBeGreaterThanOrEqual(header.h);
      expect(main.x).toBe(224);
      expect(main.w).toBe(1200 - 224);
      expect(main.y).toBe(nav.y);
    });

    it('the wrapper elements have no box of their own', async () => {
      await open(path);
      for (const sel of ['xo-router:not(.xo-admin)', '.xo-router-root', '.xo-layout']) {
        const display = await page.evaluate((s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).display : 'contents'; }, sel);
        expect(display, sel).toBe('contents');
      }
    });

    it('a nested layout keeps its own header/main plain: only the outermost shell is the grid', async () => {
      await open(path);
      await page.evaluate(() => window.router.navigate('/nested'));
      await page.waitForFunction(() => document.querySelector('main h1')?.textContent === 'Nested');
      const outer = await box('header');
      expect(outer).toMatchObject({ x: 0, w: 1200 });
      const innerHeader = await page.$eval('#inner-header', (el) => getComputedStyle(el).gridArea);
      expect(innerHeader).toBe('auto'); // not placed in the shell grid
      const innerMain = await box('#inner-main');
      expect(innerMain.x).toBeGreaterThanOrEqual(224);
    });
  });
}
