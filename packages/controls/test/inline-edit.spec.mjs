import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';
import '../src/inline-edit.js';

const mount = async (attrs = '') => {
  document.body.innerHTML = `<form><xo-inline-edit name="title" value="Greece Golden Visa" ${attrs}></xo-inline-edit></form>`;
  await new Promise((r) => setTimeout(r, 0));
  return document.querySelector('xo-inline-edit');
};
const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const log = (el) => { const seen = []; for (const n of ['input', 'change', 'save', 'cancel']) el.addEventListener(n, (e) => seen.push(n + (e.detail?.value ? `:${e.detail.value}` : ''))); return seen; };
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-inline-edit>', () => {
  it('shows the text and a ghost icon button named Rename (or label)', async () => {
    const el = await mount();
    expect(el.querySelector('.xo-inline-edit__text').textContent).toBe('Greece Golden Visa');
    const b = el.querySelector('button');
    expect(b.getAttribute('aria-label')).toBe('Rename');
    expect(b.classList.contains('ghost')).toBe(true);
    expect(b.querySelector('.ic[data-ic=edit]')).toBeTruthy();
    const l = await mount('label="Rename title"');
    expect(l.querySelector('button').getAttribute('aria-label')).toBe('Rename title');
  });
  it('the button or the text starts editing: an input takes over, focused with the text selected', async () => {
    const el = await mount('label="Rename title"');
    el.querySelector('button').click();
    const input = el.querySelector('input');
    expect(input.value).toBe('Greece Golden Visa');
    expect(input.getAttribute('aria-label')).toBe('Rename title');
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(el.querySelector('.xo-inline-edit__text')).toBe(null);
    expect(el.editing).toBe(true);
    key(input, 'Escape');
    el.querySelector('.xo-inline-edit__text').click();
    expect(el.querySelector('input')).toBeTruthy();
  });
  it('Enter saves: value updated, input, change and save fire, focus returns to the button', async () => {
    const el = await mount();
    const seen = log(el);
    el.edit();
    const input = el.querySelector('input');
    input.value = '  Portugal Visa ';
    key(input, 'Enter');
    expect(el.value).toBe('Portugal Visa');
    expect(el.querySelector('.xo-inline-edit__text').textContent).toBe('Portugal Visa');
    expect(el.querySelector('input')).toBe(null);
    expect(seen).toEqual(['input', 'change', 'save:Portugal Visa']);
    expect(document.activeElement).toBe(el.querySelector('button'));
    expect(el.dirty).toBe(true);
  });
  it('Escape cancels and keeps the old value', async () => {
    const el = await mount();
    const seen = log(el);
    el.edit();
    el.querySelector('input').value = 'Something else';
    key(el.querySelector('input'), 'Escape');
    expect(el.value).toBe('Greece Golden Visa');
    expect(seen).toEqual(['cancel']);
    expect(el.querySelector('.xo-inline-edit__text').textContent).toBe('Greece Golden Visa');
  });
  it('blur saves; an empty text cancels; an unchanged text closes quietly', async () => {
    const el = await mount();
    const seen = log(el);
    el.edit();
    el.querySelector('input').value = 'Spain Visa';
    el.querySelector('input').dispatchEvent(new Event('blur'));
    expect(el.value).toBe('Spain Visa');
    expect(seen).toEqual(['input', 'change', 'save:Spain Visa']);
    seen.length = 0;
    el.edit();
    el.querySelector('input').value = '   ';
    key(el.querySelector('input'), 'Enter');
    expect(el.value).toBe('Spain Visa');
    expect(seen).toEqual(['cancel']);
    seen.length = 0;
    el.edit();
    key(el.querySelector('input'), 'Enter');
    expect(seen).toEqual([]);
    expect(el.editing).toBe(false);
  });
  it('disabled and readonly cannot be edited; reset restores the value', async () => {
    for (const a of ['disabled', 'readonly']) {
      const el = await mount(a);
      el.querySelector('.xo-inline-edit__text').click();
      el.edit();
      expect(el.querySelector('input')).toBe(null);
      expect(el.querySelector('button').disabled).toBe(true);
    }
    const el = await mount();
    el.edit(); el.querySelector('input').value = 'New'; key(el.querySelector('input'), 'Enter');
    el.reset();
    expect(el.value).toBe('Greece Golden Visa');
    expect(el.querySelector('.xo-inline-edit__text').textContent).toBe('Greece Golden Visa');
  });
  it('submits its value in a form model', async () => {
    const el = await mount();
    expect(el.serialize(el.value)).toBe('Greece Golden Visa');
  });
});
