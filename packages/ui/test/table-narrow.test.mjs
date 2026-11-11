// Opt-in sticky columns. With no class and no sticky attribute, the table matches main:
// the actions cell is not sticky, borders collapse, and the frame sets no scroll padding.
// xo-sticky-start and xo-sticky-end pin one column. sticky="start", sticky="end" and
// sticky="start end" on a frame that stays in the tree pin the first cell, the last cell,
// or both. A generated <xo-table> drops the attribute with the host.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;
const wide = 'M'.repeat(400);

const PAGE = (dir) => `<!doctype html><html dir="${dir}"><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<style>body { margin: 0; }</style></head><body>
<xo-view get="listUsers"><xo-table columns="name,note"><span slot="name">{name}</span><span slot="note">{note}</span><button type="button">Edit</button></xo-table></xo-view>
<div id="gen-end"><xo-view get="listUsers"><xo-table columns="name,note" sticky="end"><span slot="note">{note}</span><button type="button">Edit</button></xo-table></xo-view></div>
<div id="gen-check"><xo-view get="listUsers"><xo-table columns="name,note" selectable sticky="start"><span slot="note">{note}</span><button type="button">Edit</button></xo-table></xo-view></div>
<div class="xo-table" id="plain"><table>
<thead><tr><th>Name</th><th>Note</th><th class="xo-actions">Actions</th></tr></thead>
<tbody><tr><td>Ada</td><td class="note">${'M'.repeat(80)}</td><td class="xo-actions"><button type="button">Edit</button></td></tr></tbody>
</table></div>
<div class="xo-table" id="pin"><table>
<thead><tr><th class="xo-sticky-start">Name</th><th>Note</th><th class="xo-sticky-end">Role</th></tr></thead>
<tbody><tr>
<td class="xo-sticky-start"><a href="#name">Ada</a></td>
<td class="note">${wide}</td>
<td class="xo-sticky-end"><button type="button">Edit</button></td>
</tr></tbody>
</table></div>
<div class="xo-table" id="end" sticky="end"><table>
<thead><tr><th>Name</th><th>Note</th><th>Role</th></tr></thead>
<tbody><tr>
<td class="name">Ada</td>
<td class="note">${wide}</td>
<td><button type="button">Edit</button></td>
</tr></tbody>
</table></div>
<div class="xo-table" id="both" sticky="start end"><table>
<thead><tr><th>Name</th><th>Note</th><th>Role</th></tr></thead>
<tbody><tr>
<td><a href="#name">Ada</a></td>
<td class="note">${wide}</td>
<td><button type="button">Edit</button></td>
</tr></tbody>
</table></div>
<div class="xo-table" id="check" sticky="start"><table>
<thead><tr><th><input type="checkbox" aria-label="Select all rows"></th><th>Name</th><th>Note</th></tr></thead>
<tbody><tr>
<td><input type="checkbox" aria-label="Select row"></td>
<td class="name">Ada</td>
<td class="note">${wide}</td>
</tr></tbody>
</table></div>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada', note: '${wide}' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
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
  await page.waitForFunction(() => window.ready
    && document.querySelector('#pin td.xo-sticky-end button')
    && document.querySelector('#gen-end td.xo-actions button')
    && document.querySelector('#gen-check tbody td input[type=checkbox]'));
};

/** Scroll part way. A full scroll would park the last column on the inline end even when it is not sticky. RTL scrollLeft is negative. */
const scrollFrame = (id = 'pin') => page.evaluate((id) => {
  const frame = document.getElementById(id);
  const before = frame.scrollLeft;
  frame.scrollLeft = before + 240;
  if (Math.abs(frame.scrollLeft - before) < 20) frame.scrollLeft = before - 240;
  return frame.scrollLeft;
}, id);

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

const edges = (id) => page.evaluate((id) => {
  const frame = document.getElementById(id);
  const fr = frame.getBoundingClientRect();
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right };
  };
  const row = frame.querySelector('tbody tr');
  const head = frame.querySelector('thead tr');
  return {
    frameLeft: fr.left,
    frameRight: fr.right,
    first: box(row.firstElementChild),
    second: box(row.children[1]),
    last: box(row.lastElementChild),
    headFirst: box(head.firstElementChild),
    headLast: box(head.lastElementChild),
    note: box(frame.querySelector('td.note')),
    collapse: getComputedStyle(frame.querySelector('table')).borderCollapse,
    firstPos: getComputedStyle(row.firstElementChild).position,
    lastPos: getComputedStyle(row.lastElementChild).position,
    headFirstPos: getComputedStyle(head.firstElementChild).position,
    headLastPos: getComputedStyle(head.lastElementChild).position,
    pad: getComputedStyle(frame).scrollPaddingInlineEnd,
  };
}, id);

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

    it('a generated sticky attribute is dropped, so the checkbox stays the first cell and nothing sticks', async () => {
      await open(dir);
      const at = await page.evaluate(() => {
        const end = document.querySelector('#gen-end .xo-table');
        const check = document.querySelector('#gen-check .xo-table');
        const row = check.querySelector('tbody tr');
        return {
          endHost: !!document.querySelector('#gen-end xo-table'),
          endSticky: end.getAttribute('sticky'),
          endPos: getComputedStyle(end.querySelector('td.xo-actions')).position,
          endCollapse: getComputedStyle(end.querySelector('table')).borderCollapse,
          endPad: getComputedStyle(end).scrollPaddingInlineEnd,
          checkSticky: check.getAttribute('sticky'),
          firstIsCheck: !!row.firstElementChild.querySelector('input[type=checkbox]'),
          nameIsFirst: row.firstElementChild.hasAttribute('data-col'),
          checkPos: getComputedStyle(row.firstElementChild).position,
          namePos: getComputedStyle(check.querySelector('td[data-col=name]')).position,
          headCheck: !!check.querySelector('thead tr').firstElementChild.querySelector('input[type=checkbox]'),
        };
      });
      expect(at.endHost).toBe(false);
      expect(at.endSticky).toBeNull();
      expect(at.endPos).not.toBe('sticky');
      expect(at.endCollapse).toBe('collapse');
      expect(at.endPad).toBe('auto');
      expect(at.checkSticky).toBeNull();
      expect(at.firstIsCheck).toBe(true);
      expect(at.headCheck).toBe(true);
      expect(at.nameIsFirst).toBe(false);
      expect(at.checkPos).not.toBe('sticky');
      expect(at.namePos).not.toBe('sticky');
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

    it('sticky=end keeps the last cell and its header on the inline end', async () => {
      await open(dir);
      const before = await edges('end');
      const scroll = await scrollFrame('end');
      expect(scroll).not.toBe(0);
      const after = await edges('end');
      expect(Math.abs(after.first.left - before.first.left)).toBeGreaterThan(20);
      const endEdge = dir === 'rtl' ? 'left' : 'right';
      const frameEdge = dir === 'rtl' ? after.frameLeft : after.frameRight;
      expect(near(after.last[endEdge], frameEdge)).toBe(true);
      expect(near(after.headLast[endEdge], frameEdge)).toBe(true);
      expect(after.lastPos).toBe('sticky');
      expect(after.headLastPos).toBe('sticky');
      expect(after.firstPos).not.toBe('sticky');
      expect(after.collapse).toBe('separate');
      expect(after.pad).toBe('auto');
    });

    it('sticky="start end" keeps the first and last cells, including their headers', async () => {
      await open(dir);
      const before = await edges('both');
      const scroll = await scrollFrame('both');
      expect(scroll).not.toBe(0);
      const after = await edges('both');
      expect(Math.abs(after.note.left - before.note.left)).toBeGreaterThan(20);
      const startEdge = dir === 'rtl' ? 'right' : 'left';
      const startFrame = dir === 'rtl' ? after.frameRight : after.frameLeft;
      const endEdge = dir === 'rtl' ? 'left' : 'right';
      const endFrame = dir === 'rtl' ? after.frameLeft : after.frameRight;
      expect(near(after.first[startEdge], startFrame)).toBe(true);
      expect(near(after.headFirst[startEdge], startFrame)).toBe(true);
      expect(near(after.last[endEdge], endFrame)).toBe(true);
      expect(near(after.headLast[endEdge], endFrame)).toBe(true);
      expect(after.firstPos).toBe('sticky');
      expect(after.lastPos).toBe('sticky');
      expect(after.collapse).toBe('separate');
    });

    it('sticky=start sticks the checkbox column, and the data column scrolls', async () => {
      await open(dir);
      const before = await edges('check');
      const scroll = await scrollFrame('check');
      expect(scroll).not.toBe(0);
      const after = await edges('check');
      expect(Math.abs(after.second.left - before.second.left)).toBeGreaterThan(20);
      const startEdge = dir === 'rtl' ? 'right' : 'left';
      const frameEdge = dir === 'rtl' ? after.frameRight : after.frameLeft;
      expect(near(after.first[startEdge], frameEdge)).toBe(true);
      expect(near(after.headFirst[startEdge], frameEdge)).toBe(true);
      expect(after.firstPos).toBe('sticky');
      expect(after.headFirstPos).toBe('sticky');
      const namePos = await page.evaluate(() => getComputedStyle(document.querySelector('#check td.name')).position);
      expect(namePos).not.toBe('sticky');
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

    it('focusing or clicking the sticky=end control leaves that frame where it is', async () => {
      await open(dir);
      const reset = () => page.evaluate(() => { document.getElementById('end').scrollLeft = 0; document.activeElement?.blur(); });
      await reset();
      await page.evaluate(() => document.querySelector('#end td button').focus());
      expect(await page.evaluate(() => document.getElementById('end').scrollLeft)).toBe(0);
      await reset();
      const button = page.locator('#end td button');
      const box = await button.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      expect(await page.evaluate(() => document.getElementById('end').scrollLeft)).toBe(0);
    });
  });
}
