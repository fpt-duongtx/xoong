// The editor in real browsers: real typing, selection, the browser's editing commands, undo, paste. (happy-dom has no editing engine.)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;
const errors = [];

const PAGE = `<!doctype html><html><head><link rel="stylesheet" href="/@xoong/richtext/src/richtext.css"></head><body>
<button id="before">before</button>
<div id="wrap" style="width:880px"><form id="f"><xo-richtext id="rt" name="body" label="Body" media placeholder="Write here"></xo-richtext></form></div>
<script type="module">import '@xoong/richtext'; window.ready = true;</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-richtext-'));
  await writeFile(join(root, 'index.html'), PAGE);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

beforeEach(async () => {
  await page.goto(dev.url + '/');
  await page.waitForFunction(() => window.ready && document.querySelector('.xo-richtext-editable'));
});

const value = () => page.$eval('#rt', (el) => el.value);
const tool = (name) => page.click(`[data-tool=${name}]`);
const typeIn = async (text) => { await page.click('.xo-richtext-editable'); await page.keyboard.type(text); };
const selectLine = async () => { await page.keyboard.down('Shift'); await page.keyboard.press('Home'); await page.keyboard.up('Shift'); };

describe('<xo-richtext> in a browser', () => {
  it('typing becomes sanitised HTML in the value, the placeholder goes away, and the control is dirty', async () => {
    expect(await page.$eval('.xo-richtext-editable', (el) => el.hasAttribute('data-empty'))).toBe(true);
    await typeIn('Hello world');
    expect(await value()).toBe('<p>Hello world</p>');
    expect(await page.$eval('.xo-richtext-editable', (el) => el.hasAttribute('data-empty'))).toBe(false);
    expect(await page.$eval('#rt', (el) => el.dirty)).toBe(true);
    await page.keyboard.press('Enter');
    await page.keyboard.type('second');
    expect(await value()).toBe('<p>Hello world</p><p>second</p>');
  });

  it('bold, italic, heading, lists and quote through the toolbar (the selection stays in the editor)', async () => {
    await typeIn('some words');
    await selectLine();
    await tool('bold');
    expect(await value()).toBe('<p><strong>some words</strong></p>');
    expect(await page.getAttribute('[data-tool=bold]', 'aria-pressed')).toBe('true');
    await tool('bold');
    await tool('italic');
    expect(await value()).toBe('<p><em>some words</em></p>');
    await tool('italic');
    await page.selectOption('select[data-tool=style]', 'h2');
    expect(await value()).toBe('<h2>some words</h2>');
    expect(await page.$eval('select[data-tool=style]', (el) => el.value)).toBe('h2');
    await page.selectOption('select[data-tool=style]', 'p'); // back to a paragraph
    expect(await value()).toBe('<p>some words</p>');
    await tool('underline');
    expect(await value()).toBe('<p><u>some words</u></p>');
    await tool('underline');
    await tool('ul');
    expect(await value()).toBe('<ul><li>some words</li></ul>');
    await tool('ul');
    await tool('ol');
    expect(await value()).toBe('<ol><li>some words</li></ol>');
    await tool('ol');
    await tool('quote');
    expect(await value()).toMatch(/^<blockquote><p>some words<\/p><\/blockquote>$/);
  });

  it('undo and redo work through the toolbar', async () => {
    await typeIn('abc');
    await selectLine();
    await tool('bold');
    expect(await value()).toBe('<p><strong>abc</strong></p>');
    await tool('undo');
    expect(await value()).toBe('<p>abc</p>');
    await tool('redo');
    expect(await value()).toBe('<p><strong>abc</strong></p>');
  });

  it('the link box: a selection becomes a link with rel; javascript: is refused with a message; the address can be changed and removed', async () => {
    await typeIn('see docs');
    await selectLine();
    await tool('link');
    await page.waitForSelector('.xo-richtext-link:not([hidden])');
    await page.keyboard.type('javascript:alert(1)');
    await page.keyboard.press('Enter');
    expect(await page.textContent('.xo-richtext-error')).toContain('http://');
    expect(await value()).toBe('<p>see docs</p>');
    await page.fill('.xo-richtext-link input', 'example.com/docs');
    await page.keyboard.press('Enter');
    expect(await value()).toBe('<p><a href="https://example.com/docs" rel="noopener noreferrer">see docs</a></p>');
    expect(await page.$eval('.xo-richtext-link', (el) => el.hidden)).toBe(true);
    // the caret is in the link: the tool shows pressed, the box shows the address, Remove link unlinks
    await page.click('.xo-richtext-editable a');
    expect(await page.getAttribute('[data-tool=link]', 'aria-pressed')).toBe('true');
    await tool('link');
    expect(await page.inputValue('.xo-richtext-link input')).toBe('https://example.com/docs');
    await page.click('[data-action=remove]');
    expect(await value()).toBe('<p>see docs</p>');
  });

  it('paste is sanitised: formatting from other pages and scripts do not come along, and no handler runs', async () => {
    await page.click('.xo-richtext-editable');
    const ran = await page.evaluate(() => {
      window.pwned = false;
      const data = new DataTransfer();
      data.setData('text/html', '<p style="color:red" onclick="window.pwned=1">Pasted <b>bold</b></p><img src="javascript:1" onerror="window.pwned=1"><script>window.pwned=1</script><a href="javascript:window.pwned=1">x</a>');
      data.setData('text/plain', 'Pasted bold');
      const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      if (!event.clipboardData?.getData('text/html')) return 'unsupported'; // Firefox ignores clipboardData in a synthetic event: the unit tests cover this path there
      document.querySelector('.xo-richtext-editable').dispatchEvent(event);
      return window.pwned;
    });
    if (ran === 'unsupported') return;
    expect(ran).toBe(false);
    const html = await value();
    expect(html).toContain('<strong>bold</strong>');
    expect(html).not.toMatch(/style=|onclick|onerror|<script|javascript:/);
    const live = await page.$eval('.xo-richtext-editable', (el) => el.innerHTML);
    expect(live).not.toMatch(/style=|onclick|onerror|<script|javascript:/); // the live DOM is clean too, not only the value
  });

  it('keyboard order: Tab reaches the toolbar once, arrows move inside it, the next Tab is the editor', async () => {
    await page.focus('#before');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.dataset.tool)).toBe('undo');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement.dataset.tool)).toBe('redo');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.classList.contains('xo-richtext-editable'))).toBe(true);
  });

  it('the image tool asks the app (xo-pick-media); insert() puts the image in at the caret and into the value', async () => {
    await page.evaluate(() => document.querySelector('#rt').addEventListener('xo-pick-media', (e) => { e.preventDefault(); setTimeout(() => e.detail.insert({ src: '/media/a.png', alt: 'Alt text' }), 10); }));
    await typeIn('before ');
    await tool('image');
    await page.waitForFunction(() => document.querySelector('#rt').value.includes('<img'));
    expect(await value()).toBe('<p>before <img src="/media/a.png" alt="Alt text"></p>');
  });

  it('works in a form: the value is submitted, a reset restores the start, and the editor does not leak input events', async () => {
    const seen = await page.evaluate(() => { window.events = []; document.querySelector('#f').addEventListener('input', (e) => window.events.push(e.target.localName)); return true; });
    expect(seen).toBe(true);
    await typeIn('abc');
    expect(await page.evaluate(() => window.events)).toEqual(['xo-richtext', 'xo-richtext', 'xo-richtext']); // one per typed character, all from the control, none from the inner editor
    const data = await page.evaluate(() => new FormData(document.querySelector('#f')).get('body'));
    expect(data).toBe('<p>abc</p>');
    await page.evaluate(() => document.querySelector('#f').reset());
    expect(await value()).toBe('');
    expect(await page.$eval('.xo-richtext-editable', (el) => el.innerHTML)).toBe('');
    expect(errors).toEqual([]);
  });

  it('the toolbar has two sizes chosen by the editor\'s own width, one row, never scrolling sideways', async () => {
    const measure = () => page.evaluate(() => {
      const bar = document.querySelector('.xo-richtext-toolbar');
      const items = [...bar.querySelectorAll('[data-tool]')].filter((el) => !el.closest('.xo-richtext-more') && el.getClientRects().length);
      const tops = new Set(items.map((el) => Math.round(el.getBoundingClientRect().top)));
      return { size: bar.dataset.size, tools: items.map((el) => el.dataset.tool), rows: tops.size, overflow: bar.scrollWidth > bar.clientWidth };
    });
    const full = await measure(); // 880px wide
    expect(full).toMatchObject({ size: 'full', rows: 1, overflow: false });
    expect(full.tools).toEqual(['undo', 'redo', 'style', 'bold', 'italic', 'underline', 'ul', 'ol', 'quote', 'link', 'image']);
    for (const width of [579, 340, 280]) { // the viewport stays wide: only the editor's own width counts
      await page.evaluate((w) => { document.querySelector('#wrap').style.width = `${w}px`; }, width);
      await page.waitForFunction(() => document.querySelector('.xo-richtext-toolbar').dataset.size === 'compact');
      const compact = await measure();
      expect(compact, String(width)).toMatchObject({ size: 'compact', rows: 1, overflow: false });
      expect(compact.tools).toEqual(['style', 'bold', 'italic', 'ul', 'link', 'image', 'more']);
    }
    await page.evaluate(() => { document.querySelector('#wrap').style.width = '580px'; });
    await page.waitForFunction(() => document.querySelector('.xo-richtext-toolbar').dataset.size === 'full');
    expect(await measure()).toMatchObject({ size: 'full', rows: 1, overflow: false });
  });

  it('compact: the More menu holds underline, numbered list, quote, undo and redo, and its items work', async () => {
    await page.evaluate(() => { document.querySelector('#wrap').style.width = '340px'; });
    await page.waitForFunction(() => document.querySelector('.xo-richtext-toolbar').dataset.size === 'compact');
    await typeIn('menu text');
    await selectLine();
    await page.click('[data-tool=more]');
    expect(await page.$$eval('.xo-richtext-more [role^=menuitem]', (items) => items.map((i) => i.dataset.tool))).toEqual(['underline', 'ol', 'quote', 'undo', 'redo']);
    const inside = await page.evaluate(() => { const m = document.querySelector('.xo-richtext-more').getBoundingClientRect(); const b = document.querySelector('.xo-richtext-box').getBoundingClientRect(); return m.left >= b.left - 1 && m.right <= b.right + 1; });
    expect(inside).toBe(true); // the menu does not hang outside the editor
    await page.click('.xo-richtext-more [data-tool=ol]');
    expect(await value()).toBe('<ol><li>menu text</li></ol>');
    expect(await page.$eval('.xo-richtext-more', (el) => el.hidden)).toBe(true);
    await page.focus('[data-tool=more]'); // by keyboard: a mouse click keeps the focus in the editor
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement.dataset.tool)).toBe('underline');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.activeElement.dataset.tool)).toBe('more');
    expect(await page.$eval('.xo-richtext-more', (el) => el.hidden)).toBe(true);
  });

  it('expand(): the same editor opens in a 960px dialog (the screen on a narrow viewport); Done and Escape close it, nothing is saved', async () => {
    await typeIn('long text');
    await page.evaluate(() => { document.querySelector('#wrap').style.width = '340px'; });
    await page.waitForFunction(() => document.querySelector('.xo-richtext-toolbar').dataset.size === 'compact');
    await page.evaluate(() => { window.log = []; const el = document.querySelector('#rt'); el.addEventListener('xo-richtext-expand', () => window.log.push('expand')); el.addEventListener('xo-richtext-done', () => window.log.push('done')); el.expand(); });
    await page.waitForSelector('dialog.xo-richtext-dialog[open]', { timeout: 4000 });
    const open = await page.evaluate(() => {
      const d = document.querySelector('dialog.xo-richtext-dialog').getBoundingClientRect();
      return { width: Math.round(d.width), size: document.querySelector('.xo-richtext-toolbar').dataset.size, text: document.querySelector('.xo-richtext-editable').textContent, focused: document.activeElement.classList.contains('xo-richtext-editable') };
    });
    expect(open).toMatchObject({ size: 'full', text: 'long text', focused: true }); // the editor is narrow in the page, the dialog gives the full toolbar back
    expect(open.width).toBeGreaterThanOrEqual(860); // the 900px viewport minus margins
    expect(open.width).toBeLessThanOrEqual(900);
    await page.keyboard.type(' more');
    await page.click('.xo-richtext-done');
    await page.waitForFunction(() => !document.querySelector('dialog'), null, { timeout: 4000 });
    expect(await value()).toBe('<p>long text more</p>');
    expect(await page.$eval('#rt .xo-richtext-editable', (el) => el.textContent)).toBe('long text more'); // back in place
    expect(await page.$eval('.xo-richtext-toolbar', (el) => el.dataset.size)).toBe('compact');
    await page.evaluate(() => document.querySelector('#rt').expand());
    await page.waitForSelector('dialog.xo-richtext-dialog[open]', { timeout: 4000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog'), null, { timeout: 4000 });
    expect(await page.evaluate(() => window.log)).toEqual(['expand', 'done', 'expand', 'done']);
    expect(await page.$eval('#rt', (el) => el.touched)).toBe(false);
    await page.setViewportSize({ width: 700, height: 600 });
    await page.evaluate(() => document.querySelector('#rt').expand());
    await page.waitForSelector('dialog.xo-richtext-dialog[open]', { timeout: 4000 });
    const small = await page.evaluate(() => { const d = document.querySelector('dialog.xo-richtext-dialog').getBoundingClientRect(); return { w: Math.round(d.width), h: Math.round(d.height) }; });
    expect(small).toEqual({ w: 700, h: 600 }); // the whole screen under 768px
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog'), null, { timeout: 4000 });
    await page.setViewportSize({ width: 1400, height: 700 });
    await page.evaluate(() => document.querySelector('#rt').expand());
    await page.waitForSelector('dialog.xo-richtext-dialog[open]', { timeout: 4000 });
    expect(await page.$eval('dialog.xo-richtext-dialog', (d) => Math.round(d.getBoundingClientRect().width))).toBe(960); // capped at 960px
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog'), null, { timeout: 4000 });
    await page.setViewportSize({ width: 900, height: 700 });
    expect(errors).toEqual([]);
  });
});
