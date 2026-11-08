// @ts-check
/**
 * <xo-stepper> is a number with minus and plus buttons; `value` is a number (or '' when empty).
 *
 *   <xo-stepper name="perPage" label="Items per page" min="1" max="100" step="5" value="25"></xo-stepper>
 *
 * - ArrowUp/ArrowDown change by `step`, PageUp/PageDown by ten steps, Home/End go to `min`/`max` when they are set. The value is clamped;
 *   at the limit the matching button is disabled. Typing is free until the field is left, then the number is clamped.
 * - The input has the spinbutton semantics (`role=spinbutton`, `aria-valuemin/max/now`); the buttons are named Decrease and Increase.
 */
import { XoControl, define, text } from '@xoong/core';

class XoStepper extends XoControl {
  static props = { ...XoControl.props, label: String, min: Number, max: Number, step: Number };

  /** @type {HTMLInputElement | null} */ #input = null;
  /** @type {HTMLButtonElement[]} */ #buttons = [];

  setValue(v) { const n = Number(v); super.setValue(v === '' || v == null || Number.isNaN(n) ? '' : this.#clamp(n)); this.#paint(); }
  get focusTarget() { return this.#input; }
  #clamp(/** @type {number} */ n) { return Math.min(this.max ?? Infinity, Math.max(this.min ?? -Infinity, n)); }
  get #step() { return this.step || 1; }

  connected() {
    const wrap = document.createElement('div');
    wrap.className = 'xo-stepper';
    const button = (/** @type {number} */ dir, /** @type {string} */ label, /** @type {string} */ icon) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', label); b.tabIndex = -1;
      b.innerHTML = `<span class="ic" data-ic="${icon}" aria-hidden="true"></span>`;
      b.addEventListener('click', () => this.#move(dir));
      return b;
    };
    const input = document.createElement('input');
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('role', 'spinbutton');
    input.autocomplete = 'off';
    input.addEventListener('input', (e) => e.stopPropagation()); // typing is free: the value is read when the field is left
    input.addEventListener('change', (e) => { e.stopPropagation(); this.#commit(); });
    input.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'Enter') { this.#commit(); return; }
      const by = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[k];
      if (by) { e.preventDefault(); this.#move(by); }
      else if ((k === 'Home' && this.min != null) || (k === 'End' && this.max != null)) { e.preventDefault(); this.#set(k === 'Home' ? /** @type {number} */ (this.min) : /** @type {number} */ (this.max)); }
    });
    this.#input = input;
    this.#buttons = [button(-1, text('xoong.controls.decrease', 'Decrease'), 'minus'), button(1, text('xoong.controls.increase', 'Increase'), 'plus')];
    wrap.append(this.#buttons[0], input, this.#buttons[1]);
    this.replaceChildren(wrap);
    queueMicrotask(() => this.#paint());
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }

  #move(/** @type {number} */ steps) {
    if (this.isDisabled || this.readonly) return;
    const now = super.value === '' ? (this.min ?? 0) - (steps > 0 ? this.#step : 0) : super.value;
    this.#set(now + steps * this.#step);
  }
  #set(/** @type {number} */ n) {
    const before = super.value;
    this.setValue(n);
    if (super.value !== before) { this.userInput(super.value); this.userChange(); }
  }
  #commit() {
    const raw = /** @type {HTMLInputElement} */ (this.#input).value.trim();
    if (raw === '') { if (super.value !== '') { this.setValue(''); this.userInput(''); this.userChange(); } return; }
    const n = Number(raw.replace(',', '.'));
    if (Number.isNaN(n)) this.#paint(); else this.#set(n);
    this.#paint();
  }
  #paint() {
    const i = this.#input;
    if (!i) return;
    const v = super.value;
    i.value = v === '' ? '' : String(v);
    i.setAttribute('aria-label', this.label || this.name || 'Number');
    for (const [a, val] of [['aria-valuemin', this.min], ['aria-valuemax', this.max], ['aria-valuenow', v === '' ? undefined : v]]) { if (val == null) i.removeAttribute(/** @type {string} */ (a)); else i.setAttribute(/** @type {string} */ (a), String(val)); }
    const off = this.isDisabled || this.readonly;
    i.disabled = off;
    this.#buttons[0].disabled = off || (v !== '' && this.min != null && v <= this.min);
    this.#buttons[1].disabled = off || (v !== '' && this.max != null && v >= this.max);
  }
}
define('xo-stepper', XoStepper);
