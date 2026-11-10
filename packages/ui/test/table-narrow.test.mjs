// Row actions at 390px, in a real browser. The frame is `.xo-table` (overflow-x: auto).
// Without a pinned column the Edit button sits past the right edge. With the column pinned, a focused
// control in the neighbouring column can still sit under it until the frame has scroll-padding.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;

const PAGE = (extra = '', dir = 'ltr') => `<!doctype html><html dir="${dir}"><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">${extra}
<style>body { margin: 0; }</style></head><body>
<xo-view get="listUsers"><xo-table columns="name,email:E-mail,role,city,country" filters="q:Search"><a slot="country" href="#country">{country}</a><button type="button">Edit</button><button type="button">Actions</button><button type="button">Delete</button></xo-table></xo-view>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['q'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada Lovelace', email: 'ada@analytical.engine', role: 'administrator', city: 'London', country: 'United Kingdom' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
window.ready = true;
</script></body></html>`;

const CARDS = `<!doctype html><html><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<link rel="stylesheet" href="/@xoong/ui/src/mist.css">
<style>body { margin: 0; }</style></head><body>
<xo-view get="listUsers"><xo-table cards columns="name,email:E-mail,role,city,country"><button type="button">Edit</button></xo-table></xo-view>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada Lovelace', email: 'ada@analytical.engine', role: 'administrator', city: 'London', country: 'United Kingdom' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
window.ready = true;
</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-table-'));
  await writeFile(join(root, 'index.html'), PAGE());
  await writeFile(join(root, 'mist.html'), PAGE('\n<link rel="stylesheet" href="/@xoong/ui/src/mist.css">'));
  await writeFile(join(root, 'rtl.html'), PAGE('', 'rtl'));
  await writeFile(join(root, 'cards.html'), CARDS);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

const open = async (path) => {
  await page.goto(dev.url + path);
  await page.waitForFunction(() => window.ready && document.querySelector('.xo-actions button'));
};

const place = () => page.evaluate(() => {
  const frame = document.querySelector('.xo-table').getBoundingClientRect();
  const btn = document.querySelector('.xo-actions button').getBoundingClientRect();
  const hit = document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2);
  const scroller = document.querySelector('.xo-table');
  return {
    width: window.innerWidth,
    overflows: scroller.scrollWidth > scroller.clientWidth + 1,
    inside: btn.right <= frame.right + 0.5 && btn.left >= frame.left - 0.5,
    hit: hit ? hit.tagName : '',
  };
});

/**
 * Scroll the country link the way a keyboard focus does (`scroll-padding` on the frame) and report how many
 * pixels of it sit under the actions cell. `focus()` alone does not scroll this frame in WebKit; `scrollIntoView`
 * uses the same padding, and it is synchronous in all three engines.
 */
const focusOverlap = () => page.evaluate(() => {
  const link = document.querySelector('td[data-col="country"] a');
  link.focus();
  link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const a = link.getBoundingClientRect();
  const act = document.querySelector('.xo-actions').getBoundingClientRect();
  const frame = document.querySelector('.xo-table').getBoundingClientRect();
  return {
    overlap: Math.min(a.right, act.right) - Math.max(a.left, act.left),
    inFrame: a.left >= frame.left - 0.5 && a.right <= frame.right + 0.5 && a.width > 0,
  };
});

for (const [name, path] of [['xoong.css', '/'], ['xoong.css and mist.css', '/mist.html']]) {
  describe(`table row actions at 390px (${name})`, () => {
    it('the Edit button is inside the frame, including after the frame scrolls', async () => {
      await open(path);
      const before = await place();
      expect(before.width).toBe(390);
      expect(before.overflows).toBe(true);
      expect(before.inside).toBe(true);
      expect(before.hit).toBe('BUTTON');
      await page.evaluate(() => { document.querySelector('.xo-table').scrollLeft = 160; });
      const after = await place();
      expect(after.inside).toBe(true);
      expect(after.hit).toBe('BUTTON');
    });

    it('a focused control beside the actions cell is not covered by it', async () => {
      await open(path);
      const at = await focusOverlap();
      expect(at.inFrame).toBe(true);
      expect(at.overlap).toBeLessThanOrEqual(0);
    });
  });
}

describe('table row actions at 390px, right to left', () => {
  it('a focused control beside the actions cell is not covered by it', async () => {
    await open('/rtl.html');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    const at = await focusOverlap();
    expect(at.inFrame).toBe(true);
    expect(at.overlap).toBeLessThanOrEqual(0);
  });
});

describe('cards at 390px', () => {
  it('the Edit button stays inside the card', async () => {
    await open('/cards.html');
    const at = await place();
    expect(at.width).toBe(390);
    expect(at.inside).toBe(true);
    expect(at.hit).toBe('BUTTON');
  });
});
