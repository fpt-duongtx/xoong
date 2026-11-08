// @ts-check
/**
 * <xo-password> is a password field with a button that shows or hides the text.
 *
 *   <xo-password name="password" label="Password" autocomplete="new-password"></xo-password>
 *
 * - The eye button is `aria-pressed` while the text is shown and named "Show password" / "Hide password"; nothing else is announced.
 * - `value` is the string; `autocomplete` goes to the input so password managers work.
 */
import { XoControl, define, text } from '@xoong/core';

class XoPassword extends XoControl {
  static props = { ...XoControl.props, label: String, placeholder: String, autocomplete: String };

  /** @type {HTMLInputElement | null} */ #input = null;
  /** @type {HTMLButtonElement | null} */ #eye = null;

  setValue(v) { super.setValue(v == null ? '' : String(v)); if (this.#input && this.#input.value !== super.value) this.#input.value = super.value; }
  get focusTarget() { return this.#input; }

  connected() {
    const wrap = document.createElement('div');
    wrap.className = 'xo-input-wrap xo-input-wrap--end';
    const input = document.createElement('input');
    input.type = 'password';
    input.addEventListener('input', (e) => { e.stopPropagation(); this.userInput(input.value); });
    input.addEventListener('change', (e) => { e.stopPropagation(); this.userChange(); });
    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'ghost icon-only sm xo-input-end';
    eye.innerHTML = '<span class="ic" data-ic="eye" aria-hidden="true"></span>';
    eye.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; this.#paint(); });
    wrap.append(input, eye);
    this.#input = input; this.#eye = eye;
    this.replaceChildren(wrap);
    queueMicrotask(() => { input.value = super.value; this.#paint(); });
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }

  #paint() {
    const i = this.#input, e = this.#eye;
    if (!i || !e) return;
    const shown = i.type === 'text';
    e.setAttribute('aria-pressed', String(shown));
    e.setAttribute('aria-label', shown ? text('xoong.controls.hidePassword', 'Hide password') : text('xoong.controls.showPassword', 'Show password'));
    i.setAttribute('aria-label', this.label || this.name || text('xoong.controls.password', 'Password'));
    i.placeholder = this.placeholder || '';
    if (this.autocomplete) i.autocomplete = /** @type {any} */ (this.autocomplete);
    i.disabled = e.disabled = this.isDisabled;
    i.readOnly = this.readonly;
  }
}
define('xo-password', XoPassword);
