import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const mount = async (html) => { document.body.innerHTML = html; await new Promise((r) => setTimeout(r, 0)); return document.body.firstElementChild; };
const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-range-slider>', () => {
  it('two named inputs, the fill between them, thumbs that cannot cross, one input and one change per move', async () => {
    const el = await mount('<xo-range-slider name="price" label="Price" value="20,70" min-label="Minimum price" max-label="Maximum price"></xo-range-slider>');
    const [a, b] = el.querySelectorAll('input[type=range]');
    expect(el.querySelector('[role=group]').getAttribute('aria-label')).toBe('Price');
    expect([a.getAttribute('aria-label'), b.getAttribute('aria-label')]).toEqual(['Minimum price', 'Maximum price']);
    expect(el.value).toEqual([20, 70]);
    const fill = el.querySelector('.xo-range-dual__fill');
    expect([fill.style.left, fill.style.right]).toEqual(['20%', '30%']);
    const seen = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    a.value = '90'; a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.value).toEqual([70, 70]); // stops at the other thumb
    expect(seen).toEqual(['input', 'change']);
    expect(el.serialize(el.value)).toBe('70,70');
  });
});

describe('<xo-segmented>', () => {
  const html = '<xo-segmented name="p" label="Billing" value="month"><button value="month">Monthly</button><button value="year">Yearly</button></xo-segmented>';
  it('buttons with aria-pressed, a value, arrows move the focus, clicks choose and fire change', async () => {
    const el = await mount(html);
    const [m, y] = el.querySelectorAll('button');
    expect(el.querySelector('.xo-seg').getAttribute('role')).toBe('group');
    expect([m.getAttribute('aria-pressed'), y.getAttribute('aria-pressed')]).toEqual(['true', 'false']);
    expect(el.value).toBe('month');
    m.focus(); key(m, 'ArrowRight');
    expect(document.activeElement).toBe(y);
    const seen = [];
    el.addEventListener('change', () => seen.push(el.value));
    y.click(); y.click();
    expect(el.value).toBe('year');
    expect(seen).toEqual(['year']);
    expect(m.getAttribute('aria-pressed')).toBe('false');
  });
  it('multiple toggles each segment; clearable unchooses', async () => {
    const many = await mount('<xo-segmented multiple><button value="a">A</button><button value="b">B</button></xo-segmented>');
    const [a, b] = many.querySelectorAll('button');
    a.click(); b.click(); a.click();
    expect(many.value).toEqual(['b']);
    const one = await mount('<xo-segmented clearable value="a"><button value="a">A</button></xo-segmented>');
    one.querySelector('button').click();
    expect(one.value).toBe('');
  });
});

describe('<xo-split-button>', () => {
  it('the first child is the main button; the rest are menu items behind a named arrow', async () => {
    const el = await mount('<xo-split-button more="More publish options"><button class="primary" id="main">Publish</button><button id="a">Schedule</button><a href="#p">Preview</a></xo-split-button>');
    const wrap = el.querySelector('.xo-split-button');
    expect(wrap.firstElementChild.id).toBe('main');
    const arrow = wrap.querySelector('[xo-menu-trigger]');
    expect(arrow.getAttribute('aria-label')).toBe('More publish options');
    expect(arrow.classList.contains('primary')).toBe(true);
    expect(wrap.querySelector('xo-menu').contains(document.querySelector('#a'))).toBe(true);
  });
});

describe('<xo-textarea>', () => {
  it('counts characters, warns near the limit, is invalid over it and keeps the pasted text', async () => {
    const el = await mount('<xo-textarea name="e" label="Excerpt" maxlength="10"></xo-textarea>');
    const area = el.querySelector('textarea');
    const count = el.querySelector('.hint');
    const type = (t) => { area.value = t; area.dispatchEvent(new Event('input', { bubbles: true })); };
    type('hello');
    expect(count.textContent).toBe('5 / 10');
    expect(count.getAttribute('aria-live')).toBe('off');
    expect(el.valid).toBe(true);
    type('123456789');
    expect(count.getAttribute('aria-live')).toBe('polite');
    type('this is too long');
    expect(el.value).toBe('this is too long');
    expect(el.valid).toBe(false);
    expect(count.classList.contains('error')).toBe(true);
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('.xo-progress i').style.width).toBe('100%');
  });
});

describe('<xo-stat>', () => {
  it('label, value, a delta with an arrow and a sign, and a sparkline that is hidden from assistive tech', async () => {
    const el = await mount('<xo-stat label="Visits" value="48,210" delta="12.4" delta-label="vs last week" series="1,3,2,5"></xo-stat>');
    expect(el.classList.contains('xo-kpi')).toBe(true);
    expect(el.querySelector('.xo-kpi__label').textContent).toBe('Visits');
    expect(el.querySelector('.xo-kpi__value').textContent).toBe('48,210');
    const d = el.querySelector('.xo-kpi__delta');
    expect(d.textContent).toContain('+12.4%');
    expect(d.textContent).toContain('vs last week');
    expect(d.dataset.good).toBe('true');
    expect(d.querySelector('.ic').dataset.ic).toBe('arrow-up');
    expect(el.querySelector('svg.xo-kpi__spark').getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('svg path').getAttribute('d')).toMatch(/^M0\.0 /);
  });
  it('a falling number is bad unless down-is-good', async () => {
    const bad = await mount('<xo-stat label="Errors" value="3" delta="-5"></xo-stat>');
    expect(bad.querySelector('.xo-kpi__delta').dataset.good).toBe('false');
    expect(bad.querySelector('.xo-kpi__delta').textContent).toContain('−5%');
    const good = await mount('<xo-stat label="Errors" value="3" delta="-5" trend="down-is-good"></xo-stat>');
    expect(good.querySelector('.xo-kpi__delta').dataset.good).toBe('true');
  });
});
