// Row actions at 390px, in a real browser. The frame is `.xo-table` (overflow-x: auto).
// Without a pinned column the Edit button sits past the right edge. With the column pinned, focusing
// or clicking that button must not scroll the frame, and tabbing a row must keep each cell fully
// on screen and clear of the actions cell.
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
<xo-view get="listUsers"><xo-table columns="name,email:E-mail,role,city,country,office" filters="q:Search"><a slot="country" href="#country">{country}</a><button type="button">Edit</button><button type="button">Actions</button><button type="button">Delete</button></xo-table></xo-view>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['q'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada Lovelace', email: 'ada@analytical.engine', role: 'administrator', city: 'London', country: 'United Kingdom', office: '${'M'.repeat(400)}' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
window.ready = true;
</script></body></html>`;

/** Nine links and Edit. `coordinator` is wide enough that a flat 20rem of padding leaves it partly outside a 390px frame, and narrow enough to clear a single Edit button once the padding is capped at 40%. */
const CELLS = (dir) => `<!doctype html><html dir="${dir}"><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<style>body { margin: 0; }</style></head><body>
<xo-view get="listUsers"><xo-table columns="c1,c2,c3,c4,c5,c6,c7,c8,c9">
<a slot="c1" href="#c1">{c1}</a><a slot="c2" href="#c2">{c2}</a><a slot="c3" href="#c3">{c3}</a>
<a slot="c4" href="#c4">{c4}</a><a slot="c5" href="#c5">{c5}</a><a slot="c6" href="#c6">{c6}</a>
<a slot="c7" href="#c7">{c7}</a><a slot="c8" href="#c8">{c8}</a><a slot="c9" href="#c9">{c9}</a>
<button type="button">Edit</button>
</xo-table></xo-view>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, c1: 'North campus', c2: 'Ada Lovelace', c3: 'Greater London', c4: 'Field notes', c5: 'Case owner', c6: 'coordinator', c7: 'Duty manager', c8: 'West campus', c9: 'Project lead' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
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
  await writeFile(join(root, 'cells.html'), CELLS('ltr'));
  await writeFile(join(root, 'cells-rtl.html'), CELLS('rtl'));
  await writeFile(join(root, 'cards.html'), CARDS);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

const open = async (path, width = 390) => {
  await page.setViewportSize({ width, height: 800 });
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
 * Scroll the country link the way a keyboard focus does (`scroll-padding` on the frame). Edit, Actions and
 * Delete together are wider than 40% of a 390px frame, so the link can sit under that cell; it still has to
 * stay inside the frame. `scrollIntoView` uses the padding and is synchronous in all three engines.
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

    it('a focused control beside a wide actions cell stays inside the frame', async () => {
      await open(path);
      const at = await focusOverlap();
      expect(at.inFrame).toBe(true);
    });
  });
}

describe('table row actions at 390px, right to left', () => {
  it('a focused control beside a wide actions cell stays inside the frame', async () => {
    await open('/rtl.html');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    const at = await focusOverlap();
    expect(at.inFrame).toBe(true);
  });
});

for (const [dir, path] of [['left to right', '/'], ['right to left', '/rtl.html']]) {
  for (const width of [390, 1280]) {
    it(`focusing or clicking Edit leaves the frame at scrollLeft 0 (${dir}, ${width}px)`, async () => {
      await open(path, width);
      const before = await page.evaluate(() => {
        const scroller = document.querySelector('.xo-table');
        scroller.scrollLeft = 0;
        return { scroll: scroller.scrollLeft, overflows: scroller.scrollWidth > scroller.clientWidth + 1 };
      });
      expect(before.overflows).toBe(true);
      expect(before.scroll).toBe(0);
      const button = page.locator('.xo-actions button').first();
      const box = await button.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      expect(await page.evaluate(() => document.querySelector('.xo-table').scrollLeft)).toBe(0);
      await page.evaluate(() => { document.activeElement.blur(); document.querySelector('.xo-table').scrollLeft = 0; });
      await button.focus();
      expect(await page.evaluate(() => document.querySelector('.xo-table').scrollLeft)).toBe(0);
    });
  }
}

for (const [dir, path] of [['left to right', '/cells.html'], ['right to left', '/cells-rtl.html']]) {
  it(`tabbing a row keeps every cell fully visible and clear of the actions (${dir})`, async () => {
    await open(path, 390);
    const count = await page.locator('tbody tr :is(a, button)').count();
    expect(count).toBe(10);
    await page.locator('tbody a').first().focus();
    const seen = [];
    for (let i = 0; i < count; i++) {
      seen.push(await page.evaluate(() => {
        const el = document.activeElement;
        const rect = el.getBoundingClientRect();
        const frame = document.querySelector('.xo-table').getBoundingClientRect();
        const actions = document.querySelector('.xo-actions').getBoundingClientRect();
        return {
          text: el.textContent,
          fully: rect.left >= frame.left - 0.5 && rect.right <= frame.right + 0.5 && rect.width > 0,
          overlap: Math.min(rect.right, actions.right) - Math.max(rect.left, actions.left),
          inActions: !!el.closest('td.xo-actions'),
        };
      }));
      if (i < count - 1) await page.keyboard.press('Tab');
    }
    expect(seen.map((cell) => cell.text)).toEqual([
      'North campus', 'Ada Lovelace', 'Greater London', 'Field notes', 'Case owner',
      'coordinator', 'Duty manager', 'West campus', 'Project lead', 'Edit',
    ]);
    for (const cell of seen) {
      expect(cell.fully, cell.text).toBe(true);
      if (!cell.inActions) expect(cell.overlap, cell.text).toBeLessThanOrEqual(0);
    }
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
