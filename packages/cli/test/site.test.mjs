// The documentation site (site/) built for GitHub Pages: under the project path `/xoong`, strict CSP, every demo runs on the in-page API.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { readFile, stat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { build, CSP } from '../src/build.js';
import { sync } from '../src/commands.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const PAGES = ['index', 'overview', 'install', 'how-it-works', 'data', 'forms', 'controls', 'richtext', 'styling', 'demo', 'brand'];
const DOCS = PAGES.filter((n) => !['index', 'brand'].includes(n)); // the pages with the side navigation
let out, server, base, browser, page;
let violations = [];
let errors = [];

beforeAll(async () => {
  out = join(await mkdtemp(join(tmpdir(), 'xoong-site-')), 'dist');
  await sync(join(repo, 'site/demo/openapi.json'), { out: join(repo, 'site/.xoong') });
  await build({ root: join(repo, 'site'), out, base: '/xoong', include: ['img', 'brand'] });
  server = createServer(async (req, res) => {
    res.setHeader('content-security-policy', CSP);
    const path = new URL(req.url, 'http://x').pathname.replace(/^\/xoong/, '') || '/';
    const file = join(out, path === '/' ? 'index.html' : path);
    if (!(await stat(file).then((s) => s.isFile(), () => false))) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/xoong/`;
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  page.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) violations.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
}, 90000);
afterAll(async () => { await browser?.close(); server?.close(); });

const open = async (name) => {
  violations = []; errors = [];
  await page.goto(`${base}${name}.html`);
  await page.waitForLoadState('networkidle');
};
const text = (selector) => page.$eval(selector, (el) => el.textContent.replace(/\s+/g, ' ').trim());
const texts = (selector) => page.$$eval(selector, (els) => els.map((el) => el.textContent.replace(/\s+/g, ' ').trim()));
const tab = (name, index = 0) => page.getByRole('tab', { name, exact: true }).nth(index);
const clean = () => { expect(violations).toEqual([]); expect(errors).toEqual([]); };

describe('documentation site', () => {
  it('every page loads under the project path, marks itself in the side navigation and has no CSP violation or error', async () => {
    for (const name of PAGES) {
      await open(name);
      expect(await page.title(), name).toContain('xoong');
      expect(await page.$eval('header.top .wrap', (el) => getComputedStyle(el).display), name).toBe('flex'); // site.css applied
      expect(await page.$$('header nav > a[aria-current="page"]'), name).toHaveLength(1); // Home, Docs, Demo or Brand
      expect(await page.$$('nav.side a'), name).toHaveLength(DOCS.includes(name) ? DOCS.length : 0);
      expect(await page.$$('nav.side a[aria-current="page"]'), name).toHaveLength(DOCS.includes(name) ? 1 : 0);
      expect(await page.$$('xo-tabs [role=tablist]'), name).not.toHaveLength(0); // the code tabs are xo-tabs
      clean();
    }
  });

  it('the palette menu is a choice menu: Ember sets the palette on the page, it is remembered, and the logo follows', async () => {
    await open('index');
    const accent = () => page.evaluate(() => getComputedStyle(document.querySelector('.hero h1 em')).color);
    const calm = await accent();
    expect(await page.getAttribute('xo-menu.palette', 'value')).toBe('calm');
    await page.click('xo-menu.palette [xo-menu-trigger]');
    expect(await page.$$eval('xo-menu.palette [role=menuitemradio]', (els) => els.map((e) => e.getAttribute('aria-checked')))).toEqual(['true', 'false']);
    await page.click('xo-menu.palette [role=menuitemradio]:text-is("Ember")');
    expect(await page.evaluate(() => document.documentElement.dataset.palette)).toBe('ember');
    expect(await accent()).not.toBe(calm);
    expect(await page.$eval('.brand .m-body', (el) => getComputedStyle(el).fill)).toBe(await accent()); // the pot is the palette's ember
    await page.goto(`${base}install.html`); // another page: applied before the first paint
    expect(await page.evaluate(() => document.documentElement.dataset.palette)).toBe('ember');
    expect(await page.getAttribute('xo-menu.palette', 'value')).toBe('ember');
    await page.evaluate(() => localStorage.clear());
    clean();
  });

  it('code tabs: the Preview runs, the HTML tab shows the highlighted markup, every block has a Copy button', async () => {
    await open('overview');
    expect(await page.isVisible('xo-tabs .demo xo-table, xo-tabs .demo .xo-table')).toBe(true);
    expect(await page.isVisible('pre')).toBe(false); // code is behind its tab
    await tab('HTML').click();
    expect(await page.isVisible('pre')).toBe(true);
    expect(await page.$eval('pre[data-lang=html] .tok-t', (el) => el.textContent)).toBe('xo-view');
    expect(await page.$$('pre[data-lang] button.copy')).toHaveLength(3);
    await tab('main.js').click();
    expect(await text('pre[data-lang=js]')).toContain("import '@xoong/data/view'");
    clean();
  });

  it('data: the table sorts, searches and pages; the list filters with xo-param', async () => {
    await open('data');
    await page.waitForSelector('.xo-table td');
    expect((await texts('.xo-table tbody tr td:nth-child(2)'))).toHaveLength(5); // page-size 5 of 8
    await page.click('.xo-table th button >> text=name');
    await page.waitForFunction(() => document.querySelector('.xo-table tbody td:nth-child(2)')?.textContent === 'Ada Lovelace');
    await page.fill('.xo-table input[type=search]', 'gra');
    await page.waitForFunction(() => document.querySelectorAll('.xo-table tbody tr').length === 1);
    expect(await text('.xo-table tbody tr')).toContain('Grace Hopper');
    await page.getByRole('button', { name: 'Admins' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.people li').length === 2);
    expect(await texts('.people li strong')).toEqual(['Ada Lovelace', 'Margaret Hamilton']);
    clean();
  });

  it('forms: the generated form validates, shows a server error and a summary, then adds a person and starts clean', async () => {
    await open('forms');
    await page.waitForSelector('.xo-form .xo-submit');
    await page.click('.xo-form .xo-submit');
    expect((await texts('.xo-form .xo-error')).length).toBeGreaterThan(0); // name and e-mail are required
    await page.fill('.xo-form [name=name]', 'Katherine Johnson');
    await page.fill('.xo-form [name=email]', 'ada@example.org');
    await page.click('.xo-form .xo-submit');
    await page.waitForSelector('.xo-form [data-xo-summary]');
    expect(await text('.xo-form [data-xo-summary]')).toContain('already used');
    await page.fill('.xo-form [name=email]', 'katherine@example.org');
    await page.click('.xo-form .xo-submit');
    await page.waitForFunction(() => document.querySelector('.split .people li strong')?.textContent === 'Katherine Johnson'); // the list refreshed
    expect(await page.inputValue('.xo-form [name=name]')).toBe('');
    expect(await page.$$('.xo-form .xo-error, .xo-form [data-xo-summary]')).toHaveLength(0);
    clean();
  });

  it('forms: the hand-written form is dirty after an edit, reveals an invalid field on another tab, and rows move', async () => {
    await open('forms');
    await page.waitForFunction(() => document.querySelector('xo-view[p-id="1"] [name=name]')?.value === 'Ada Lovelace');
    expect(await page.isVisible('text=Unsaved changes')).toBe(false);
    await page.fill('xo-view[get=getPerson][p-id="1"] [name=name]', 'A');
    expect(await page.isVisible('text=Unsaved changes')).toBe(true);
    const own = 'xo-view[get=getPerson][p-id="1"] xo-tabs';
    await page.click(`${own} [role=tab]:text-is("Topics")`);
    await page.click('xo-view[get=getPerson][p-id="1"] button:text-is("Save")');
    await page.waitForFunction(() => document.querySelector('xo-view[p-id="1"] xo-tabs [role=tab][aria-selected=true]')?.textContent === 'General'); // revealed before the focus moved
    await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'name'); // then the focus moved to the invalid field
    // array rows (person 2: one keyword; add one, then move it up)
    await page.waitForSelector('.row [name="keywords[0]"]');
    await page.click('button:text-is("Add keyword")');
    await page.fill('.row:nth-of-type(2) input', 'second');
    await page.click('.row:nth-of-type(2) button[aria-label="Move up"]');
    expect(await page.$$eval('.row input', (els) => els.map((e) => e.value))).toEqual(['second', 'compiler']);
    clean();
  });

  it('controls: tabs, menu and combobox/tags report their changes', async () => {
    await open('controls');
    expect(await text('#tabs-out')).toBe('seo');
    await page.click('#demo-tabs [role=tab]:text-is("Social")');
    expect(await text('#tabs-out')).not.toBe('seo');
    await page.click('#demo-menu [xo-menu-trigger]');
    await page.click('#demo-menu button:text-is("Duplicate")');
    expect(await text('#menu-out')).toBe('Duplicate');
    await page.fill('#demo-tags input', 'alpha');
    await page.keyboard.press('Enter');
    expect(await text('#combo-out')).toContain('alpha');
    clean();
  });

  it('richtext: the value is shown sanitised, the toolbar follows the editor width, the image tool uses the media hook', async () => {
    await open('richtext');
    await page.waitForFunction(() => document.querySelector('#rt-out')?.textContent.startsWith('<h2>Release notes</h2>'));
    expect(await page.$eval('#demo-editor [role=toolbar]', (el) => el.dataset.size)).toBe('full');
    await page.$eval('.resizable', (el) => { el.style.width = '420px'; }); // CSSOM: allowed under the CSP
    await page.waitForFunction(() => document.querySelector('#demo-editor [role=toolbar]')?.dataset.size === 'compact');
    await page.click('#demo-editor .xo-richtext-editable');
    await page.click('#demo-editor [data-tool=image], #demo-editor [data-tool=more]');
    if (!(await text('#rt-out')).includes('<img')) await page.click('.xo-richtext-more [data-tool=image]').catch(() => {});
    await page.waitForFunction(() => document.querySelector('#rt-out')?.textContent.includes('landscape.svg'));
    expect(await text('#rt-out')).toMatch(/<img src="[^"]*\/img\/landscape\.svg" alt="A landscape">/);
    clean();
  });

  it('styling: the sample panel follows the token controls', async () => {
    await open('styling');
    await page.$eval('#p-accent', (el) => { el.value = '#00aa77'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(await page.$eval('#playground', (el) => el.style.getPropertyValue('--xo-color-accent'))).toBe('#00aa77');
    await page.selectOption('#p-scheme', 'dark');
    expect(await page.$eval('#playground', (el) => getComputedStyle(el).colorScheme)).toBe('dark');
    clean();
  });

  it('demo: the dialog form adds a person, the dialog closes and the table shows them', async () => {
    await open('demo');
    await page.waitForSelector('.xo-table td');
    await page.click('button:text-is("Add person")');
    await page.fill('xo-dialog [name=name]', 'Radia Perlman');
    await page.fill('xo-dialog [name=email]', 'radia@example.org');
    await page.click('xo-dialog .xo-submit');
    await page.waitForFunction(() => !document.querySelector('xo-dialog dialog')?.open);
    await page.fill('.xo-table input[type=search]', 'radia');
    await page.waitForFunction(() => document.querySelector('.xo-table tbody td:nth-child(2)')?.textContent === 'Radia Perlman');
    clean();
  });
});
