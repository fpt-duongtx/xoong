// The newer controls in a real browser: focus, keyboard and layout that happy-dom cannot judge.
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
<button id="open" xo-open="#dr">Open drawer</button>
<xo-drawer id="dr" heading="Filters" side="end" dismiss><div style="height:2000px">tall</div><button slot="footer" type="button" xo-close>Done</button></xo-drawer>
<div id="narrow" style="width:260px"><xo-breadcrumb id="bc" items='[{"label":"Home","href":"/"},{"label":"Documentation","href":"/d"},{"label":"Controls","href":"/c"},{"label":"Navigation","href":"/n"},{"label":"Breadcrumb"}]'></xo-breadcrumb></div>
<xo-tree id="tree" label="Files" selectable data='[{"id":"a","label":"Alpha","children":[{"id":"a1","label":"Apple"}]},{"id":"b","label":"Beta"}]'></xo-tree>
<form id="f"><xo-rating id="rate" name="score" label="Score"></xo-rating><xo-color id="col" name="brand" label="Brand" value="#336699" swatches="#ff0000,#00ff00"></xo-color></form>
<script type="module">import '@xoong/controls'; window.ready = true;</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-new-controls-'));
  await writeFile(join(root, 'index.html'), PAGE);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true, packages: ['@xoong/controls'] });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(dev.url + '/');
  await page.waitForFunction(() => window.ready && document.querySelector('xo-tree [role=tree]') && document.querySelector('xo-drawer dialog'));
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

const settled = () => page.waitForFunction(() => !document.querySelector('dialog.xo-drawer').getAnimations().length); // the slide-in is over

describe('new controls in a browser', () => {
  it('drawer: opens on the end edge, the body scrolls under a pinned header and footer, Escape closes and the focus returns', async () => {
    await page.click('#open');
    await settled();
    const box = await page.evaluate(() => {
      const d = document.querySelector('dialog.xo-drawer'), r = d.getBoundingClientRect(), body = d.querySelector('.xo-drawer__body');
      return { open: d.open, right: Math.round(r.right), height: Math.round(r.height), vh: innerHeight, scrolls: body.scrollHeight > body.clientHeight, pageLocked: getComputedStyle(document.body).overflow };
    });
    expect(box).toMatchObject({ open: true, right: 800, height: 600, scrolls: true, pageLocked: 'hidden' });
    const foot = await page.evaluate(() => { const f = document.querySelector('.xo-drawer__foot').getBoundingClientRect(); return Math.round(f.bottom); });
    expect(foot).toBe(600);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.querySelector('dialog.xo-drawer').open)).toBe(false);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('open');
  });

  it('drawer: a click on the backdrop closes it (dismiss), a click inside does not; on a phone it covers the screen', async () => {
    await page.click('#open');
    await settled();
    await page.mouse.click(10, 300);
    expect(await page.evaluate(() => document.querySelector('dialog.xo-drawer').open)).toBe(false);
    await page.click('#open');
    await settled();
    await page.click('.xo-drawer__body');
    expect(await page.evaluate(() => document.querySelector('dialog.xo-drawer').open)).toBe(true);
    await page.click('[xo-close]');
    await page.setViewportSize({ width: 390, height: 700 });
    await page.click('#open');
    await settled();
    expect(await page.evaluate(() => Math.round(document.querySelector('dialog.xo-drawer').getBoundingClientRect().width))).toBe(390);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 800, height: 600 });
  });

  it('drawer: in right-to-left text the end side is the left edge', async () => {
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await page.click('#open');
    await settled();
    expect(await page.evaluate(() => Math.round(document.querySelector('dialog.xo-drawer').getBoundingClientRect().left))).toBe(0);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  });

  it('breadcrumb: collapses the middle into an "…" menu when the space is short, the menu opens in the top layer and Escape returns the focus', async () => {
    const state = await page.evaluate(() => ({ hidden: [...document.querySelectorAll('#bc li[hidden]')].length, fits: document.querySelector('#bc nav').scrollWidth <= document.querySelector('#bc nav').clientWidth + 1, current: document.querySelector('#bc [aria-current=page]').textContent }));
    expect(state.hidden).toBeGreaterThan(0);
    expect(state.fits).toBe(true);
    expect(state.current).toBe('Breadcrumb');
    await page.click('.xo-breadcrumb__more button');
    expect(await page.evaluate(() => document.querySelector('.xo-breadcrumb__menu').matches(':popover-open'))).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.activeElement.closest('.xo-breadcrumb__more') !== null)).toBe(true);
    await page.evaluate(() => { document.querySelector('#narrow').style.width = '900px'; });
    await page.waitForFunction(() => document.querySelectorAll('#bc li[hidden]').length === 0);
    await page.evaluate(() => { document.querySelector('#narrow').style.width = '260px'; });
  });

  it('tree: one Tab stop, arrows with real focus, type-ahead, Enter selects', async () => {
    await page.focus('#tree [role=treeitem]');
    expect(await page.evaluate(() => document.activeElement.dataset.id)).toBe('a');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement.dataset.id)).toBe('a1');
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement.dataset.id)).toBe('b');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.querySelector('#tree').selected)).toEqual(['b']);
    await page.keyboard.press('Home');
    await page.keyboard.type('b');
    expect(await page.evaluate(() => document.activeElement.dataset.id)).toBe('b');
    expect(await page.evaluate(() => document.querySelectorAll('#tree [tabindex="0"]').length)).toBe(1);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('#tree'))).toBe(null);
  });

  it('rating: arrow keys on the real radios choose a star and the form submits the number', async () => {
    await page.focus('#rate input');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.querySelector('#rate').value)).toBe(3);
    expect(await page.evaluate(() => [...new FormData(document.querySelector('#f')).entries()].filter(([k]) => k === 'score'))).toEqual([['score', '3']]);
    expect(await page.evaluate(() => [...new FormData(document.querySelector('#f')).keys()].filter((k) => k.startsWith('xo-rating')))).toEqual([]);
  });

  it('color: the swatch opens the panel by keyboard, a preset sets the value in FormData, Escape returns to the swatch', async () => {
    await page.focus('.xo-color__swatch');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.querySelector('.xo-color__panel').matches(':popover-open'))).toBe(true);
    await page.click('.xo-color__sw[data-color="#00ff00"]');
    expect(await page.evaluate(() => new FormData(document.querySelector('#f')).get('brand'))).toBe('#00ff00');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.activeElement.classList.contains('xo-color__swatch'))).toBe(true);
    expect(errors).toEqual([]);
  });
});
