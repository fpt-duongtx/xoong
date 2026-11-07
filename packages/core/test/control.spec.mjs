import { describe, it, expect, afterEach } from 'vitest';
import { effect, html, define, XoControl } from '../src/index.js';

// happy-dom has no ElementInternals: these tests cover the control's own model (the fallback path).
// The browser-only behaviour (FormData, native validation, form reset, fieldset) is tested in real Chromium: control.test.mjs.
let n = 0;
class Stars extends XoControl {
  static props = { ...XoControl.props, max: Number };
  render() { return html`<button type="button" @click=${() => this.userInput(String(Number(this.value || 0) + 1))}>+</button>`; }
  validate(value) { return this.max && Number(value) > this.max ? 'Too many stars' : ''; }
}
define('x-stars', Stars);
const make = (attrs = '') => {
  const host = document.createElement('div');
  host.innerHTML = `<form><x-stars name="rating" ${attrs}></x-stars></form>`;
  document.body.append(host);
  return { host, el: /** @type {any} */ (host.querySelector('x-stars')) };
};
let current;
afterEach(() => current?.host.remove());

describe('XoControl model', () => {
  it('takes its initial value from the attribute and is pristine', () => {
    current = make('value="3"');
    expect(current.el.value).toBe('3');
    expect(current.el.initialValue).toBe('3');
    expect([current.el.dirty, current.el.pristine, current.el.touched]).toEqual([false, true, false]);
    expect(current.el.hasAttribute('data-dirty')).toBe(false);
  });

  it('user input changes the value, fires input once, and makes the control dirty; back to the initial value is pristine again', () => {
    current = make('value="1"');
    const events = [];
    current.el.addEventListener('input', () => events.push('input'));
    current.el.querySelector('button').click();
    expect(current.el.value).toBe('2');
    expect(events).toEqual(['input']);
    expect(current.el.dirty).toBe(true);
    expect(current.el.hasAttribute('data-dirty')).toBe(true);
    current.el.setValue('1'); // programmatic: no event
    expect(events).toEqual(['input']);
    expect(current.el.dirty).toBe(false);
  });

  it('required: empty is invalid with a message; a value or a clear makes it valid', () => {
    current = make('required');
    const c = current.el;
    expect([c.valid, c.validity.valueMissing, c.validationMessage]).toEqual([false, true, 'Please fill in this field.']);
    expect(c.hasAttribute('data-invalid')).toBe(true);
    c.setValue('x');
    expect([c.valid, c.validity.valueMissing]).toEqual([true, false]);
    expect(c.hasAttribute('data-invalid')).toBe(false);
  });

  it('validate() hook and setCustomValidity(): the custom message wins and clears with an empty string', () => {
    current = make('max="3"');
    const c = current.el;
    c.setValue('5');
    expect(c.validationMessage).toBe('Too many stars');
    expect(c.validity.customError).toBe(true);
    c.setCustomValidity('Server says no');
    expect(c.validationMessage).toBe('Server says no');
    c.setCustomValidity('');
    expect(c.validationMessage).toBe('Too many stars');
    c.setValue('2');
    expect(c.valid).toBe(true);
  });

  it('checkValidity fires invalid (cancelable) only for invalid, validating controls; reportValidity marks it touched and focuses it', () => {
    current = make('required');
    const c = current.el;
    let invalid = 0;
    c.addEventListener('invalid', () => { invalid++; });
    expect(c.checkValidity()).toBe(false);
    expect(invalid).toBe(1);
    expect(c.touched).toBe(false);
    expect(c.reportValidity()).toBe(false);
    expect(c.touched).toBe(true);
    expect(document.activeElement).toBe(c.querySelector('button'));
    c.setAttribute('readonly', ''); // read-only controls are not validated, like native inputs
    expect(c.willValidate).toBe(false);
    expect(c.checkValidity()).toBe(true);
  });

  it('blur inside the control marks it touched, moving focus within it does not', () => {
    current = make();
    const c = current.el;
    c.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: c.querySelector('button') }));
    expect(c.touched).toBe(false);
    c.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(c.touched).toBe(true);
    expect(c.hasAttribute('data-touched')).toBe(true);
  });

  it('reset() returns to the initial value untouched; markPristine() makes the current value the baseline', () => {
    current = make('value="1"');
    const c = current.el;
    c.userInput('4');
    c.markTouched();
    c.setCustomValidity('x');
    c.reset();
    expect([c.value, c.dirty, c.touched, c.validationMessage]).toEqual(['1', false, false, '']);
    c.userInput('9');
    c.markPristine();
    expect([c.value, c.initialValue, c.dirty]).toEqual(['9', '9', false]);
    c.reset();
    expect(c.value).toBe('9');
  });

  it('state is reactive: an effect reading dirty/valid reruns on change', () => {
    current = make('required');
    const c = current.el;
    const seen = [];
    const stop = effect(() => { seen.push([c.dirty, c.valid]); });
    c.userInput('1');
    c.reset();
    stop();
    expect(seen).toEqual([[false, false], [true, true], [false, false]]);
  });

  it('structured values: dirty compares by content, serialize and isEmpty are overridable', () => {
    class Tags extends XoControl {
      serialize(v) { return v.join(','); }
      isEmpty(v) { return v.length === 0; }
    }
    define(`x-tags-${++n}`, Tags);
    const el = /** @type {any} */ (document.createElement(`x-tags-${n}`));
    el.setAttribute('required', '');
    document.body.append(el);
    el.setValue(['a']);
    el.markPristine(); // a value set after connection is a change; this makes it the baseline
    expect(el.valid).toBe(true);
    el.userInput(['a', 'b']);
    expect(el.dirty).toBe(true);
    el.userInput(['a']);
    expect(el.dirty).toBe(false); // same content as the initial array
    el.setValue([]);
    expect(el.valid).toBe(false);
    expect(el.serialize(['a', 'b'])).toBe('a,b');
    el.remove();
  });
});
