// xo-tooltip in a real browser: drawn fixed in the top layer without touching its element, above and reachable inside a modal dialog, flips at the
// edge of the viewport, follows a scroll, and the first Escape closes only the tooltip.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;
const errors = [];

const PAGE = `<!doctype html><html><head><link rel="stylesheet" href="/@xoong/controls/src/controls.css"></head><body xo-tooltip-delay="150">
<div id="clip" style="overflow:hidden;height:40px;padding:10px;margin-top:60px"><button id="clipped" xo-tooltip="Clipped parent, still visible">Clipped</button></div>
<button id="top" xo-tooltip="Near the top edge" style="position:absolute;top:0;left:20px">Top</button>
<button id="right" xo-tooltip="A tooltip wider than the room left at the right edge of the viewport" style="position:absolute;top:200px;right:0" xo-tooltip-placement="bottom">Right</button>
<button id="side" xo-tooltip="On the right" xo-tooltip-placement="right" style="position:absolute;top:300px;left:100px">Side</button>
<button id="slow" xo-tooltip="Slow" xo-tooltip-delay="600" style="position:absolute;top:360px;left:100px">Slow</button>
<button id="open">Open</button>
<dialog id="dlg" style="padding:2rem"><p>Dialog</p><button id="inside" xo-tooltip="Inside the modal dialog" xo-tooltip-delay="0">Inside</button> <button id="close">Close</button></dialog>
<div style="height:2000px"></div>
<script type="module">import '@xoong/controls'; document.querySelector('#open').onclick = () => document.querySelector('#dlg').showModal(); document.querySelector('#close').onclick = () => document.querySelector('#dlg').close(); window.ready = true;</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-tooltip-'));
  await writeFile(join(root, 'index.html'), PAGE);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true, packages: ['@xoong/controls'] });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(dev.url + '/');
  await page.waitForFunction(() => window.ready);
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

const tipBox = () => page.evaluate(() => {
  const t = document.querySelector('[role=tooltip]');
  if (!t || t.hidden) return null;
  const r = t.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: t.textContent, popover: t.matches(':popover-open'), parent: t.parentElement.tagName, side: t.dataset.placement };
});
const hover = async (sel) => { await page.mouse.move(0, 580); await page.hover(sel); };

describe('xo-tooltip in a browser', () => {
  it('is drawn in the top layer and is not clipped by an overflow:hidden parent, and the element is left as it was', async () => {
    const before = await page.$eval('#clip', (el) => el.outerHTML);
    await hover('#clipped');
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'));
    const box = await tipBox();
    expect(box.popover).toBe(true);
    expect(box.parent).toBe('BODY');
    const target = await page.$eval('#clipped', (el) => el.getBoundingClientRect().toJSON());
    expect(box.bottom).toBeLessThanOrEqual(target.top); // above the button, outside the 40px box that would clip it
    const after = await page.$eval('#clip', (el) => el.outerHTML.replace(/ aria-describedby="[^"]*"/, ''));
    expect(after).toBe(before); // no wrapper, child or class; only aria-describedby while shown
    await page.mouse.move(0, 580);
  });

  it('keeps the delay of its element or ancestor: 150 ms from the body, 600 ms on its own attribute', async () => {
    await page.waitForTimeout(400); // out of the quick-succession window of the tooltip that just closed
    await hover('#side');
    await page.waitForTimeout(40);
    expect(await tipBox()).toBeNull();
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'), null, { timeout: 1000 });
    await page.mouse.move(0, 580);
    await page.waitForTimeout(400); // out of the quick-succession window
    await hover('#slow');
    await page.waitForTimeout(450);
    expect(await tipBox()).toBeNull();
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'), null, { timeout: 1500 });
    await page.mouse.move(0, 580);
  });

  it('flips below at the top edge, stays inside the viewport at the right edge, and goes to the side when asked', async () => {
    await hover('#top');
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'));
    let box = await tipBox();
    expect(box.side).toBe('bottom');
    expect(box.top).toBeGreaterThan(0);
    await page.mouse.move(0, 580);
    await page.waitForTimeout(400);
    await hover('#right');
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'));
    box = await tipBox();
    expect(box.right).toBeLessThanOrEqual(800);
    expect(box.left).toBeGreaterThanOrEqual(0);
    await page.mouse.move(0, 580);
    await page.waitForTimeout(400);
    await hover('#side');
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'));
    box = await tipBox();
    const target = await page.$eval('#side', (el) => el.getBoundingClientRect().toJSON());
    expect(box.side).toBe('right');
    expect(box.left).toBeGreaterThanOrEqual(target.right);
    await page.mouse.move(0, 580);
  });

  it('inside a modal dialog it is above the dialog, inside it (so the inert page does not swallow the pointer), and reachable', async () => {
    await page.click('#open');
    expect(await page.$eval('#dlg', (d) => d.matches(':modal'))).toBe(true);
    await page.hover('#inside');
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'));
    const box = await tipBox();
    expect(box.parent).toBe('DIALOG');
    expect(box.popover).toBe(true);
    const topmost = await page.evaluate(() => {
      const t = document.querySelector('[role=tooltip]').getBoundingClientRect();
      const el = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
      return el?.getAttribute('role') ?? el?.tagName;
    });
    expect(topmost).toBe('tooltip'); // not covered by the dialog, and hit-testable
    // the pointer can move onto it without it closing
    await page.mouse.move(box.left + box.width / 2 || (box.left + box.right) / 2, (box.top + box.bottom) / 2);
    await page.waitForTimeout(100);
    expect((await tipBox())?.text).toBe('Inside the modal dialog');
  });

  it('the first Escape closes the tooltip and leaves the dialog open; the second closes the dialog', async () => {
    await page.focus('#close');
    await page.focus('#inside'); // keyboard focus shows it at once
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'));
    await page.keyboard.press('Escape');
    expect(await tipBox()).toBeNull();
    expect(await page.$eval('#dlg', (d) => d.open)).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.$eval('#dlg', (d) => d.open)).toBe(false);
  });

  it('after the dialog closes the tip is hidden, and an element outside gets it in the body again', async () => {
    expect(await tipBox()).toBeNull();
    await hover('#clipped');
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'));
    expect((await tipBox()).parent).toBe('BODY');
    await page.mouse.move(0, 580);
  });

  it('a click that focuses the button does not show it, a scroll moves it with the element, and it closes when the element scrolls away', async () => {
    await page.click('#side');
    await page.waitForTimeout(250);
    expect(await tipBox()).toBeNull();
    await page.mouse.move(0, 580);
    await page.keyboard.press('Tab'); // a key, then focus: the keyboard shows it at once (the pointer is elsewhere, so a scroll does not end a hover)
    await page.focus('#slow');
    await page.focus('#side');
    await page.waitForFunction(() => document.querySelector('[role=tooltip]:not([hidden])'));
    const first = await tipBox();
    await page.evaluate(() => scrollBy(0, 40));
    await page.waitForTimeout(100);
    const moved = await tipBox();
    expect(Math.round(first.top - moved.top)).toBe(40);
    await page.evaluate(() => scrollBy(0, 800));
    await page.waitForTimeout(100);
    expect(await tipBox()).toBeNull();
    expect(errors).toEqual([]);
  });
});
