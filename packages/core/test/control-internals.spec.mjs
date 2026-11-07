import { describe, it, expect, afterEach } from 'vitest';
import { define, XoControl } from '../src/index.js';

// happy-dom has no ElementInternals. These tests give the control a recording stand-in, to pin down exactly what it tells the
// browser (form value, validity, anchor) and how it reacts to the form-associated callbacks. The real thing is tested in Chromium
// (control.test.mjs).
const calls = [];
let formOf = null;
const fakeInternals = () => ({
  setFormValue: (v) => calls.push(['value', v]),
  setValidity: (flags, message, anchor) => calls.push(['validity', flags, message, anchor]),
  get form() { return formOf; },
});

let n = 0;
const make = (attrs = {}, Base = XoControl, install = (cls) => { cls.prototype.attachInternals = fakeInternals; }) => {
  class C extends Base {}
  install(C);
  const tag = `x-int-${++n}`;
  define(tag, C);
  const el = /** @type {any} */ (document.createElement(tag));
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
};
const last = (kind) => [...calls].reverse().find((c) => c[0] === kind);
afterEach(() => { calls.length = 0; formOf = null; document.body.replaceChildren(); });

describe('XoControl talks to ElementInternals', () => {
  it('submits the serialized value, and nothing while disabled', () => {
    const el = make({ value: 'a' });
    expect(last('value')).toEqual(['value', 'a']);
    el.setValue('b');
    expect(last('value')).toEqual(['value', 'b']);
    el.setAttribute('disabled', '');
    expect(last('value')).toEqual(['value', null]);
    el.removeAttribute('disabled');
    expect(last('value')).toEqual(['value', 'b']);
  });

  it('serialize: empty string stays empty, null/undefined submit nothing, objects as JSON, FormData and File pass through', () => {
    const el = make();
    expect(el.serialize('')).toBe('');
    expect(el.serialize(null)).toBeNull();
    expect(el.serialize(undefined)).toBeNull();
    expect(el.serialize({ a: 1 })).toBe('{"a":1}');
    expect(el.serialize(5)).toBe('5');
    const fd = new FormData();
    expect(el.serialize(fd)).toBe(fd);
    const file = new File(['x'], 'x.txt');
    expect(el.serialize(file)).toBe(file);
  });

  it('reports validity to the browser with the message and the focusable part as anchor; clears it when valid', () => {
    const el = make({ required: '' });
    el.innerHTML = '<input id="inner">';
    el.setValue(''); // re-sync now that the inner input exists
    const [, flags, message, anchor] = last('validity');
    expect(flags).toEqual({ valueMissing: true, customError: false });
    expect(message).toBe('Please fill in this field.');
    expect(anchor).toBe(el.querySelector('#inner'));
    el.setValue('x');
    expect(last('validity')).toEqual(['validity', {}, undefined, undefined]);
    el.setCustomValidity('nope');
    expect(last('validity')[1]).toEqual({ valueMissing: false, customError: true });
    el.setCustomValidity('');
    expect(last('validity')[1]).toEqual({});
  });

  it('form-associated callbacks: reset, disabled by a fieldset (apart from the disabled attribute), state restore, form', () => {
    const el = make({ value: '1' });
    el.userInput('2');
    el.formResetCallback();
    expect(el.value).toBe('1');
    el.formDisabledCallback(true);
    expect([el.isDisabled, el.disabled, el.willValidate, el.hasAttribute('data-form-disabled')]).toEqual([true, false, false, true]);
    expect(last('value')).toEqual(['value', null]);
    el.formDisabledCallback(false);
    expect([el.isDisabled, el.hasAttribute('data-form-disabled')]).toEqual([false, false]);
    expect(last('value')).toEqual(['value', '1']);
    el.formStateRestoreCallback('7');
    expect(el.value).toBe('7');
    el.formStateRestoreCallback(null); // nothing to restore: keep what we have
    expect(el.value).toBe('7');
    const form = document.createElement('form');
    formOf = form;
    expect(el.form).toBe(form);
  });

  it('without internals the form is the closest <form>; a throwing attachInternals or partial internals do not break the control', () => {
    const host = document.createElement('form');
    document.body.append(host);
    const plain = make({}, XoControl, () => {});
    host.append(plain);
    expect(plain.form).toBe(host);
    const broken = make({ required: '' }, XoControl, (cls) => { cls.prototype.attachInternals = () => { throw new Error('no'); }; });
    expect(broken.valid).toBe(false);
    const partial = make({ required: '' }, XoControl, (cls) => { cls.prototype.attachInternals = () => ({ setFormValue() { throw new Error('partial'); } }); });
    partial.setValue('x');
    expect(partial.valid).toBe(true); // our own state still works
  });

  it('attributes: required, disabled and readonly re-sync; a value set before connection is the initial value', () => {
    const el = make({ value: 'init' });
    expect(el.initialValue).toBe('init');
    el.setAttribute('required', '');
    el.setValue('');
    expect(last('validity')[2]).toBe('Please fill in this field.');
    el.setAttribute('readonly', '');
    expect(el.willValidate).toBe(false);
    el.removeAttribute('readonly');
    expect(el.willValidate).toBe(true);
    const programmatic = document.createElement(el.localName);
    programmatic.setValue?.('early'); // set before it is connected
    document.body.append(programmatic);
    expect(programmatic.initialValue).toBe('early');
    expect(programmatic.dirty).toBe(false);
  });

  it('focusTarget: the first focusable part, the host itself when it has a tabindex, otherwise null', () => {
    const el = make();
    expect(el.focusTarget).toBeNull();
    el.setAttribute('tabindex', '0');
    expect(el.focusTarget).toBe(el);
    el.innerHTML = '<span></span><button id="b">x</button>';
    expect(el.focusTarget.id).toBe('b');
    el.reportValidity(); // valid: nothing to focus, no error
    expect(el.checkValidity()).toBe(true);
  });

  it('markPristine and reset keep the data-* state attributes in step', () => {
    const el = make({ value: 'a', required: '' });
    el.userInput('b');
    expect(el.hasAttribute('data-dirty')).toBe(true);
    el.markPristine();
    expect(el.hasAttribute('data-dirty')).toBe(false);
    el.setValue('');
    expect(el.hasAttribute('data-invalid')).toBe(true);
    el.markTouched();
    el.markTouched(); // idempotent
    expect(el.hasAttribute('data-touched')).toBe(true);
    el.reset();
    expect(el.hasAttribute('data-touched')).toBe(false);
  });
});
