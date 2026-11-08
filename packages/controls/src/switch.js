// @ts-check
/**
 * <xo-switch> is one setting on or off (the WAI-ARIA switch pattern), a form control with a boolean value.
 *
 *   <xo-switch name="notify" label="Email me about replies" checked></xo-switch>
 *   <xo-switch name="menu" size="sm" label="Show in menu"></xo-switch>
 *
 * - It draws `button.xo-switch[role=switch][aria-checked]`; Space and Enter toggle it (a native button does this), `disabled` and `readonly` stop it.
 * - `value` is a boolean (`checked` is the same thing as an attribute/property). The form model gets true or false; a plain <form> submits "on" when
 *   it is on and nothing when it is off, like a checkbox.
 * - `change` and `input` fire when the person toggles it. `busy` sets aria-busy and ignores clicks while a save is running.
 * - `label` is the accessible name; a <label for> pointing at the element name also works through aria-labelledby on click-through.
 */
import { XoControl, define } from '@xoong/core';

const truthy = (v) => v === true || v === 'true' || v === 'on' || v === '1' || v === 1;

class XoSwitch extends XoControl {
  static props = { ...XoControl.props, label: String, checked: Boolean, busy: Boolean, size: String };

  /** @type {HTMLButtonElement | null} */ #button = null;

  get value() { return truthy(super.value); }
  set value(v) { super.value = truthy(v); }
  setValue(v) { super.setValue(truthy(v)); this.#paint(); }

  get checked() { return this.value; }
  set checked(v) { this.setValue(!!v); }

  serialize(v) { return truthy(v) ? 'on' : null; }
  isEmpty(v) { return !truthy(v); }
  get focusTarget() { return this.#button; }

  connected() {
    if (this.hasAttribute('checked') && !this.value) this.setValue(true);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'xo-switch';
    button.setAttribute('role', 'switch');
    button.addEventListener('click', () => this.#toggle());
    this.#button = button;
    this.replaceChildren(button);
    if (this.size === 'sm') button.classList.add('xo-switch--sm');
    this.#paint();
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (attr === 'checked') this.setValue(value !== null);
    this.#paint();
  }

  #toggle() {
    if (this.isDisabled || this.readonly || this.busy) return;
    this.userInput(!this.value);
    this.userChange();
    this.#paint();
  }

  #paint() {
    const b = this.#button;
    if (!b) return;
    b.setAttribute('aria-checked', String(this.value));
    b.disabled = this.isDisabled;
    b.classList.toggle('xo-switch--sm', this.size === 'sm');
    if (this.label) b.setAttribute('aria-label', this.label); else b.removeAttribute('aria-label');
    if (this.busy) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
    if (this.readonly) b.setAttribute('aria-readonly', 'true'); else b.removeAttribute('aria-readonly');
  }
}
define('xo-switch', XoSwitch);
