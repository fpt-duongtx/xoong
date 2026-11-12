// A generated <xo-form> with 800 fields (40 blocks of 20) in a real browser: typing in one field must not touch the others.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;

const str = { t: 'string', maxLength: 50 };
const block = { t: 'object', props: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, str])) };
const bodySchema = { t: 'object', props: { blocks: { t: 'array', items: block } } };
const record = { id: 1, blocks: Array.from({ length: 40 }, (_, b) => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, `v${b}-${i}`]))) };
const api = {
  version: 1,
  entities: { Page: { id: 'id' } },
  operations: {
    getPage: { id: 'getPage', method: 'GET', path: '/pages/{id}', response: { t: 'entity', name: 'Page' } },
    updatePage: { id: 'updatePage', method: 'PUT', path: '/pages/{id}', body: true, response: { t: 'entity', name: 'Page' }, bodySchema },
  },
};

const PAGE = `<!doctype html><html><head><link rel="stylesheet" href="/@xoong/ui/src/xoong.css"></head><body>
<xo-view get="getPage" p-id="1"><xo-form op="updatePage"></xo-form></xo-view>
<script type="module">
import { configure } from '@xoong/data';
import '@xoong/ui';
configure({ api: ${JSON.stringify(api)}, fetch: async () => new Response(JSON.stringify(${JSON.stringify(record)}), { status: 200, headers: { 'content-type': 'application/json' } }) });
window.ready = true;
</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-large-form-'));
  await writeFile(join(root, 'index.html'), PAGE);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext()).newPage();
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

describe('a generated form with 800 fields', () => {
  it('typing in one field changes only that field', async () => {
    await page.goto(`${dev.url}/index.html`);
    await page.waitForFunction(() => window.ready && document.querySelectorAll('form input').length >= 800, null, { timeout: 30000 });
    const { count, first } = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('form input')];
      window.__writes = 0;
      window.__mutations = 0;
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      for (const input of inputs) {
        if (input.name === 'blocks[17].f3') continue;
        Object.defineProperty(input, 'value', { get() { return desc.get.call(this); }, set(v) { window.__writes++; desc.set.call(this, v); } });
      }
      const form = document.querySelector('form');
      window.__observer = new MutationObserver((records) => { window.__mutations += records.filter((r) => r.target !== document.querySelector('[name="blocks[17].f3"]') && !r.target.contains?.(document.querySelector('[name="blocks[17].f3"]'))).length; });
      window.__observer.observe(form, { subtree: true, childList: true, attributes: true });
      return { count: inputs.length, first: document.querySelector('[name="blocks[17].f3"]').value };
    });
    expect(count).toBe(800);
    expect(first).toBe('v17-3');
    const target = page.locator('[name="blocks[17].f3"]');
    await target.click();
    const start = Date.now();
    await page.keyboard.type('abcdefghij', { delay: 0 });
    const perKey = (Date.now() - start) / 10;
    const after = await page.evaluate(() => ({ writes: window.__writes, mutations: window.__mutations, value: document.querySelector('[name="blocks[17].f3"]').value }));
    expect(after.value).toBe('v17-3abcdefghij');
    expect(after.writes).toBe(0);
    expect(after.mutations).toBe(0);
    expect(perKey).toBeLessThan(150); // a guard, not a benchmark
  });
});
