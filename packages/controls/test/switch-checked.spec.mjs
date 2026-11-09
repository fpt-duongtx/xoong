import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-switch> checked', () => {
  it('reads the new state inside the change and input listeners, from checked and from value', async () => {
    document.body.innerHTML = '<xo-switch id="s" name="n"></xo-switch>';
    await wait();
    const s = document.querySelector('#s');
    const seen = [];
    s.addEventListener('input', () => seen.push(['input', s.checked, s.value]));
    s.addEventListener('change', () => seen.push(['change', s.checked, s.value, s.querySelector('button').getAttribute('aria-checked')]));
    s.querySelector('button').click();
    expect(seen).toEqual([['input', true, true], ['change', true, true, 'true']]);
    s.querySelector('button').click();
    expect(seen.at(-1)).toEqual(['change', false, false, 'false']);
  });

  it('setting the property before the button is built paints it once it is; the property and the attribute agree', async () => {
    const s = document.createElement('xo-switch');
    s.checked = true; // before it is connected: no button yet
    document.body.append(s);
    await wait();
    expect(s.querySelector('button').getAttribute('aria-checked')).toBe('true');
    expect(s.checked).toBe(true);
    s.checked = false;
    expect(s.querySelector('button').getAttribute('aria-checked')).toBe('false');
    expect(s.value).toBe(false);
    s.toggleAttribute('checked', true);
    expect(s.checked).toBe(true);
    expect(s.querySelector('button').getAttribute('aria-checked')).toBe('true');
  });

  it('props without an accessor of their own still read and write their signal', async () => {
    document.body.innerHTML = '<xo-switch id="s" label="Notify" size="sm"></xo-switch>';
    await wait();
    const s = document.querySelector('#s');
    expect(s.label).toBe('Notify');
    s.size = 'md';
    expect(s.size).toBe('md');
  });
});
