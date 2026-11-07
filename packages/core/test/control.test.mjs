// XoControl in real Chromium: what depends on ElementInternals (FormData, native validation, form reset, fieldset).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
let dev, browser, page;

const PAGE = `<!doctype html><html><body>
<form id="f"><fieldset id="fs"><x-stars name="rating" required value="2"></x-stars></fieldset>
<x-stars id="opt" name="optional"></x-stars><input name="plain" value="a"><button>go</button></form>
<script type="module">
import { XoControl, define, html } from '@xoong/core';
class Stars extends XoControl {
  static props = { ...XoControl.props, max: Number };
  render() { return html\`<button type="button" id=\${() => 'plus-' + (this.name || 'x')} @click=\${() => this.userInput(String(Number(this.value || 0) + 1))}>+</button>\`; }
  validate(v) { return this.max && Number(v) > this.max ? 'Too many stars' : ''; }
}
define('x-stars', Stars);
window.ready = true;
</script></body></html>`;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'xoong-control-'));
  await writeFile(join(root, 'index.html'), PAGE);
  dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true });
  browser = await launchChromium();
  page = await (await browser.newContext()).newPage();
  await page.goto(dev.url);
  await page.waitForFunction(() => window.ready === true);
}, 60000);

afterAll(async () => { await browser?.close(); await dev?.close(); });

const data = () => page.evaluate(() => Object.fromEntries(new FormData(document.getElementById('f'))));

describe('XoControl in a native <form>', () => {
  it('submits its value in FormData next to native inputs, and follows value changes', async () => {
    expect(await data()).toEqual({ rating: '2', optional: '', plain: 'a' });
    await page.click('#plus-rating');
    expect((await data()).rating).toBe('3');
  });

  it('is associated with the form, and takes part in native constraint validation', async () => {
    expect(await page.evaluate(() => document.querySelector('x-stars').form === document.getElementById('f'))).toBe(true);
    await page.evaluate(() => { document.querySelector('x-stars').setValue(''); });
    expect(await page.evaluate(() => document.getElementById('f').checkValidity())).toBe(false);
    expect(await page.evaluate(() => document.querySelector('x-stars').matches(':invalid'))).toBe(true);
    expect(await page.evaluate(() => document.querySelector('x-stars').validationMessage)).toBe('Please fill in this field.');
    await page.evaluate(() => { document.querySelector('x-stars').setValue('1'); });
    expect(await page.evaluate(() => document.getElementById('f').checkValidity())).toBe(true);
    expect(await page.evaluate(() => document.querySelector('x-stars').matches(':valid'))).toBe(true);
  });

  it('an invalid control blocks submit and receives `invalid`; a custom message from the validate hook does too', async () => {
    const result = await page.evaluate(() => new Promise((resolve) => {
      const form = document.getElementById('f');
      const el = document.querySelector('x-stars');
      const seen = { submit: 0, invalid: 0 };
      form.addEventListener('submit', (e) => { e.preventDefault(); seen.submit++; });
      el.addEventListener('invalid', () => { seen.invalid++; });
      el.setAttribute('max', '3');
      el.setValue('9');
      form.requestSubmit();
      setTimeout(() => resolve({ ...seen, message: el.validationMessage, validity: form.checkValidity() }), 50);
    }));
    expect(result).toEqual({ submit: 0, invalid: 1, message: 'Too many stars', validity: false });
    await page.evaluate(() => { document.querySelector('x-stars').setValue('2'); });
    const ok = await page.evaluate(() => new Promise((resolve) => {
      const form = document.getElementById('f');
      let submitted = 0;
      form.addEventListener('submit', () => { submitted++; });
      form.requestSubmit();
      setTimeout(() => resolve(submitted), 50);
    }));
    expect(ok).toBe(1);
  });

  it('form.reset() puts every control back to its initial value, untouched', async () => {
    await page.evaluate(() => { const el = document.querySelector('x-stars'); el.userInput('7'); el.markTouched(); document.getElementById('f').reset(); });
    expect(await page.evaluate(() => { const el = document.querySelector('x-stars'); return [el.value, el.dirty, el.touched]; })).toEqual(['2', false, false]);
    expect((await data()).rating).toBe('2');
  });

  it('a disabled fieldset disables the control and removes it from FormData', async () => {
    await page.evaluate(() => { document.getElementById('fs').disabled = true; });
    expect(await page.evaluate(() => { const el = document.querySelector('x-stars'); return [el.isDisabled, el.disabled, el.willValidate]; })).toEqual([true, false, false]);
    expect('rating' in (await data())).toBe(false);
    await page.evaluate(() => { document.getElementById('fs').disabled = false; });
    expect((await data()).rating).toBe('2');
    expect(await page.evaluate(() => document.querySelector('x-stars').isDisabled)).toBe(false);
  });

  it('focus leaving the control marks it touched, and reportValidity focuses the first focusable part', async () => {
    await page.evaluate(() => { document.querySelector('x-stars').setValue(''); });
    expect(await page.evaluate(() => { const el = document.querySelector('x-stars'); el.reportValidity(); return document.activeElement === el.querySelector('button'); })).toBe(true);
    await page.focus('input[name=plain]');
    expect(await page.evaluate(() => document.querySelector('x-stars').touched)).toBe(true);
  });
});
