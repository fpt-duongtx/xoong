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
<xo-tabs label="Page"><section xo-tab="One"><input id="in1"></section><section xo-tab="Two" id="two"><input id="in2"></section></xo-tabs>
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
});
