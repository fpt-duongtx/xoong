// The controls in a real browser: the Popover API path (top layer, positioned next to the trigger), real focus and keyboard events.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;
const errors = [];

const PAGE = `<!doctype html><html><head><link rel="stylesheet" href="/@xoong/controls/src/controls.css"></head><body>
<div style="overflow:hidden;height:40px;padding:10px">
  <xo-menu label="Actions"><button xo-menu-trigger>Actions</button><button id="edit">Edit</button><button id="del">Delete</button></xo-menu>
</div>
<button id="tip" xo-tooltip="Save the draft" style="margin-top:80px">Save</button>
<div style="overflow:hidden;height:60px;padding:10px"><xo-combobox id="cb" name="person" label="Person" multiple><option value="1">Ada</option><option value="2">Grace</option><option value="3">Barbara</option></xo-combobox></div>
<xo-tags id="tg" name="kw" label="Keywords"></xo-tags>
<xo-tabs label="Page"><section xo-tab="One"><input id="in1"></section><section xo-tab="Two" id="two"><input id="in2"></section></xo-tabs>
<xo-carousel id="car" label="Cards" items="3" counter dots style="display:block;width:600px;margin-top:20px">
  <article><a href="#a">One</a></article><article><a href="#b">Two</a></article><article><a href="#c">Three</a></article><article><a href="#d">Four</a></article><article><a href="#e">Five</a></article>
</xo-carousel>
<script type="module">import '@xoong/controls'; window.ready = true;</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-controls-'));
  await writeFile(join(root, 'index.html'), PAGE);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true, packages: ['@xoong/controls'] });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(dev.url + '/');
  await page.waitForFunction(() => window.ready && document.querySelector('[role=tablist]'));
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

describe('controls in a browser', () => {
  it('the menu is drawn in the top layer, below its trigger, even inside an overflow:hidden box', async () => {
    await page.click('[xo-menu-trigger]');
    const open = await page.$eval('[role=menu]', (el) => ({ popover: el.matches(':popover-open'), hidden: el.hidden }));
    expect(open).toEqual({ popover: true, hidden: false });
    const { trigger, menu } = await page.evaluate(() => ({
      trigger: document.querySelector('[xo-menu-trigger]').getBoundingClientRect().toJSON(),
      menu: document.querySelector('[role=menu]').getBoundingClientRect().toJSON(),
    }));
    expect(Math.round(menu.top)).toBe(Math.round(trigger.bottom));
    expect(Math.round(menu.left)).toBe(Math.round(trigger.left));
    expect(menu.bottom).toBeGreaterThan(40 + 10); // taller than the clipping box: not clipped
    const at = await page.evaluate(() => { const r = document.querySelector('#del').getBoundingClientRect(); return document.elementFromPoint(r.x + 5, r.y + 5)?.id; });
    expect(at).toBe('del'); // the item is what is on top at its position
  });

  it('keys work with real focus: ArrowDown, Escape back to the trigger', async () => {
    await page.keyboard.press('Escape');
    expect(await page.$eval('[role=menu]', (el) => el.hidden)).toBe(true);
    expect(await page.evaluate(() => document.activeElement.hasAttribute('xo-menu-trigger'))).toBe(true);
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('edit');
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('del');
    await page.keyboard.press('Enter');
    expect(await page.$eval('[role=menu]', (el) => el.hidden)).toBe(true);
  });

  it('the tooltip shows on keyboard focus, above the element, and Escape hides it', async () => {
    await page.focus('#tip');
    await page.waitForSelector('.xo-tooltip:not([hidden])');
    const { tip, target, text } = await page.evaluate(() => ({
      tip: document.querySelector('.xo-tooltip').getBoundingClientRect().toJSON(),
      target: document.querySelector('#tip').getBoundingClientRect().toJSON(),
      text: document.querySelector('.xo-tooltip').textContent,
    }));
    expect(text).toBe('Save the draft');
    expect(tip.bottom).toBeLessThanOrEqual(target.top);
    expect(await page.getAttribute('#tip', 'aria-describedby')).toBe('xo-tooltip');
    await page.keyboard.press('Escape');
    expect(await page.$eval('.xo-tooltip', (el) => el.hidden)).toBe(true);
  });

  it('tabs: arrow keys move focus and selection, the hidden panel is not reachable', async () => {
    await page.focus('[role=tab][aria-selected=true]');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement.textContent)).toBe('Two');
    expect(await page.$eval('#two', (el) => el.hidden)).toBe(false);
    expect(await page.$eval('#in1', (el) => el.checkVisibility())).toBe(false);
    expect(errors).toEqual([]);
  });

  it('combobox: the list is in the top layer under the field, picking works with the keyboard, chips and the value follow', async () => {
    await page.focus('#cb .xo-combobox-input');
    await page.keyboard.press('ArrowDown');
    expect(await page.$eval('#cb [role=listbox]', (el) => el.matches(':popover-open'))).toBe(true);
    const { box, list } = await page.evaluate(() => ({
      box: document.querySelector('#cb .xo-combobox-box').getBoundingClientRect().toJSON(),
      list: document.querySelector('#cb [role=listbox]').getBoundingClientRect().toJSON(),
    }));
    expect(Math.round(list.top)).toBe(Math.round(box.bottom));
    expect(Math.round(list.width)).toBe(Math.round(box.width));
    expect(list.bottom).toBeGreaterThan(60 + 10); // taller than the clipping box: not clipped
    await page.keyboard.press('Enter'); // Ada; the highlight returns to the first remaining option
    await page.keyboard.press('Enter'); // Grace
    expect(await page.$eval('#cb', (el) => el.value)).toEqual(['1', '2']);
    expect(await page.$$eval('#cb .xo-chip', (c) => c.map((x) => x.firstChild.textContent))).toEqual(['Ada', 'Grace']);
    await page.keyboard.press('Escape');
    expect(await page.$eval('#cb [role=listbox]', (el) => el.hidden)).toBe(true);
    await page.keyboard.press('Backspace');
    expect(await page.$eval('#cb', (el) => el.value)).toEqual(['1']);
  });

  it('tags: typing and Enter or comma make chips; the pointer picks a suggestion', async () => {
    await page.click('#tg .xo-combobox-input');
    await page.keyboard.type('one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('two,');
    expect(await page.$eval('#tg', (el) => el.value)).toEqual(['one', 'two']);
    await page.click('#cb .xo-combobox-input');
    await page.click('#cb [role=option]');
    expect(await page.$eval('#cb', (el) => el.value)).toEqual(['1', '2']);
    expect(errors).toEqual([]);
  });

  describe('carousel', () => {
    const state = () => page.evaluate(() => {
      const el = document.querySelector('#car');
      const track = el.querySelector('.xo-carousel-track');
      return {
        index: el.index, scroll: Math.round(track.scrollLeft), count: el.querySelector('.xo-carousel-count').textContent,
        inert: [...track.children].map((c) => c.inert), width: [...track.children].map((c) => Math.round(c.getBoundingClientRect().width)),
        prev: el.querySelector('.xo-carousel-prev').disabled, next: el.querySelector('.xo-carousel-next').disabled, dots: el.querySelectorAll('.xo-carousel-dots button').length,
      };
    });
    const settled = (index) => page.waitForFunction((i) => { const el = document.querySelector('#car'); const t = el.querySelector('.xo-carousel-track'); return el.index === i && Math.abs(t.scrollLeft - (t.children[i].offsetLeft - t.children[0].offsetLeft)) < 3; }, index);

    it('shows three cards at once, one position per slide that can lead, and keeps the hidden ones out of reach', async () => {
      const s = await state();
      expect(s.width.every((w) => w > 180 && w < 200)).toBe(true); // (600 - 2 gaps of 16) / 3
      expect(s.inert).toEqual([false, false, false, true, true]);
      expect(s.dots).toBe(3); // 5 slides, 3 visible: slide 1, 2 or 3 can be the first
      expect(s.count).toBe('1 / 5');
      expect([s.prev, s.next]).toEqual([true, false]);
    });

    it('Next scrolls one slide and snaps; the slide that came into view is reachable, the one that left is not', async () => {
      await page.click('#car .xo-carousel-next');
      await settled(1);
      await page.waitForFunction(() => document.querySelector('#car .xo-carousel-track').children[0].inert); // the slide that left is put out of reach when the scroll ends
      const s = await state();
      expect(s.count).toBe('2 / 5');
      expect(s.inert).toEqual([true, false, false, false, true]);
      expect(s.prev).toBe(false);
    });

    it('swiping (a scroll by the person) updates the position; at the end Next is off', async () => {
      await page.$eval('#car .xo-carousel-track', (t) => { t.style.scrollBehavior = 'auto'; t.scrollLeft = t.scrollWidth; });
      await page.waitForFunction(() => document.querySelector('#car').index === 2 && document.querySelector('#car .xo-carousel-track').children[1].inert);
      const s = await state();
      expect(s.count).toBe('3 / 5');
      expect([s.prev, s.next]).toEqual([false, true]);
      expect(s.inert).toEqual([true, true, false, false, false]);
    });

    it('the arrow keys on the scroll area move, and a card peeks when items is fractional', async () => {
      await page.$eval('#car .xo-carousel-track', (t) => { t.scrollLeft = 0; });
      await page.waitForFunction(() => document.querySelector('#car').index === 0);
      await page.focus('#car .xo-carousel-track');
      await page.keyboard.press('ArrowRight');
      await settled(1);
      await page.$eval('#car', (el) => el.setAttribute('items', '1.25'));
      await page.waitForFunction(() => document.querySelector('#car .xo-carousel-dots').children.length === 5 && document.querySelector('#car .xo-carousel-track').children[2].inert);
      const s = await state();
      expect(s.dots).toBe(5); // one slide in view: every slide can lead
      expect(s.inert[2]).toBe(true); // two ahead: out of view
      await page.$eval('#car', (el) => el.goTo(0));
      await settled(0);
      await page.waitForFunction(() => { const c = document.querySelector('#car .xo-carousel-track').children; return !c[0].inert && !c[1].inert && c[2].inert; });
      expect((await state()).inert.slice(0, 3)).toEqual([false, false, true]); // the second one peeks and stays usable
      await page.$eval('#car', (el) => el.setAttribute('items', '3'));
      expect(errors).toEqual([]);
    });
  });
});
