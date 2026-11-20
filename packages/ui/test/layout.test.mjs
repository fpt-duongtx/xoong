// The layout elements of xoong.css (xo-stack, xo-row, xo-grid, xo-center): what each does to its children, measured in a real browser.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { launchChromium } from '../../../tools/browser.mjs';

const css = readFileSync(new URL('../src/xoong.css', import.meta.url), 'utf8');
let browser, page;

beforeAll(async () => {
  browser = await launchChromium();
  page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
}, 60000);
afterAll(async () => { await browser?.close(); });

/** Show `html` in a page that has xoong.css (and `extra` css after it, unlayered like an author's). */
const show = async (html, extra = '', width = 1200) => {
  await page.setViewportSize({ width, height: 800 });
  await page.setContent(`<!doctype html><html><head><style>${css}${extra} body { margin: 0; } .c { width: 100px; height: 40px; background: #ccc; }</style></head><body>${html}</body></html>`);
};
const box = (selector) => page.$eval(selector, (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
const style = (selector, prop) => page.$eval(selector, (el, p) => getComputedStyle(el)[p], prop);
const kids = '<div class="c" id="a"></div><div class="c" id="b"></div><div class="c" id="d"></div>';

describe('<xo-stack>', () => {
  it('puts the children one under the other, with a gap of 1rem; gap="1" to "4" are the space tokens, "0" none', async () => {
    await show(`<xo-stack id="s">${kids}</xo-stack>`);
    expect(await style('#s', 'flexDirection')).toBe('column');
    expect((await box('#b')).y - (await box('#a')).y).toBe(40 + 16);
    for (const [gap, px] of [['0', 0], ['1', 4], ['2', 8], ['3', 16], ['4', 24]]) {
      await show(`<xo-stack gap="${gap}" id="s">${kids}</xo-stack>`);
      expect(await style('#s', 'rowGap'), `gap=${gap}`).toBe(`${px}px`);
    }
  });

  it('the children fill the width, or sit at the start, the middle or the end', async () => {
    await show('<xo-stack id="s"><div id="a" style="height: 40px; background: #ccc"></div></xo-stack>');
    expect((await box('#a')).w).toBe(1200); // a child with no width of its own stretches to the stack
    for (const [align, x] of [['start', 0], ['center', 550], ['end', 1100]]) {
      await show(`<xo-stack align="${align}">${kids}</xo-stack>`);
      expect((await box('#a')).x, `align=${align}`).toBe(x);
    }
  });
});

describe('<xo-row>', () => {
  it('puts the children side by side, vertically centred, with a gap of 0.5rem', async () => {
    await show('<xo-row id="r"><div class="c" id="a"></div><div class="c" id="b" style="height: 80px"></div></xo-row>');
    expect(await style('#r', 'flexDirection')).toBe('row');
    expect((await box('#b')).x - (await box('#a')).x).toBe(100 + 8);
    expect((await box('#a')).y).toBe(20); // 40px tall in an 80px row: centred
  });

  it('align: start, end, baseline and stretch', async () => {
    const html = (align) => `<xo-row align="${align}"><div class="c" id="a"></div><div class="c" id="b" style="height: 80px"></div></xo-row>`;
    await show(html('start')); expect((await box('#a')).y).toBe(0);
    await show(html('end')); expect((await box('#a')).y).toBe(40);
    await show(html('baseline')); expect(await style('xo-row', 'alignItems')).toBe('baseline');
    await show(`<xo-row align="stretch"><div id="a" style="width: 50px; background: #ccc"></div><div class="c" style="height: 80px"></div></xo-row>`); expect((await box('#a')).h).toBe(80);
  });

  it('justify: start, center, end and between', async () => {
    const html = (j) => `<xo-row justify="${j}"><div class="c" id="a"></div><div class="c" id="b"></div></xo-row>`;
    await show(html('start')); expect((await box('#a')).x).toBe(0);
    await show(html('center')); expect((await box('#a')).x).toBe((1200 - 208) / 2);
    await show(html('end')); expect((await box('#b')).x).toBe(1100);
    await show(html('between')); expect([(await box('#a')).x, (await box('#b')).x]).toEqual([0, 1100]);
  });

  it('a child with grow takes the free space, and may shrink below its content', async () => {
    await show('<xo-row><input id="i" grow value="a long value that would not shrink" style="width: 900px"><button id="b">Go</button></xo-row>', '', 400);
    const i = await box('#i'), b = await box('#b');
    expect(i.w + b.w + 8).toBe(400); // fills the row, and does not push the button out
  });

  it('wrap: children go on a new line when they do not fit; without it they stay on one', async () => {
    await show(`<div style="width: 250px"><xo-row id="r" wrap>${kids}</xo-row></div>`);
    expect((await box('#d')).y).toBeGreaterThan((await box('#a')).y);
    await show(`<div style="width: 250px"><xo-row id="r">${kids}</xo-row></div>`);
    expect((await box('#d')).y).toBe((await box('#a')).y);
  });
});

describe('<xo-grid>', () => {
  const tracks = (selector) => style(selector, 'gridTemplateColumns').then((v) => v.split(' ').length);

  it('cols="1" to "4" make that many equal columns on a wide screen, and one on a phone', async () => {
    for (const n of [1, 2, 3, 4]) {
      await show(`<xo-grid id="g" cols="${n}">${kids}</xo-grid>`);
      expect(await tracks('#g'), `cols=${n}`).toBe(n);
    }
    await show(`<xo-grid id="g" cols="3">${kids}</xo-grid>`, '', 500);
    expect(await tracks('#g')).toBe(1);
  });

  it('without cols it fits as many columns of at least 16rem as there is room for, and the child may not overflow', async () => {
    await show(`<xo-grid id="g">${kids}</xo-grid>`);
    expect(await tracks('#g')).toBe(4); // 1200px holds four columns of 16rem and three gaps
    await show(`<xo-grid id="g">${kids}</xo-grid>`, '', 300);
    expect(await tracks('#g')).toBe(1);
    await show(`<xo-grid id="g" style="--xo-grid-min: 8rem">${kids}</xo-grid>`, '', 600);
    expect(await tracks('#g')).toBeGreaterThanOrEqual(3);
  });

  it('gap is the same scale as the other layout elements', async () => {
    await show(`<xo-grid id="g" gap="4">${kids}</xo-grid>`);
    expect(await style('#g', 'columnGap')).toBe('24px');
  });
});

describe('<xo-center>', () => {
  it('is centred, 64rem wide at most, with padding at the sides; narrow is 40rem and wide 80rem', async () => {
    await show('<xo-center id="c"><div class="c"></div></xo-center>', '', 1400);
    const wide = await box('#c');
    expect(wide.w).toBe(1024);
    expect(wide.x).toBe((1400 - 1024) / 2);
    expect(await style('#c', 'paddingLeft')).toBe('16px');
    await show('<xo-center id="c" size="narrow"><div class="c"></div></xo-center>', '', 1400);
    expect((await box('#c')).w).toBe(640);
    await show('<xo-center id="c" size="wide"><div class="c"></div></xo-center>', '', 1400);
    expect((await box('#c')).w).toBe(1280);
  });

  it('on a phone it is the width of the screen, never wider', async () => {
    await show('<xo-center id="c"><div class="c"></div></xo-center>', '', 360);
    expect((await box('#c')).w).toBe(360);
  });
});

describe('the cascade', () => {
  it("an author's own css wins over the layout, whatever its specificity, and [hidden] still hides", async () => {
    await show(`<xo-row id="r" gap="2">${kids}</xo-row><xo-stack id="h" hidden>${kids}</xo-stack>`, 'xo-row { column-gap: 40px; }');
    expect(await style('#r', 'columnGap')).toBe('40px');
    expect(await style('#h', 'display')).toBe('none');
  });
});
