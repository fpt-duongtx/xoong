// One sanitiser, two runtimes: every case in sanitize-cases.mjs gives the same bytes in Node and in a real browser (Chromium), the output is stable
// when sanitised again, and a profile is checked when it is defined.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../../cli/src/dev.js';
import { launchChromium } from '../../../tools/browser.mjs';
import { sanitizeHtml, defineRichtextProfile, getRichtextProfile, profileAllows, textOf } from '../src/sanitize.js';
import { CASES } from './sanitize-cases.mjs';

const repo = new URL('../../..', import.meta.url).pathname;

describe('sanitizeHtml in Node', () => {
  for (const [name, profile, input, expected] of CASES) {
    it(name, () => {
      const out = sanitizeHtml(input, profile);
      expect(out).toBe(expected);
      expect(sanitizeHtml(out, profile)).toBe(out); // stable
    });
  }

  it('sanitising twice (client, then server) gives the same string, whatever the input', () => {
    for (const [, profile, input] of CASES) {
      const once = sanitizeHtml(input, profile);
      expect(sanitizeHtml(sanitizeHtml(once, profile), profile)).toBe(once);
    }
  });

  it('a stricter second profile can only remove', () => {
    const rich = sanitizeHtml('<aside class="note"><p>x</p></aside><p>y</p>', 'rich');
    expect(sanitizeHtml(rich, 'default')).toBe('<p>x</p><p>y</p>');
  });
});

describe('profiles', () => {
  it('a named profile works by name and its toolbar question is answered by profileAllows', () => {
    defineRichtextProfile('notes-only', { tags: { p: {}, aside: { classes: ['note'] } } });
    expect(getRichtextProfile('notes-only')?.tags.aside).toBeTruthy();
    expect(sanitizeHtml('<aside class="note x"><p>a <strong>b</strong></p></aside>', 'notes-only')).toBe('<aside class="note"><p>a b</p></aside>');
    expect(profileAllows('notes-only', 'strong')).toBe(false);
    expect(profileAllows('rich', 'figure')).toBe(true);
    expect(profileAllows(undefined, 'figure')).toBe(false);
  });

  it('refuses what cannot be kept safe, when the profile is defined', () => {
    const bad = (tags) => () => defineRichtextProfile('bad', { tags });
    expect(bad({ p: { attrs: { style: 'text' } } })).toThrow(/style/);
    expect(bad({ p: { attrs: { onclick: 'text' } } })).toThrow(/onclick/);
    expect(bad({ p: { attrs: { id: 'text' } } })).toThrow(/id/);
    expect(bad({ a: { attrs: { href: 'text' } } })).toThrow(/url/);
    expect(bad({ p: { attrs: { class: 'text' } } })).toThrow(/classes/);
    expect(bad({ script: {} })).toThrow(/script/);
    expect(bad({ blink: {} })).toThrow(/unknown tag/);
    expect(() => defineRichtextProfile('rich', { tags: {} })).toThrow(/built in/);
    expect(() => sanitizeHtml('x', 'nope')).toThrow(/unknown richtext profile/);
  });

  it('an id from a list, a data attribute and a data:image source can be allowed on purpose', () => {
    const profile = { tags: { p: { attrs: { id: ['intro'], 'data-kind': 'text' } }, img: { attrs: { src: 'imgurl' } } }, schemes: { imgurl: ['data:image'] } };
    expect(sanitizeHtml('<p id="intro" data-kind="a">x</p><p id="other" data-other="b">y</p>', profile)).toBe('<p id="intro" data-kind="a">x</p><p>y</p>');
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA"><img src="data:image/svg+xml;base64,AAAA"><img src="/rel.png">', profile)).toBe('<p><img src="data:image/png;base64,AAAA"></p>');
  });

  it('the old { images: false } option still works, and textOf ignores script text', () => {
    expect(sanitizeHtml('<p>t</p><img src="/a.png">', { images: false })).toBe('<p>t</p>');
    expect(textOf('<p>a &amp; <b>b</b></p><script>x()</script>')).toBe('a & b');
  });

  it('deeply nested input does not overflow the stack', () => {
    const html = '<blockquote>'.repeat(20000) + 'deep';
    expect(sanitizeHtml(html, 'rich')).toContain('deep');
  });
});

describe('the same bytes in a real browser', () => {
  let dev, browser, page;
  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-sanitize-'));
    await writeFile(join(root, 'index.html'), '<!doctype html><title>x</title>');
    dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, spa: true });
    browser = await launchChromium();
    page = await (await browser.newContext()).newPage();
    await page.goto(dev.url + '/');
    await page.addScriptTag({ type: 'module', content: "import * as S from '/@xoong/richtext/src/sanitize.js'; window.S = S;" });
    await page.waitForFunction(() => window.S);
  }, 60000);
  afterAll(async () => { await browser?.close(); await dev?.close(); });

  it('every shared case gives the expected output, byte for byte', async () => {
    const out = await page.evaluate((cases) => {
      const { sanitizeHtml } = window.S;
      return cases.map(([, profile, input]) => sanitizeHtml(input, profile));
    }, CASES);
    expect(out).toEqual(CASES.map((c) => c[3]));
  });

  it('what a browser parser builds from the output sanitises to the same output', async () => {
    const same = await page.evaluate((cases) => {
      const { sanitizeHtml } = window.S;
      return cases.every(([, profile, input]) => { const out = sanitizeHtml(input, profile); const t = document.createElement('template'); t.innerHTML = out; return sanitizeHtml(t.innerHTML, profile) === out; });
    }, CASES);
    expect(same).toBe(true);
  });
});
