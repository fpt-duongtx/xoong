// Opt-in sticky columns. With no class, the table matches main: the actions cell is not
// sticky, borders collapse, and the frame sets no scroll padding. xo-sticky-start and
// xo-sticky-end pin one column to the inline edge. The other cells scroll with the table.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;

const PAGE = (dir) => `<!doctype html><html dir="${dir}"><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<style>body { margin: 0; }</style></head><body>
<xo-view get="listUsers"><xo-table columns="name,note"><span slot="name">{name}</span><span slot="note">{note}</span><button type="button">Edit</button></xo-table></xo-view>
<div class="xo-table" id="plain"><table>
<thead><tr><th>Name</th><th>Note</th><th class="xo-actions">Actions</th></tr></thead>
<tbody><tr><td>Ada</td><td class="note">${'M'.repeat(80)}</td><td class="xo-actions"><button type="button">Edit</button></td></tr></tbody>
</table></div>
<div class="xo-table" id="pin"><table>
<thead><tr><th class="xo-sticky-start">Name</th><th>Note</th><th class="xo-sticky-end">Role</th></tr></thead>
<tbody><tr>
<td class="xo-sticky-start"><a href="#name">Ada</a></td>
<td class="note">${'M'.repeat(400)}</td>
<td class="xo-sticky-end"><button type="button">Edit</button></td>
</tr></tbody>
</table></div>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada', note: '${'M'.repeat(80)}' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
window.ready = true;
</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-sticky-'));
  await writeFile(join(root, 'ltr.html'), PAGE('ltr'));
  await writeFile(join(root, 'rtl.html'), PAGE('rtl'));
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

const open = async (dir) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${dev.url}/${dir}.html`);
  await page.waitForFunction(() => window.ready && document.querySelector('#pin td.xo-sticky-end button'));
};

/** Scroll part way. A full scroll would park the last column on the inline end even when it is not sticky. RTL scrollLeft is negative. */
const scrollFrame = () => page.evaluate(() => {
  const frame = document.querySelector('#pin');
  const before = frame.scrollLeft;
  frame.scrollLeft = 240;
  if (frame.scrollLeft === before) frame.scrollLeft = -240;
  return frame.scrollLeft;
});

const place = () => page.evaluate(() => {
  const frame = document.querySelector('#pin');
  const fr = frame.getBoundingClientRect();
  const box = (sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { left: r.left, right: r.right };
  };
  return {
    scroll: frame.scrollLeft,
    frameLeft: fr.left,
    frameRight: fr.right,
    start: box('#pin td.xo-sticky-start'),
    end: box('#pin td.xo-sticky-end'),
    headStart: box('#pin th.xo-sticky-start'),
    headEnd: box('#pin th.xo-sticky-end'),
    note: box('#pin td.note'),
  };
});

const near = (a, b) => Math.abs(a - b) <= 2;

for (const dir of ['ltr', 'rtl']) {
  describe(`sticky columns, ${dir}`, () => {
    it('a generated table and an unmarked actions cell do not stick', async () => {
      await open(dir);
      const at = await page.evaluate(() => {
        const generated = document.querySelector('xo-view .xo-table');
        const plain = document.querySelector('#plain');
        return {
          actions: getComputedStyle(generated.querySelector('td.xo-actions')).position,
          hand: getComputedStyle(plain.querySelector('td.xo-actions')).position,
          collapse: getComputedStyle(plain.querySelector('table')).borderCollapse,
          padding: getComputedStyle(generated).scrollPaddingInlineEnd,
        };
      });
      expect(at.actions).not.toBe('sticky');
      expect(at.hand).not.toBe('sticky');
      expect(at.collapse).toBe('collapse');
      expect(at.padding).toBe('auto');
    });

    it('the start column, including its header, stays at the inline start', async () => {
      await open(dir);
      const before = await place();
      const scroll = await scrollFrame();
      expect(scroll).not.toBe(0);
      const after = await place();
      expect(Math.abs(after.note.left - before.note.left)).toBeGreaterThan(20);
      const startEdge = dir === 'rtl' ? 'right' : 'left';
      const frameEdge = dir === 'rtl' ? after.frameRight : after.frameLeft;
      expect(near(after.start[startEdge], frameEdge)).toBe(true);
      expect(near(after.headStart[startEdge], frameEdge)).toBe(true);
    });

    it('the end column, including its header, stays at the inline end', async () => {
      await open(dir);
      await scrollFrame();
      const after = await place();
      const endEdge = dir === 'rtl' ? 'left' : 'right';
      const frameEdge = dir === 'rtl' ? after.frameLeft : after.frameRight;
      expect(near(after.end[endEdge], frameEdge)).toBe(true);
      expect(near(after.headEnd[endEdge], frameEdge)).toBe(true);
    });

    it('focusing or clicking a control in a sticky column leaves the frame where it is', async () => {
      await open(dir);
      const reset = () => page.evaluate(() => { document.querySelector('#pin').scrollLeft = 0; document.activeElement?.blur(); });
      await reset();
      await page.evaluate(() => document.querySelector('#pin td.xo-sticky-end button').focus());
      expect(await page.evaluate(() => document.querySelector('#pin').scrollLeft)).toBe(0);
      await reset();
      await page.evaluate(() => document.querySelector('#pin td.xo-sticky-start a').focus());
      expect(await page.evaluate(() => document.querySelector('#pin').scrollLeft)).toBe(0);
      await reset();
      const button = page.locator('#pin td.xo-sticky-end button');
      const box = await button.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      expect(await page.evaluate(() => document.querySelector('#pin').scrollLeft)).toBe(0);
    });
  });
}
