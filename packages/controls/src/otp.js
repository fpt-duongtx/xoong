// @ts-check
/**
 * <xo-otp> is a one-time code: one box per digit.
 *
 *   <xo-otp name="code" label="Verification code" length="6"></xo-otp>
 *
 * - It draws `.xo-otp[role=group]` with `length` (6 by default) `input[maxlength=1][inputmode=numeric]`. The group is named by `label`; each box is
 *   named "Digit n"; the first box has `autocomplete="one-time-code"` so the browser and the phone offer the SMS code.
 * - Digits only: anything else is dropped. Typing a digit moves to the next box; Backspace clears the box (or the one before when this one is empty)
 *   and moves back; Delete clears the box; ArrowLeft/ArrowRight/Home/End move between boxes. Pasting (or an autofill that puts the whole code in one
 *   box) splits the digits across the boxes.
 * - `value` is the string of digits typed so far ("" when empty). A partly filled code is invalid ("Enter all 6 digits."); `required` rejects an empty one.
 * - `complete` fires (bubbles, detail `{ value }`) when the person fills the last box. `input` fires on every edit; `change` fires when the code
 *   is complete and when the focus leaves the group after an edit.
 */
import { XoControl, define, text } from '@xoong/core';

const digitsOf = (/** @type {any} */ v) => String(v ?? '').replace(/\D/g, '');

class XoOtp extends XoControl {
  static props = { ...XoControl.props, label: String, length: Number };

  /** @type {HTMLElement | null} */ #group = null;
  /** @type {HTMLInputElement[]} */ #boxes = [];
  /** @type {string[]} one entry per box, '' when empty (a gap is possible after Delete) */ #cells = [];
  #own = false;
  #pending = false;
  get #len() { const n = Math.floor(this.length); return n >= 1 ? Math.min(n, 12) : 6; }

  setValue(v) {
    const d = digitsOf(v).slice(0, this.#len);
    super.setValue(d);
    if (!this.#own) this.#cells = Array.from({ length: this.#len }, (_, i) => d[i] ?? '');
    this.#paint();
  }
  reset() { super.reset(); this.setValue(super.value); }
  validate(v) { return v !== '' && String(v).length < this.#len ? text('xoong.otp.incomplete', 'Enter all {n} digits.', { n: this.#len }) : ''; }
  get focusTarget() { return this.#boxes[Math.min(super.value.length, this.#boxes.length - 1)] ?? this.#boxes[0] ?? null; }

  connected() {
    this.#build();
    this.addEventListener('focusout', (e) => { if (this.#pending && !this.contains(/** @type {Node | null} */ (e.relatedTarget))) { this.#pending = false; this.userChange(); } });
    queueMicrotask(() => this.setValue(super.value));
  }

  #build() {
    const group = document.createElement('div');
    group.className = 'xo-otp';
    group.setAttribute('role', 'group');
    this.#boxes = Array.from({ length: this.#len }, (_, i) => {
      const box = document.createElement('input');
      box.type = 'text';
      box.maxLength = 1;
      box.setAttribute('inputmode', 'numeric');
      box.setAttribute('pattern', '[0-9]*');
      box.autocomplete = i === 0 ? 'one-time-code' : 'off';
      box.addEventListener('input', (e) => { e.stopPropagation(); this.#typed(i); });
      box.addEventListener('change', (e) => e.stopPropagation());
      box.addEventListener('keydown', (e) => this.#key(i, e));
      box.addEventListener('paste', (e) => this.#paste(i, e));
      box.addEventListener('focus', () => box.select());
      return box;
    });
    group.append(...this.#boxes);
    this.#group = group;
    this.replaceChildren(group);
    this.#cells = Array.from({ length: this.#len }, (_, i) => super.value[i] ?? '');
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (attr === 'length' && this.#group && this.#boxes.length !== this.#len) { this.#build(); this.setValue(super.value); }
    else this.#paint();
  }

  #focus(/** @type {number} */ i) {
    const box = this.#boxes[Math.max(0, Math.min(i, this.#boxes.length - 1))];
    box?.focus();
    box?.select();
  }

  #typed(/** @type {number} */ i) {
    const d = digitsOf(this.#boxes[i].value);
    if (d.length > 1) { this.#fill(i, d); return; }
    this.#cells[i] = d;
    this.#boxes[i].value = d; // a letter is dropped
    this.#commit();
    if (d && i < this.#boxes.length - 1) this.#focus(i + 1);
  }

  #key(/** @type {number} */ i, /** @type {KeyboardEvent} */ e) {
    const k = e.key;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'Backspace') {
      e.preventDefault();
      if (this.isDisabled || this.readonly) return;
      if (this.#cells[i]) { this.#cells[i] = ''; this.#commit(); this.#focus(i - 1); }
      else if (i > 0) { this.#cells[i - 1] = ''; this.#commit(); this.#focus(i - 1); }
    } else if (k === 'Delete') {
      e.preventDefault();
      if (!this.isDisabled && !this.readonly && this.#cells[i]) { this.#cells[i] = ''; this.#commit(); }
    } else if (k === 'ArrowLeft') { e.preventDefault(); this.#focus(i - 1); }
    else if (k === 'ArrowRight') { e.preventDefault(); this.#focus(i + 1); }
    else if (k === 'Home') { e.preventDefault(); this.#focus(0); }
    else if (k === 'End') { e.preventDefault(); this.#focus(this.#boxes.length - 1); }
    else if (k.length === 1 && !/\d/.test(k)) e.preventDefault(); // letters and symbols do nothing
  }

  #paste(/** @type {number} */ i, /** @type {ClipboardEvent} */ e) {
    e.preventDefault();
    if (this.isDisabled || this.readonly) return;
    const d = digitsOf(e.clipboardData?.getData('text'));
    if (d) this.#fill(d.length >= this.#boxes.length ? 0 : i, d);
  }

  #fill(/** @type {number} */ start, /** @type {string} */ d) {
    let n = 0;
    for (; n < d.length && start + n < this.#boxes.length; n++) this.#cells[start + n] = d[n];
    this.#paint();
    this.#commit();
    this.#focus(start + n);
  }

  #commit() {
    if (this.isDisabled || this.readonly) { this.#paint(); return; }
    const v = this.#cells.join('');
    const before = super.value;
    if (v === before) { this.#paint(); return; } // a letter that was dropped, or the same digit again
    this.#own = true;
    try { this.userInput(v); } finally { this.#own = false; }
    this.#pending = true;
    if (v.length === this.#boxes.length && before !== v) {
      this.#pending = false;
      this.userChange();
      this.emit('complete', { value: v });
    }
  }

  #paint() {
    const g = this.#group;
    if (!g) return;
    g.setAttribute('aria-label', this.label || text('xoong.otp.label', 'Verification code'));
    this.#boxes.forEach((box, i) => {
      box.value = this.#cells[i] ?? '';
      box.setAttribute('aria-label', text('xoong.otp.digit', 'Digit {n}', { n: i + 1 }));
      box.disabled = this.isDisabled;
      box.readOnly = this.readonly;
      if (this.required) box.setAttribute('aria-required', 'true'); else box.removeAttribute('aria-required');
    });
  }
}
define('xo-otp', XoOtp);
