// Row actions at 390px, in a real browser. The frame is `.xo-table` (overflow-x: auto).
// Without a pinned column the Edit button sits past the right edge. With the column pinned, focusing
// or clicking that button must not scroll the frame. A page or a nested scroller must still reveal
// it. Tabbing must not leave a cell entirely outside the frame. A cell already inside the frame can
// sit under the sticky column; the browser does not scroll that.
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

/** Nine links of different lengths, then Edit, Actions and Delete. The widths come from the text, so a font change cannot be papered over with a fixed link width. */
const CELLS = (dir) => `<!doctype html><html dir="${dir}"><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<style>body { margin: 0; }</style></head><body>
<xo-view get="listUsers"><xo-table columns="c1,c2,c3,c4,c5,c6,c7,c8,c9">
<a slot="c1" href="#c1">{c1}</a><a slot="c2" href="#c2">{c2}</a><a slot="c3" href="#c3">{c3}</a>
<a slot="c4" href="#c4">{c4}</a><a slot="c5" href="#c5">{c5}</a><a slot="c6" href="#c6">{c6}</a>
<a slot="c7" href="#c7">{c7}</a><a slot="c8" href="#c8">{c8}</a><a slot="c9" href="#c9">{c9}</a>
<button type="button">Edit</button><button type="button">Actions</button><button type="button">Delete</button>
</xo-table></xo-view>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, c1: 'North', c2: 'A very long city name indeed', c3: 'x', c4: 'United Kingdom of notes', c5: 'Hi', c6: 'administrator', c7: 'QQ', c8: 'Field', c9: 'Lead' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
window.ready = true;
</script></body></html>`;

/** The page is wider than the window and the frame itself does not overflow. Edit, Actions and Delete sit at the inline end, off the window. */
const WIDE = `<!doctype html><html><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<style>body { margin: 0; } html, body { width: 1900px; }</style></head><body>
<xo-view get="listUsers"><xo-table columns="name"><span slot="name">{name}</span><button type="button">Edit</button><button type="button">Actions</button><button type="button">Delete</button></xo-table></xo-view>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
window.ready = true;
</script></body></html>`;

/** A 300px scroller around an 800px table. The frame fills the inner box, so the wrapper is the scroller that has to move. */
const NEST = `<!doctype html><html><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<style>body { margin: 0; }</style></head><body>
<div id="wrap" style="width: 300px; overflow-x: auto;"><div style="width: 800px;">
<xo-view get="listUsers"><xo-table columns="name"><span slot="name">{name}</span><button type="button">Edit</button><button type="button">Actions</button><button type="button">Delete</button></xo-table></xo-view>
</div></div>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
window.ready = true;
</script></body></html>`;

/** The table starts below a 500px viewport. scrollIntoView({ block: 'nearest' }) has to bring Edit onto the screen. */
const BELOW = `<!doctype html><html><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<style>body { margin: 0; }</style></head><body>
<div style="height: 900px;"></div>
<xo-view get="listUsers"><xo-table columns="name"><span slot="name">{name}</span><button type="button">Edit</button></xo-table></xo-view>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
});
window.ready = true;
</script></body></html>`;

/** The generated header carries xo-t="xoong.table.actions". The hand-written table's last header hides a different label, and its actions header is not last. */
const HEADERS = `<!doctype html><html><head>
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<style>body { margin: 0; }</style></head><body>
<xo-view get="listUsers"><xo-table columns="name"><span slot="name">{name}</span><button type="button">Edit</button></xo-table></xo-view>
<div class="xo-table" id="hand"><table>
<thead><tr><th>Name</th><th class="xo-actions"><span class="xo-visually-hidden">Do</span></th><th><span class="xo-visually-hidden">Secret</span></th></tr></thead>
<tbody><tr><td>Ada</td><td class="xo-actions"><button type="button">Edit</button></td><td>notes</td></tr></tbody>
</table></div>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({
  api: { version: 1, operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'object', props: { items: { t: 'array', items: { t: 'object' } } } } } } },
  fetch: async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada' }] }), { status: 200, headers: { 'content-type': 'application/json' } }),
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
  await writeFile(join(root, 'wide.html'), WIDE);
  await writeFile(join(root, 'nest.html'), NEST);
  await writeFile(join(root, 'below.html'), BELOW);
  await writeFile(join(root, 'headers.html'), HEADERS);
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
 * Scroll the country link the way a keyboard focus does. Edit, Actions and Delete together are wider than
 * the frame's padding, so the link can sit under that cell. It still has to stay inside the frame.
 * `scrollIntoView` is synchronous in all three engines.
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
  it(`tabbing a row does not leave a cell entirely outside the frame (${dir})`, async () => {
    await open(path, 390);
    const count = await page.locator('tbody tr :is(a, button)').count();
    expect(count).toBe(12);
    await page.locator('tbody a').first().focus();
    const seen = [];
    for (let i = 0; i < count; i++) {
      seen.push(await page.evaluate(() => {
        const el = document.activeElement;
        const rect = el.getBoundingClientRect();
        const frame = document.querySelector('.xo-table').getBoundingClientRect();
        const visible = Math.min(rect.right, frame.right) - Math.max(rect.left, frame.left);
        return { text: el.textContent, visible };
      }));
      if (i < count - 1) await page.keyboard.press('Tab');
    }
    expect(seen.map((cell) => cell.text)).toEqual([
      'North', 'A very long city name indeed', 'x', 'United Kingdom of notes', 'Hi',
      'administrator', 'QQ', 'Field', 'Lead', 'Edit', 'Actions', 'Delete',
    ]);
    for (const cell of seen) expect(cell.visible, cell.text).toBeGreaterThan(1);
  });
}

describe('a pinned action stays reachable from an ancestor scroller', () => {
  it('the page scrolls Edit into the window, and the frame stays put', async () => {
    await open('/wide.html', 1280);
    const read = () => page.evaluate(() => {
      const button = document.querySelector('.xo-actions button');
      const rect = button.getBoundingClientRect();
      const frame = document.querySelector('.xo-table');
      return {
        scrollX: Math.round(window.scrollX),
        frame: Math.round(frame.scrollLeft),
        overflows: frame.scrollWidth > frame.clientWidth + 1,
        inWindow: rect.left >= -1 && rect.right <= window.innerWidth + 1 && rect.width > 0,
      };
    });
    const start = await read();
    expect(start.overflows).toBe(false);
    expect(start.scrollX).toBe(0);
    expect(start.inWindow).toBe(false);
    await page.evaluate(() => document.querySelector('.xo-actions button').focus());
    const focused = await read();
    expect(focused.inWindow, `scrollX ${focused.scrollX}`).toBe(true);
    expect(focused.scrollX).toBeGreaterThan(0);
    expect(focused.frame).toBe(0);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector('.xo-actions button').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    const scrolled = await read();
    expect(scrolled.inWindow, `scrollX ${scrolled.scrollX}`).toBe(true);
    expect(scrolled.scrollX).toBeGreaterThan(0);
    expect(scrolled.frame).toBe(0);
  });

  it('a nested scroller reveals Edit, and the frame stays put', async () => {
    await open('/nest.html', 1280);
    const read = () => page.evaluate(() => {
      const button = document.querySelector('.xo-actions button');
      const rect = button.getBoundingClientRect();
      const wrap = document.querySelector('#wrap');
      const box = wrap.getBoundingClientRect();
      return {
        wrap: Math.round(wrap.scrollLeft),
        frame: Math.round(document.querySelector('.xo-table').scrollLeft),
        inWrap: rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.width > 0,
      };
    });
    const start = await read();
    expect(start.wrap).toBe(0);
    expect(start.inWrap).toBe(false);
    await page.evaluate(() => document.querySelector('.xo-actions button').focus());
    const focused = await read();
    expect(focused.inWrap, `wrap ${focused.wrap}`).toBe(true);
    expect(focused.wrap).not.toBe(0);
    expect(focused.frame).toBe(0);
    await page.evaluate(() => {
      document.querySelector('#wrap').scrollLeft = 0;
      document.querySelector('.xo-actions button').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    const scrolled = await read();
    expect(scrolled.inWrap, `wrap ${scrolled.wrap}`).toBe(true);
    expect(scrolled.wrap).not.toBe(0);
    expect(scrolled.frame).toBe(0);
  });

  it('scrollIntoView keeps Edit on screen when the table starts below the fold', async () => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto(dev.url + '/below.html');
    await page.waitForFunction(() => window.ready && document.querySelector('.xo-actions button'));
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector('.xo-actions button').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    const at = await page.evaluate(() => {
      const rect = document.querySelector('.xo-actions button').getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: window.innerHeight };
    });
    expect(at.top, `top ${at.top}`).toBeGreaterThanOrEqual(-1);
    expect(at.bottom, `bottom ${at.bottom}`).toBeLessThanOrEqual(at.height + 1);
  });
});

describe('which actions header is pinned', () => {
  it('pins the generated actions label, and a hand-written th.xo-actions, not a different hidden last header', async () => {
    await open('/headers.html', 800);
    const pinned = await page.evaluate(() => {
      const at = (selector) => getComputedStyle(document.querySelector(selector)).position;
      return {
        generated: at('xo-view thead th:last-child'),
        marked: at('#hand th.xo-actions'),
        other: at('#hand th:last-child'),
      };
    });
    expect(pinned.generated).toBe('sticky');
    expect(pinned.marked).toBe('sticky');
    expect(pinned.other).toBe('static');
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
