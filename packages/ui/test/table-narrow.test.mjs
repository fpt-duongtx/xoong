// Row actions at 390px, in a real browser. The frame is `.xo-table` (overflow-x: auto).
// On current CSS the actions cell is past the right edge, and a pointer drag selects the cell text.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;

const PAGE = (extra = '') => `<!doctype html><html><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">${extra}
<style>body { margin: 0; }</style></head><body>
<xo-view get="listUsers"><xo-table columns="name,email:E-mail,role,city,country" filters="q:Search"><button type="button">Edit</button></xo-table></xo-view>
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

/** Pointer drag from the left of a box to the right. Returns the selection afterwards. */
async function drag(box) {
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.move(box.x + 6, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.max(box.width - 6, 12), box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  return page.evaluate(() => getSelection().toString());
}

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

    it('a pointer drag across a cell leaves the selection empty', async () => {
      await open(path);
      const box = await page.locator('tbody td').first().boundingBox();
      expect(await drag(box)).toBe('');
    });

    it('a double-click on a cell leaves the selection empty', async () => {
      await open(path);
      await page.evaluate(() => getSelection().removeAllRanges());
      await page.dblclick('tbody td');
      expect(await page.evaluate(() => getSelection().toString())).toBe('');
    });

    it('a drag inside the filter field still selects its text', async () => {
      await open(path);
      const input = page.locator('.xo-filters input');
      await input.fill('london bridge');
      const box = await input.boundingBox();
      expect((await drag(box)).length).toBeGreaterThan(0);
    });
  });
}

describe('cards at 390px', () => {
  it('the Edit button stays inside the card', async () => {
    await open('/cards.html');
    const at = await place();
    expect(at.width).toBe(390);
    expect(at.inside).toBe(true);
    expect(at.hit).toBe('BUTTON');
  });
});
