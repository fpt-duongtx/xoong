// The documentation site (site/) built for GitHub Pages: under the project path `/xoong`, strict CSP, every demo runs on the in-page API.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { readFile, stat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { build, CSP } from '../src/build.js';
import { sync } from '../src/commands.js';
import { launchChromium } from '../../../tools/browser.mjs';
import { axe } from '../../../tools/axe.mjs';
import { focusStates, weak } from '../../../tools/focus.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const PAGES = ['index', 'overview', 'install', 'how-it-works', 'data', 'forms', 'data-states', 'richtext', 'styling', 'arch-overview', 'arch-data-flow', 'arch-forms', 'arch-rendering', 'arch-routing', 'arch-build', 'arch-tooling', 'controls', 'tabs', 'menu', 'combobox', 'carousel', 'own-control', 'components', 'controls-demo', 'overlays', 'focus-audit', 'icons', 'theme-builder', 'demo', 'brand'];
const DOCS = PAGES.filter((n) => !['index', 'brand'].includes(n)); // the pages with the side navigation
let out, server, base, browser, page;
let violations = [];
let errors = [];

beforeAll(async () => {
  out = join(await mkdtemp(join(tmpdir(), 'xoong-site-')), 'dist');
  await sync(join(repo, 'site/demo/openapi.json'), { out: join(repo, 'site/.xoong'), hints: join(repo, 'site/demo/xoong.hints.json') });
  await build({ root: join(repo, 'site'), out, base: '/xoong', include: ['img', 'brand', 'fonts'] });
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
      if (!['components', 'icons', 'data-states', 'overlays', 'focus-audit', 'theme-builder', 'brand'].includes(name)) expect(await page.$$('xo-tabs [role=tablist]'), name).not.toHaveLength(0); // the code tabs are xo-tabs (the kit's own pages show controls, not code)
      clean();
    }
  }, 240000);

  it('the palette menu is a choice menu: Ember sets the palette on the page, it is remembered, and the logo follows', async () => {
    await open('index');
    const accent = () => page.evaluate(() => getComputedStyle(document.querySelector('.hero h1 em')).color);
    const mist = await accent();
    expect(await page.getAttribute('xo-menu.palette', 'value')).toBe('mist');
    await page.click('xo-menu.palette [xo-menu-trigger]');
    expect(await page.$$eval('xo-menu.palette [role=menuitemradio]', (els) => els.map((e) => e.getAttribute('aria-checked')))).toEqual(['true', 'false', 'false']); // Mist, Calm, Ember
    expect(await page.$eval('xo-menu.palette [role=separator]', (el) => el.localName)).toBe('hr');
    expect(await page.$eval('xo-menu.palette a', (a) => a.getAttribute('href'))).toBe('theme-builder.html');
    await page.click('xo-menu.palette [role=menuitemradio]:text-is("Ember")');
    expect(await page.evaluate(() => document.documentElement.dataset.palette)).toBe('ember');
    expect(await accent()).not.toBe(mist);
    expect(await page.$eval('header.top .brand img', (img) => img.complete && img.naturalWidth > 0)).toBe(true); // the lockup loads
    await page.goto(`${base}install.html`); // another page: applied before the first paint
    expect(await page.evaluate(() => document.documentElement.dataset.palette)).toBe('ember');
    expect(await page.getAttribute('xo-menu.palette', 'value')).toBe('ember');
    await page.evaluate(() => localStorage.clear());
    clean();
  });

  it('the theme toggle switches light and dark, the choice is remembered on the next page, and the logo follows', async () => {
    await open('index');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? null);
    const toggle = 'xo-theme-toggle button';
    expect(await page.getAttribute(toggle, 'aria-label')).toBe('Dark theme');
    await page.click(toggle);
    const first = await theme();
    expect(['light', 'dark']).toContain(first);
    expect(await page.getAttribute(toggle, 'aria-pressed')).toBe(String(first === 'dark'));
    const bgFirst = await bg();
    await page.click(toggle);
    const second = await theme();
    expect(second).not.toBe(first);
    expect(await bg()).not.toBe(bgFirst);
    await page.click(toggle);
    const chosen = await theme();
    await page.goto(`${base}install.html`); // another page: applied before the first paint
    expect(await theme()).toBe(chosen);
    expect(await page.getAttribute(toggle, 'aria-pressed')).toBe(String(chosen === 'dark'));
    const dark = await page.$eval('header.top picture > source', (s) => s.media);
    expect(dark).toBe(chosen === 'dark' ? 'all' : 'not all'); // an explicit choice overrides the system for the logo
    await page.evaluate(() => localStorage.clear());
    clean();
  });

  it('code tabs: the Preview runs, the HTML tab shows the highlighted markup, an example has one icon Copy button', async () => {
    await open('overview');
    expect(await page.isVisible('xo-tabs.example .preview .xo-table')).toBe(true);
    expect(await page.isVisible('pre')).toBe(false); // code is behind its tab
    await tab('HTML').click();
    expect(await page.isVisible('pre')).toBe(true);
    expect(await page.$eval('pre[data-lang=html] .tok-t', (el) => el.textContent)).toBe('xo-view');
    expect(await page.$$('xo-tabs.example > .actions-end button[aria-label="Copy the code"]')).toHaveLength(1); // one per example, not one per block
    expect(await page.$eval('pre[data-lang]', (el) => el.tabIndex)).toBe(0); // a scrolling code block can be reached with the keyboard
    await tab('main.js').click();
    expect(await text('pre[data-lang=js]')).toContain("import '@xoong/data/view'");
    clean();
  });

  const T = '.xo-table:has([type=checkbox])'; // the first table of the data page (the selectable one)
  it('data: the table sorts, searches and pages; the list filters with xo-param', async () => {
    await open('data');
    await page.waitForSelector(`${T} td`);
    expect((await texts(`${T} tbody tr td:nth-child(2)`))).toHaveLength(5); // page-size 5 of 8
    await page.click(`${T} th button >> text=name`);
    await page.waitForFunction(() => document.querySelector('.xo-table:has([type=checkbox]) tbody td:nth-child(2)')?.textContent === 'Ada Lovelace');
    await page.fill(`${T} input[type=search]`, 'gra');
    await page.waitForFunction(() => document.querySelectorAll('.xo-table:has([type=checkbox]) tbody tr').length === 1);
    expect(await text(`${T} tbody tr`)).toContain('Grace Hopper');
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

  it('controls: tabs, menu and combobox/tags report their changes, one page each', async () => {
    await open('tabs');
    expect(await text('#tabs-out')).toBe('seo');
    await page.click('#demo-tabs [role=tab]:text-is("Social")');
    expect(await text('#tabs-out')).not.toBe('seo');
    await open('menu');
    await page.click('#demo-menu [xo-menu-trigger]');
    await page.click('#demo-menu button:text-is("Duplicate")');
    expect(await text('#menu-out')).toBe('Duplicate');
    await open('combobox');
    await page.fill('#demo-tags input', 'alpha');
    await page.keyboard.press('Enter');
    expect(await text('#combo-out')).toContain('alpha');
    clean();
  });

  it('controls: the carousel on its own page', async () => {
    await open('carousel');
    // slides from data are counted once (not nested), Next moves, the autoplay one has its pause button
    await page.waitForSelector('xo-carousel[label="People"] .xo-carousel-track > article');
    expect(await page.$$eval('xo-carousel[label="People"] .xo-carousel-track > article', (els) => els.length)).toBe(6);
    expect(await page.$$('xo-carousel[label="People"] .xo-carousel-track .xo-carousel-track')).toHaveLength(0);
    expect(await text('xo-carousel[label="Services"] .xo-carousel-count')).toBe('1 / 5');
    await page.click('xo-carousel[label="Services"] .xo-carousel-next');
    await page.waitForFunction(() => document.querySelector('xo-carousel[label="Services"] .xo-carousel-count').textContent === '2 / 5');
    expect(await page.isVisible('xo-carousel[label="What people say"] .xo-carousel-toggle')).toBe(true);
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

  it('data states: a skeleton while loading, an empty state, an error state with Try again that works', async () => {
    await open('data');
    const states = 'xo-view.states';
    await page.waitForSelector(`${states} .xo-table td`);
    await page.fill(`${states} input[type=search]`, 'zzz');
    await page.waitForSelector(`${states} .state:not(.error)`);
    expect(await text(`${states} .state h3`)).toBe('Nobody here yet');
    await page.fill(`${states} input[type=search]`, 'fail');
    await page.waitForSelector(`${states} .state.error`);
    expect(await text(`${states} .state.error p`)).toContain('The people service is not answering');
    expect(await page.$$(`${states} .state:not(.error)`)).toHaveLength(0); // not "nobody here" after a failure
    await page.click(`${states} button:text-is("Try again")`);
    await page.waitForFunction(() => !document.querySelector('xo-view .state.error'));
    clean();
  });

  it('the docs menu: below 52rem the sidebar is a Menu disclosure that shows the current page, with 44px targets', async () => {
    const small = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
    small.on('pageerror', (e) => errors.push(e.message));
    await small.goto(`${base}forms.html`);
    expect(await small.isVisible('nav.side')).toBe(false);
    expect(await small.isVisible('.docs-menu summary')).toBe(true);
    expect(await small.textContent('.docs-menu summary')).toContain('Forms');
    await small.click('.docs-menu summary');
    expect(await small.$$eval('.docs-menu nav a', (a) => a.length)).toBe(DOCS.length);
    expect(await small.$eval('.docs-menu a', (a) => a.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await small.$eval('.docs-menu a[aria-current=page]', (a) => a.textContent)).toBe('Forms');
    expect(await axe(small)).toEqual([]);
    await small.context().close();
  });

  it('no page scrolls sideways at 390px, and the header stays one slim row', async () => {
    const small = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
    for (const name of PAGES) {
      await small.goto(`${base}${name}.html`);
      await small.waitForLoadState('networkidle');
      const m = await small.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, header: document.querySelector('header.top').getBoundingClientRect().height }));
      expect(m.scroll, `${name} scrolls sideways`).toBeLessThanOrEqual(m.width);
      expect(m.header, `${name} header`).toBeLessThanOrEqual(110);
    }
    await small.context().close();
  }, 180000);

  it('forms: required fields of the generated form are marked, and the fields show an example', async () => {
    await open('forms');
    await page.waitForSelector('.xo-form .xo-submit');
    expect(await page.$eval('.xo-form [name=name]', (el) => el.placeholder)).toBe('Ada Lovelace');
    expect(await page.$eval('.xo-form label.xo-field > :first-child', (el) => getComputedStyle(el, '::after').content)).toContain('*');
    clean();
  });

  it('the site look is one cascade layer: a consumer\'s own CSS beats it, and a token set on :root rethemes the components', async () => {
    await open('forms');
    await page.waitForSelector('.xo-form .xo-submit');
    const result = await page.evaluate(() => {
      const button = document.querySelector('.xo-form .xo-submit');
      const before = getComputedStyle(button).backgroundColor;
      const sheet = new CSSStyleSheet(); // the CSS object model: allowed under the strict CSP
      sheet.replaceSync('* { transition: none !important; } .xo-submit { background: rgb(1, 2, 3); } :root { --xo-color-accent: rgb(10, 20, 30); }');
      document.adoptedStyleSheets = [sheet];
      const probe = document.createElement('span');
      probe.style.color = 'var(--xo-color-accent)';
      document.body.append(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      return { before, after: getComputedStyle(button).backgroundColor, accent };
    });
    expect(result.before).not.toBe('rgb(1, 2, 3)');
    expect(result.after).toBe('rgb(1, 2, 3)');
    expect(result.accent).toBe('rgb(10, 20, 30)');
    clean();
  });

  it('404.html names its files from the site root and shows the missing path; every page has a social card', async () => {
    violations = []; errors = [];
    const out404 = await page.goto(`${base}404.html`);
    expect(out404.status()).toBe(200);
    expect(await page.$eval('link[href*="site.css"]', (l) => l.getAttribute('href'))).toBe('/xoong/src/site.css');
    expect(await page.$eval('.lost h1', (h) => h.textContent)).toBe('This page went off the boil');
    expect(await text('#lost-path')).toBe('/xoong/404.html');
    expect(await page.$eval('.lost', (el) => getComputedStyle(el).minHeight)).not.toBe('0px'); // the stylesheet applied
    for (const name of ['index', 'data', 'tabs', 'demo', 'brand']) {
      await open(name);
      const image = await page.$eval('meta[property="og:image"]', (m) => m.content);
      const got = await page.request.get(new URL(image, page.url()).href);
      expect(got.status(), `${name} ${image}`).toBe(200);
    }
    clean();
  });

  describe('accessibility (axe-core, WCAG 2.0 and 2.1 A and AA)', () => {
    const scan = async (label) => {
      const found = await axe(page);
      expect(found, label).toEqual([]);
    };
    const scheme = async (colorScheme, palette) => {
      await page.emulateMedia({ colorScheme });
      await page.evaluate((p) => { if (p === 'mist') delete document.documentElement.dataset.palette; else document.documentElement.dataset.palette = p; }, palette);
    };
    afterAll(async () => { await page?.emulateMedia({ colorScheme: 'light' }); });

    it('every page, in Mist (the default palette) and light', async () => {
      for (const name of PAGES) {
        await open(name);
        await page.waitForTimeout(300); // demos finish rendering
        await scan(name);
      }
    }, 240000);

    for (const [palette, colorScheme] of [['mist', 'dark'], ['calm', 'light'], ['ember', 'dark']]) {
      it(`every page in ${palette} and ${colorScheme}`, async () => {
        for (const name of PAGES) {
          await open(name);
          await scheme(colorScheme, palette);
          await page.waitForTimeout(300);
          await scan(`${name} (${palette}, ${colorScheme})`);
        }
        await scheme('light', 'mist');
      }, 240000);
    }

    it('keyboard focus: every focus state on the main pages has an indicator of at least 3:1 (WCAG 1.4.11), in Mist light and Ember dark', async () => {
      for (const [palette, colorScheme] of [['mist', 'light'], ['ember', 'dark']]) {
        await page.emulateMedia({ colorScheme });
        for (const name of ['forms', 'data', 'menu', 'components', 'demo']) {
          await open(name);
          await page.evaluate((p) => { if (p === "mist") delete document.documentElement.dataset.palette; else document.documentElement.dataset.palette = p; }, palette);
          await page.waitForTimeout(200);
          const states = await focusStates(page, { max: 90 });
          expect(states.length, `${name}: nothing could be focused`).toBeGreaterThan(3);
          expect(weak(states).map((r) => `${palette}/${colorScheme} ${name}: ${r.tag} "${r.text}" ${r.kind} ${r.ratio}`), name).toEqual([]);
        }
      }
      await page.emulateMedia({ colorScheme: 'light' });
    }, 480000);

    it('open states: a menu list, a dialog, the rich text More menu, the confirm dialog', async () => {
      await open('menu');
      await page.click('#demo-menu [xo-menu-trigger]');
      await scan('menu open');
      await page.keyboard.press('Escape');
      await open('demo');
      await page.waitForSelector('.xo-table td');
      await page.click('button:text-is("Add person")');
      await scan('dialog open');
      await page.keyboard.press('Escape');
      await page.click('.xo-table tbody tr:first-child button:text-is("Delete")');
      await page.waitForSelector('dialog[open]');
      await scan('confirm open');
      await page.keyboard.press('Escape');
      await open('richtext');
      await page.$eval('.resizable', (el) => { el.style.width = '420px'; });
      await page.waitForFunction(() => document.querySelector('#demo-editor [role=toolbar]')?.dataset.size === 'compact');
      await page.click('#demo-editor [data-tool=more]');
      await scan('richtext more menu');
      await open('forms');
      await page.waitForSelector('.xo-form .xo-submit');
      await page.click('.xo-form .xo-submit');
      await page.waitForSelector('.xo-form [aria-invalid="true"]');
      await scan('form with validation errors');
      await page.fill('.xo-form [name=name]', 'Test Person');
      await page.fill('.xo-form [name=email]', 'ada@example.org');
      await page.click('.xo-form .xo-submit');
      await page.waitForSelector('.xo-toast:not([hidden])');
      await scan('form with a server error and a toast');
      await open('data');
      await page.waitForSelector('xo-view.states .xo-table td');
      await page.fill('xo-view.states input[type=search]', 'zzz');
      await page.waitForSelector('xo-view.states .state');
      await scan('empty state');
      await page.fill('xo-view.states input[type=search]', 'fail');
      await page.waitForSelector('xo-view.states .state.error');
      await scan('error state');
      await open('404');
      await scan('404');
      clean();
    }, 240000);
  });
});
