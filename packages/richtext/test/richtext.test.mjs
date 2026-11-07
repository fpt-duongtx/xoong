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
<form id="f"><xo-richtext id="rt" name="body" label="Body" media placeholder="Write here"></xo-richtext></form>
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
    await tool('h2');
    expect(await value()).toBe('<h2>some words</h2>');
    expect(await page.getAttribute('[data-tool=h2]', 'aria-pressed')).toBe('true');
    await tool('h2'); // toggles back to a paragraph
    expect(await value()).toBe('<p>some words</p>');
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
    expect(await page.evaluate(() => document.activeElement.dataset.tool)).toBe('bold');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement.dataset.tool)).toBe('italic');
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
});
