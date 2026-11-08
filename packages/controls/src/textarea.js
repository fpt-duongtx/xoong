// @ts-check
/**
 * <xo-textarea> is a textarea with a character counter and a thin progress bar toward `maxlength`.
 *
 *   <xo-textarea name="excerpt" label="Excerpt" maxlength="160" rows="4"></xo-textarea>
 *
 * - The counter ("142 / 160") sits in `.hint` under the field; it is announced politely only when the text gets near the limit (the last 10%) or goes over.
 *   Over the limit the field is invalid with a message (the browser's `maxlength` is not set, so pasted text is kept and shown red, not cut silently).
 * - The value is the string. `input` and `change` fire like a native textarea.
 */
import { XoControl, define, text } from '@xoong/core';

class XoTextarea extends XoControl {
  static props = { ...XoControl.props, label: String, maxlength: Number, rows: Number, placeholder: String };

  /** @type {HTMLTextAreaElement | null} */ #area = null;
  /** @type {HTMLElement | null} */ #count = null;
  /** @type {HTMLElement | null} */ #bar = null;

  setValue(v) { super.setValue(v == null ? '' : String(v)); if (this.#area && this.#area.value !== super.value) this.#area.value = super.value; this.#paint(); }
  get focusTarget() { return this.#area; }
  validate(v) { return this.maxlength && String(v).length > this.maxlength ? text('xoong.controls.tooLong', 'Use at most {max} characters.', { max: this.maxlength }) : ''; }

  connected() {
    const wrap = document.createElement('div');
    wrap.className = 'xo-textarea-meter';
    const area = document.createElement('textarea');
    area.addEventListener('input', (e) => { e.stopPropagation(); this.userInput(area.value); this.#paint(); });
    area.addEventListener('change', (e) => { e.stopPropagation(); this.userChange(); });
    const bar = document.createElement('div');
    bar.className = 'xo-progress xo-progress--thin';
    bar.append(document.createElement('i'));
    const count = document.createElement('span');
    count.className = 'hint';
    wrap.append(area, bar);
    this.#area = area; this.#bar = bar; this.#count = count;
    this.replaceChildren(wrap, count);
    queueMicrotask(() => { area.value = super.value; this.#paint(); });
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }

  #paint() {
    const a = this.#area, c = this.#count, bar = this.#bar;
    if (!a || !c || !bar) return;
    const n = String(super.value).length, max = this.maxlength || 0;
    a.rows = this.rows || 3; a.placeholder = this.placeholder ?? ''; a.disabled = this.isDisabled; a.readOnly = this.readonly;
    a.setAttribute('aria-label', this.label || this.name || text('xoong.controls.text', 'Text'));
    a.setAttribute('aria-invalid', String(!!max && n > max));
    bar.hidden = !max; c.hidden = !max;
    if (!max) return;
    c.textContent = `${n} / ${max}`;
    c.setAttribute('aria-live', n >= max * 0.9 ? 'polite' : 'off');
    c.classList.toggle('error', n > max);
    /** @type {HTMLElement} */ (bar.firstElementChild).style.width = `${Math.min(100, (n / max) * 100)}%`;
  }
}
define('xo-textarea', XoTextarea);
