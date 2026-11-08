// packages/ui/src/mist.css: the Mist look as one self-sufficient stylesheet (tools/build-mist.mjs makes it from the design kit).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { build, droppedSelectors } from '../tools/build-mist.mjs';
import { launchChromium } from '../tools/browser.mjs';

const root = new URL('..', import.meta.url);
const file = (p) => readFileSync(new URL(p, root), 'utf8');
const mist = file('packages/ui/src/mist.css');
const framework = ['packages/ui/src/xoong.css', 'packages/controls/src/controls.css', 'packages/richtext/src/richtext.css'].map(file);

describe('mist.css', () => {
  it('is up to date with the design kit (run: node tools/build-mist.mjs)', () => {
    expect(mist).toBe(build());
  });

  it('is self-sufficient: every custom property it reads is defined in it or by the framework files, or has a fallback', () => {
    const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
    const defined = new Set([...[mist, ...framework].flatMap((css) => [...strip(css).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))]);
    const missing = new Set();
    for (const m of strip(mist).matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) if (!m[2] && !defined.has(m[1])) missing.add(m[1]);
    expect([...missing]).toEqual([]);
  });

  it('has none of the documentation site\'s chrome, and sits in one layer', () => {
    const selectors = mist.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const chrome of ['header.top', '.shell', '.hero', '.content', '.eyebrow', 'footer.foot', '.rail', '.page-head', '.palette-toggle']) expect(selectors, chrome).not.toContain(chrome);
    expect(mist).toContain('@layer xoong-mist {');
    expect(droppedSelectors().length).toBeGreaterThan(50);
  });

  describe('in a browser, with xoong.css, controls.css, richtext.css and nothing else', () => {
    let browser, page;
    beforeAll(async () => {
      browser = await launchChromium();
      page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
      await page.setContent('<!doctype html><body><p><button id="b">Plain</button> <button id="p" class="primary">Primary</button> <input id="i" placeholder="x"> <span class="badge ok" id="badge">ok</span></p><div class="xo-seg" id="seg" role="group" aria-label="View"><button aria-pressed="true">A</button><button aria-pressed="false">B</button></div><div hidden id="h" style="display:block">gone</div></body>');
      for (const css of [...framework, mist, '* { transition: none !important; animation: none !important; }']) await page.addStyleTag({ content: css });
    });
    afterAll(async () => { await browser?.close(); });
    const style = (selector, prop) => page.$eval(selector, (el, p) => getComputedStyle(el)[p], prop);

    it('draws 40px controls, a Mist blue primary button and the Mist radius', async () => {
      expect(await style('#b', 'minHeight')).toBe('40px');
      expect(await style('#i', 'minHeight')).toBe('40px');
      expect(await style('#p', 'backgroundColor')).toBe('rgb(11, 99, 206)');
      expect(await style('#p', 'color')).toBe('rgb(255, 255, 255)');
      expect(await style('#b', 'borderRadius')).toBe('8px');
    });

    it('follows the dark scheme and keeps the primary fill', async () => {
      await page.emulateMedia({ colorScheme: 'dark' });
      expect(await style('body', 'colorScheme')).toContain('dark');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe('#121b22');
      expect(await style('#p', 'backgroundColor')).toBe('rgb(11, 99, 206)');
      await page.emulateMedia({ colorScheme: 'light' });
    });

    it('hidden stays hidden, and the segmented group and the badge are styled', async () => {
      expect(await style('#h', 'display')).toBe('none'); // [hidden] wins over a display set by the page's own rule? only when the rule is not important
      expect(await style('#seg', 'display')).not.toBe('block'); // a segmented control, not a plain block
      expect(await style('#badge', 'borderRadius')).not.toBe('0px');
    });
  });
});
