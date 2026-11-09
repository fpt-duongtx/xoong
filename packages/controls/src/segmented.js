// @ts-check
/**
 * <xo-segmented> is a group of buttons where one is chosen (a view switch, a filter, a billing period).
 *
 *   <xo-segmented name="period" label="Billing" value="month">
 *     <button value="month">Monthly</button><button value="year">Yearly <span class="xo-count">-20%</span></button>
 *   </xo-segmented>
 *
 * - The children are the segments (their `value`, text and icons are kept). The value is the chosen segment's `value`; with `multiple` it is an array
 *   and each segment toggles on its own. Draws `.xo-seg[role=group]` with `aria-pressed` on every button.
 * - Arrow keys move the focus between segments (Home/End too, wrapping off); Space or Enter chooses. `change` fires when the choice changes.
 * - `clearable` lets a click on the chosen segment unchoose it (value '').
 */
import { XoControl, define } from '@xoong/core';

class XoSegmented extends XoControl {
  static props = { ...XoControl.props, label: String, multiple: Boolean, clearable: Boolean };

  /** @type {HTMLButtonElement[]} */ #buttons = [];

  setValue(v) { super.setValue(this.multiple ? (Array.isArray(v) ? v.map(String) : v ? String(v).split(',') : []) : Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v)); this.#paint(); }
  serialize(v) { return Array.isArray(v) ? (v.length ? v.join(',') : null) : super.serialize(v); }
  get focusTarget() { return this.#buttons.find((b) => b.tabIndex === 0) ?? this.#buttons[0] ?? null; }

  connected() { void this.ready().then(() => this.#build()); } // the segments are the children

  #build() {
    if (this.#buttons.length) return;
    const group = document.createElement('div');
    group.className = 'xo-seg';
    group.setAttribute('role', 'group');
    if (this.label) group.setAttribute('aria-label', this.label);
    this.#buttons = [...this.children].filter((c) => c instanceof HTMLButtonElement).map((b) => {
      const btn = /** @type {HTMLButtonElement} */ (b);
      btn.type = 'button';
      btn.addEventListener('click', () => this.#pick(btn.value));
      btn.addEventListener('keydown', (e) => this.#key(e, btn));
      group.append(btn);
      return btn;
    });
    this.replaceChildren(group);
    if (!this.multiple && super.value === '' && this.hasAttribute('value')) this.setValue(this.getAttribute('value'));
    else if (this.multiple && this.hasAttribute('value') && !(super.value ?? []).length) this.setValue(this.getAttribute('value'));
    this.#paint();
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); if (attr === 'value' && this.#buttons.length) this.setValue(value); }

  #pick(/** @type {string} */ v) {
    if (this.isDisabled || this.readonly) return;
    const now = super.value;
    const next = this.multiple ? (now.includes(v) ? now.filter((x) => x !== v) : [...now, v]) : now === v ? (this.clearable ? '' : v) : v;
    if (JSON.stringify(next) === JSON.stringify(now)) return;
    this.userInput(next);
    this.userChange();
    this.#paint();
  }
  #key(/** @type {KeyboardEvent} */ e, /** @type {HTMLButtonElement} */ btn) {
    const i = this.#buttons.indexOf(btn), n = this.#buttons.length;
    const side = getComputedStyle(this).direction === 'rtl' ? -1 : 1; // the arrows follow the screen
    const to = { ArrowRight: i + side, ArrowDown: i + 1, ArrowLeft: i - side, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = this.#buttons[Math.min(n - 1, Math.max(0, to))];
    next.focus();
    this.#buttons.forEach((b) => { b.tabIndex = b === next ? 0 : -1; });
  }
  #paint() {
    const v = super.value;
    const on = (/** @type {string} */ x) => (Array.isArray(v) ? v.includes(x) : v === x);
    const current = this.#buttons.find((b) => on(b.value)) ?? this.#buttons[0];
    for (const b of this.#buttons) { b.setAttribute('aria-pressed', String(on(b.value))); b.disabled = this.isDisabled; b.tabIndex = b === current ? 0 : -1; }
  }
}
define('xo-segmented', XoSegmented);
