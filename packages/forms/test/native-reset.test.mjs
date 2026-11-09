// The native reset button in real Chromium. A browser resets the controls AFTER the `reset` event and, for a real click, runs the microtasks
// queued by a listener BEFORE that reset: the binder must rewrite the controls from the model in a later task (happy-dom cannot show this
// order; the happy-dom side of the same feature is native-reset.spec.mjs).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;
const pageErrors = [];

const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<form id="f"><input name="name" id="name"><input name="email" id="email"><input type="checkbox" name="agree" id="agree">
  <input type="checkbox" name="tags" value="a" id="ta"><input type="checkbox" name="tags" value="b" id="tb"><button type="reset" id="reset">Reset</button></form>
<script type="module">
import { attach } from '@xoong/forms';
const str = { t: 'string' };
const schema = { t: 'object', props: { name: str, email: str, agree: { t: 'boolean' }, tags: { t: 'array', items: { t: 'string', enum: ['a', 'b'] } } } };
window.engine = attach(document.getElementById('f'), { schema, record: () => ({ name: 'Ada', email: 'a@x.io', agree: true, tags: ['a'] }) });
window.ready = true;
</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-reset-'));
  await writeFile(join(root, 'index.html'), PAGE);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
  browser = await launchChromium();
  page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(dev.url + '/');
  await page.waitForFunction(() => window.ready);
}, 60000);
afterAll(async () => { await browser?.close(); await dev?.close(); });

const state = () => page.evaluate(() => {
  const g = (id) => document.getElementById(id);
  return { name: g('name').value, email: g('email').value, agree: g('agree').checked, tags: [g('ta').checked, g('tb').checked], dirty: window.engine.model.dirty, body: window.engine.model.body() };
});

describe('native reset button', () => {
  it('a click on type="reset" brings back the record in the controls and in the model', async () => {
    expect(await state()).toMatchObject({ name: 'Ada', email: 'a@x.io', agree: true, tags: [true, false], dirty: false });
    await page.fill('#name', 'Typed');
    await page.fill('#email', 'new@x.io');
    await page.click('#agree');
    await page.click('#tb');
    expect(await state()).toMatchObject({ name: 'Typed', agree: false, tags: [true, true], dirty: true });
    await page.click('#reset');
    await page.waitForFunction(() => document.getElementById('name').value === 'Ada');
    expect(await state()).toEqual({ name: 'Ada', email: 'a@x.io', agree: true, tags: [true, false], dirty: false, body: { name: 'Ada', email: 'a@x.io', agree: true, tags: ['a'] } });
    expect(pageErrors).toEqual([]);
  });
});
