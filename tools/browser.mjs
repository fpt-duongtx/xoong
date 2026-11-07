// Test helpers: launch headless Chromium, and serve the repo over HTTP to a page.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname;
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };

const PAGE = `<!doctype html><meta charset=utf-8>
<script type="importmap">{"imports":{
 "@xoong/core":"/packages/core/src/index.js",
 "@xoong/core/signals":"/packages/core/src/signals.js",
 "@xoong/core/closest":"/packages/core/src/closest.js",
 "@xoong/data":"/packages/data/src/index.js",
 "@xoong/data/view":"/packages/data/src/view.js"}}</script><body></body>`;

/**
 * Launch headless Chromium. Uses a browser that is already installed when one is provided
 * (XOONG_CHROMIUM, or the sandbox's /opt/pw-browsers/chromium); otherwise Playwright's own
 * download (`npx playwright install chromium`, as CI does).
 */
export async function launchChromium() {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const preinstalled = process.env.XOONG_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
}

/**
 * Serve the repository at http://127.0.0.1:<port>/ (with an import map for @xoong packages) and hand an
 * open page to `fn(page, baseUrl, pageErrors)`. `routes` adds custom handlers keyed "METHOD /path".
 */
export async function withBrowser(fn, { routes = {} } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const custom = routes[req.method + ' ' + url.pathname];
    if (custom) return custom(req, res, url);
    if (url.pathname === '/') { res.setHeader('content-type', 'text/html'); return res.end(PAGE); }
    const file = normalize(join(root, url.pathname));
    if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
    try {
      const body = await readFile(file);
      res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
      res.end(body);
    } catch { res.statusCode = 404; res.end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchChromium();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/');
  try {
    return await fn(page, base, errors);
  } finally {
    await browser.close();
    server.close();
  }
}
