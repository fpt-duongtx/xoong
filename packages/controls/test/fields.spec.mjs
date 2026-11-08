import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const mount = async (html) => { document.body.innerHTML = `<form>${html}</form>`; await new Promise((r) => setTimeout(r, 0)); return document.body.firstElementChild.firstElementChild; };
const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-slider>', () => {
  it('a native range with the fill, a name and stop labels; one input and one change event', async () => {
    const el = await mount('<xo-slider name="q" label="Quality" min="0" max="2" step="1" value="1" labels="Low,Medium,High"></xo-slider>');
    const r = el.querySelector('input[type=range]');
    expect(r.getAttribute('aria-label')).toBe('Quality');
    expect(r.getAttribute('aria-valuetext')).toBe('Medium');
    expect(r.style.getPropertyValue('--p')).toBe('50%');
    const seen = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    r.value = '2'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.value).toBe(2);
    expect(seen).toEqual(['input', 'change']);
    expect(r.getAttribute('aria-valuetext')).toBe('High');
  });
});

describe('<xo-stepper>', () => {
  it('buttons and keys change by step, clamp, and disable at the limits', async () => {
    const el = await mount('<xo-stepper name="n" label="Per page" min="1" max="30" step="5" value="25"></xo-stepper>');
    const input = el.querySelector('input');
    const [minus, plus] = el.querySelectorAll('button');
    expect(input.getAttribute('role')).toBe('spinbutton');
    expect(input.getAttribute('aria-valuenow')).toBe('25');
    plus.click();
    expect(el.value).toBe(30);
    expect(plus.disabled).toBe(true);
    key(input, 'Home');
    expect(el.value).toBe(1);
    expect(minus.disabled).toBe(true);
    key(input, 'PageUp');
    expect(el.value).toBe(30); // 1 + 10 steps of 5, clamped
    key(input, 'ArrowDown');
    expect(el.value).toBe(25);
  });
  it('typed text is clamped when the field is left; nonsense is reverted; events fire once', async () => {
    const el = await mount('<xo-stepper min="1" max="10" value="5"></xo-stepper>');
    const input = el.querySelector('input');
    const seen = [];
    el.addEventListener('change', () => seen.push('change'));
    input.value = '99'; input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.value).toBe(10);
    expect(input.value).toBe('10');
    input.value = 'abc'; input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(input.value).toBe('10');
    expect(seen).toEqual(['change']);
  });
});

describe('<xo-password>', () => {
  it('the eye toggles the type, aria-pressed and its name; the value follows typing', async () => {
    const el = await mount('<xo-password name="p" label="Password"></xo-password>');
    const input = el.querySelector('input');
    const eye = el.querySelector('button');
    expect(eye.getAttribute('aria-label')).toBe('Show password');
    eye.click();
    expect(input.type).toBe('text');
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    expect(eye.getAttribute('aria-label')).toBe('Hide password');
    input.value = 'secret'; input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.value).toBe('secret');
  });
});

describe('<xo-copy>', () => {
  it('shows the value, copies it, says Copied and fires copied', async () => {
    let written = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { written = t; } }, configurable: true });
    const el = await mount('<xo-copy value="xo_live_1" label="API key"></xo-copy>');
    expect(el.querySelector('input').value).toBe('xo_live_1');
    expect(el.querySelector('input').readOnly).toBe(true);
    let detail;
    el.addEventListener('copied', (e) => { detail = e.detail; });
    el.querySelector('button').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(written).toBe('xo_live_1');
    expect(detail).toEqual({ text: 'xo_live_1' });
    expect(el.querySelector('button').dataset.state).toBe('copied');
    expect(el.querySelector('button').textContent).toBe('Copied');
  });
});
