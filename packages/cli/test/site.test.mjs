// The documentation site (site/) built for GitHub Pages: under the project path `/xoong`, strict CSP, the demo table reads static JSON.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { readFile, stat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { build, CSP } from '../src/build.js';
import { sync } from '../src/commands.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
let out, server, base, browser, page;
const violations = [];
const errors = [];

beforeAll(async () => {
  out = join(await mkdtemp(join(tmpdir(), 'xoong-site-')), 'dist');
  await sync(join(repo, 'site/demo/openapi.json'), { out: join(repo, 'site/.xoong') });
  await build({ root: join(repo, 'site'), out, base: '/xoong', include: ['demo/people.json'] });
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
  page = await (await browser.newContext()).newPage();
  page.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) violations.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
}, 90000);
afterAll(async () => { await browser?.close(); server?.close(); });

describe('documentation site', () => {
  it('every page loads its stylesheet under the project path, and the nav marks the current page', async () => {
    for (const name of ['index', 'install', 'how-it-works', 'demo']) {
      const res = await page.goto(`${base}${name}.html`);
      expect(res.status(), name).toBe(200);
      expect(await page.title()).toContain('xoong');
      expect(await page.$eval('header.top', (el) => getComputedStyle(el).display), name).toBe('flex'); // site.css applied
      expect(await page.$$('nav a[aria-current="page"]'), name).toHaveLength(1);
    }
  });

  it('the demo draws a table from the static JSON, without CSP violations or page errors', async () => {
    await page.goto(`${base}demo.html`);
    await page.waitForFunction(() => document.querySelector('.xo-table')?.textContent.includes('Ada Lovelace')); // <xo-table> is replaced by its table
    expect(await page.$$eval('.xo-table tr', (r) => r.length)).toBe(6); // the header and five people
    expect(await page.textContent('.xo-table')).toContain('Donald Knuth');
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });
});
