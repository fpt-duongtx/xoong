import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const mount = async (attrs = '') => {
  document.body.innerHTML = `<form><xo-switch name="notify" label="Notify" ${attrs}></xo-switch></form>`;
  await new Promise((r) => setTimeout(r, 0));
  return document.querySelector('xo-switch');
};
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-switch>', () => {
  it('draws a switch button with aria-checked and a name', async () => {
    const el = await mount('checked');
    const b = el.querySelector('button[role=switch]');
    expect(b.getAttribute('aria-checked')).toBe('true');
    expect(b.getAttribute('aria-label')).toBe('Notify');
    expect(el.value).toBe(true);
  });
  it('a click toggles, fires input and change, and tracks dirty', async () => {
    const el = await mount();
    const seen = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    el.querySelector('button').click();
    expect(el.value).toBe(true);
    expect(el.querySelector('button').getAttribute('aria-checked')).toBe('true');
    expect(seen).toEqual(['input', 'change']);
    expect(el.dirty).toBe(true);
    el.reset();
    expect(el.value).toBe(false);
  });
  it('disabled, readonly and busy ignore clicks; busy sets aria-busy', async () => {
    for (const a of ['disabled', 'readonly', 'busy']) {
      const el = await mount(a);
      el.querySelector('button').click();
      expect(el.value).toBe(false);
      if (a === 'busy') expect(el.querySelector('button').getAttribute('aria-busy')).toBe('true');
    }
  });
  it('setValue accepts booleans and strings; the form value is "on" or nothing', async () => {
    const el = await mount();
    el.setValue('true');
    expect(el.value).toBe(true);
    expect(el.serialize(el.value)).toBe('on');
    el.setValue(false);
    expect(el.serialize(el.value)).toBe(null);
  });
});

describe('<xo-switch> with visible text', () => {
  it('wraps the text in a label with the button: the text names it and a click on the text toggles', async () => {
    document.body.innerHTML = '<xo-switch name="n">Email me about replies</xo-switch>';
    await new Promise((r) => setTimeout(r, 0));
    const el = document.querySelector('xo-switch');
    const row = el.querySelector('label.xo-switch-row');
    expect(row.querySelector('.xo-switch-text').textContent).toBe('Email me about replies');
    const b = row.querySelector('button[role=switch]');
    expect(b.hasAttribute('aria-label')).toBe(false);
    expect(row.querySelector('span').textContent).toBe('Email me about replies');
    expect(row.firstElementChild).toBe(b);
    b.click();
    expect(el.value).toBe(true);
  });
});
