import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';
import '../src/otp.js';

const mount = async (attrs = '') => {
  document.body.innerHTML = `<form><xo-otp name="code" label="Login code" ${attrs}></xo-otp></form>`;
  await new Promise((r) => setTimeout(r, 0));
  return document.querySelector('xo-otp');
};
const boxes = (el) => [...el.querySelectorAll('input')];
const type = (box, d) => { box.value = d; box.dispatchEvent(new Event('input', { bubbles: true })); };
const key = (box, k) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); box.dispatchEvent(e); return e; };
const paste = (box, s) => { const e = new Event('paste', { bubbles: true, cancelable: true }); e.clipboardData = { getData: () => s }; box.dispatchEvent(e); return e; };
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-otp>', () => {
  it('draws a labelled group of six numeric boxes, named by digit, one-time-code on the first', async () => {
    const el = await mount();
    const g = el.querySelector('.xo-otp');
    expect(g.getAttribute('role')).toBe('group');
    expect(g.getAttribute('aria-label')).toBe('Login code');
    const b = boxes(el);
    expect(b.length).toBe(6);
    expect(b[0].getAttribute('autocomplete')).toBe('one-time-code');
    expect(b[1].getAttribute('autocomplete')).toBe('off');
    expect(b.map((x) => x.getAttribute('aria-label'))).toEqual(['Digit 1', 'Digit 2', 'Digit 3', 'Digit 4', 'Digit 5', 'Digit 6']);
    expect(b.every((x) => x.getAttribute('maxlength') === '1' && x.getAttribute('inputmode') === 'numeric')).toBe(true);
  });
  it('length sets the number of boxes; the group has a default name', async () => {
    document.body.innerHTML = '<xo-otp length="4"></xo-otp>';
    await new Promise((r) => setTimeout(r, 0));
    const el = document.querySelector('xo-otp');
    expect(boxes(el).length).toBe(4);
    expect(el.querySelector('.xo-otp').getAttribute('aria-label')).toBe('Verification code');
  });
  it('typing a digit moves forward, builds the value and fires input; a letter is dropped', async () => {
    const el = await mount();
    const seen = [];
    el.addEventListener('input', () => seen.push('input'));
    const b = boxes(el);
    b[0].focus();
    type(b[0], '4');
    expect(document.activeElement).toBe(b[1]);
    type(b[1], 'x');
    expect(b[1].value).toBe('');
    expect(document.activeElement).toBe(b[1]);
    type(b[1], '8');
    expect(el.value).toBe('48');
    expect(seen).toEqual(['input', 'input']);
    expect(el.dirty).toBe(true);
    expect(key(b[2], 'q').defaultPrevented).toBe(true);
    expect(key(b[2], '5').defaultPrevented).toBe(false);
  });
  it('Backspace clears and moves back; arrows, Home and End move', async () => {
    const el = await mount('value="123"');
    const b = boxes(el);
    expect(b.slice(0, 4).map((x) => x.value)).toEqual(['1', '2', '3', '']);
    b[3].focus();
    key(b[3], 'Backspace'); // empty: clears the one before and moves there
    expect(el.value).toBe('12');
    expect(document.activeElement).toBe(b[2]);
    type(b[2], '9'); b[2].focus();
    key(b[2], 'Backspace'); // filled: clears it and moves back
    expect(el.value).toBe('12');
    expect(document.activeElement).toBe(b[1]);
    key(b[1], 'ArrowLeft'); expect(document.activeElement).toBe(b[0]);
    key(b[0], 'ArrowRight'); expect(document.activeElement).toBe(b[1]);
    key(b[1], 'End'); expect(document.activeElement).toBe(b[5]);
    key(b[5], 'Home'); expect(document.activeElement).toBe(b[0]);
  });
  it('paste splits the digits across the boxes and complete fires once with the code', async () => {
    const el = await mount();
    const done = [], changes = [];
    el.addEventListener('complete', (e) => done.push(e.detail.value));
    el.addEventListener('change', () => changes.push(1));
    const b = boxes(el);
    const e = paste(b[0], ' 481-516 ');
    expect(e.defaultPrevented).toBe(true);
    expect(b.map((x) => x.value).join('')).toBe('481516');
    expect(el.value).toBe('481516');
    expect(done).toEqual(['481516']);
    expect(changes.length).toBe(1);
  });
  it('a partial paste starts at the focused box; an autofill into one box is split too', async () => {
    const el = await mount();
    const b = boxes(el);
    paste(b[2], '12');
    expect(b[2].value + b[3].value).toBe('12');
    expect(document.activeElement).toBe(b[4]);
    type(b[0], '987654');
    expect(el.value).toBe('987654');
  });
  it('complete fires when the last box is filled by typing; an incomplete code is invalid', async () => {
    const el = await mount('required');
    expect(el.valid).toBe(false); // required, empty
    const b = boxes(el);
    const done = [];
    el.addEventListener('complete', (e) => done.push(e.detail.value));
    '12345'.split('').forEach((d, i) => type(b[i], d));
    expect(done).toEqual([]);
    expect(el.validationMessage).toBe('Enter all 6 digits.');
    type(b[5], '6');
    expect(done).toEqual(['123456']);
    expect(el.valid).toBe(true);
  });
  it('setValue keeps digits only, reset goes back, disabled boxes ignore edits', async () => {
    const el = await mount('value="12"');
    el.setValue('a1b2c3d4e5f6g7');
    expect(el.value).toBe('123456');
    expect(boxes(el).map((x) => x.value).join('')).toBe('123456');
    el.reset();
    expect(el.value).toBe('12');
    expect(boxes(el).map((x) => x.value).join('')).toBe('12');
    el.setAttribute('disabled', '');
    expect(boxes(el).every((x) => x.disabled)).toBe(true);
    type(boxes(el)[2], '5');
    expect(el.value).toBe('12');
  });
});
