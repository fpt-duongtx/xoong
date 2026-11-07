// @ts-check
import { signal, batch } from './signals.js';
import { XoElement } from './element.js';

/**
 * Base class for custom form controls (rich text, combobox, tag input, your own image field).
 *
 * A control built on it behaves like a native input in a <form>:
 *   - it submits its value (`name`, `value`) through ElementInternals, so FormData and `xo-submit` see it;
 *   - it takes part in constraint validation (`required`, `setCustomValidity`, `validity`, `checkValidity`,
 *     `reportValidity`, the form's own submit validation);
 *   - it resets with the form, and is disabled with its fieldset;
 *   - it tracks `dirty`, `touched` and `pristine` as signals, so markup and JS can read them the same way for every control.
 *
 * Subclass it, render the inner editing UI (Light DOM), and call `userInput(value)` when the person changes the value:
 *
 *   class StarRating extends XoControl {
 *     static props = { ...XoControl.props, max: Number };
 *     render() { return html`<button @click=${() => this.userInput(Number(this.value) + 1)}>+</button>`; }
 *     validate(value) { return Number(value) > this.max ? 'Too many stars' : ''; }   // optional: '' means valid
 *   }
 *   define('star-rating', StarRating);
 *
 * Where ElementInternals does not exist (older DOMs, happy-dom) the control keeps working on its own: `value`, validity and
 * state still behave; it just does not appear in a native FormData. `xo-form` reads controls through these properties.
 */
export class XoControl extends XoElement {
  static formAssociated = true;
  static props = { name: String, required: Boolean, disabled: Boolean, readonly: Boolean };

  /** @type {ElementInternals | null} */ #internals = null;
  #value = signal(/** @type {any} */ (''));
  #initial = signal(/** @type {any} */ (''));
  #touched = signal(false);
  #custom = signal('');
  #hook = signal('');
  #started = false;
  #formDisabled = false; // disabled by a <fieldset disabled>, tracked apart from the `disabled` attribute

  constructor() {
    super();
    try { this.#internals = this.attachInternals?.() ?? null; } catch { this.#internals = null; }
    this.addEventListener('focusout', (e) => { if (!this.contains(/** @type {Node | null} */ (e.relatedTarget))) this.markTouched(); });
  }

  // ---- value ----------------------------------------------------------------------------------------------------------

  /** The value. Strings by default; a subclass may hold anything and override `serialize`. */
  get value() { return this.#value.value; }
  set value(v) { this.setValue(v); }

  /**
   * Set the value programmatically (like `input.value = x`: no events). The first value set while the control is not yet
   * started (an attribute or property before connection) becomes the initial value that `reset` and `dirty` compare with.
   */
  setValue(v) {
    batch(() => {
      this.#value.value = v;
      if (!this.#started) this.#initial.value = v;
    });
    this.#sync();
  }

  /** The person changed the value: set it and fire `input`, like a native control. */
  userInput(v) {
    this.setValue(v);
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  /** The person finished a change (blur after editing, a selection): fire `change`. */
  userChange() {
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  /** What the form submits for a value: a string, a File, FormData, or null for nothing. Override for structured values. */
  serialize(v) {
    if (v == null || v === '') return v === '' ? '' : null;
    if (typeof FormData !== 'undefined' && v instanceof FormData) return v;
    return typeof v === 'object' && !(typeof File !== 'undefined' && v instanceof File) ? JSON.stringify(v) : String(v);
  }

  /** Whether a value counts as "nothing entered" for `required`. Override for structured values. */
  isEmpty(v) { return v == null || v === '' || (Array.isArray(v) && v.length === 0); }

  /** Optional validation hook: return an error message for an invalid value, '' when valid. Runs on every change. */
  validate(_value) { return ''; }

  // ---- state (signals: reading them inside a template or effect is tracked) -----------------------------------------------

  get initialValue() { return this.#initial.value; }
  get dirty() { return !same(this.#value.value, this.#initial.value); }
  get pristine() { return !this.dirty; }
  get touched() { return this.#touched.value; }
  /** True when the control has no validation error. */
  get valid() { return this.validationMessage === ''; }
  get invalid() { return !this.valid; }

  /** Mark the control as visited (blur does this). */
  markTouched() {
    if (this.#touched.peek()) return;
    this.#touched.value = true;
    this.#reflect();
  }

  // ---- validation -------------------------------------------------------------------------------------------------------

  /** The message to show, or '' when valid. Reading it is tracked. */
  get validationMessage() {
    this.#value.value; // track
    this.#hook.value;
    if (this.#custom.value) return this.#custom.value;
    if (this.required && this.isEmpty(this.#value.value)) return 'Please fill in this field.';
    return this.#hook.value;
  }
  /** Disabled by its own attribute or by a disabled fieldset. */
  get isDisabled() { return this.disabled || this.#formDisabled; }
  get willValidate() { return !this.isDisabled && !this.readonly; }
  get validity() {
    const message = this.validationMessage;
    const missing = this.required && this.isEmpty(this.#value.peek()) && !this.#custom.peek();
    return { valid: !message, valueMissing: missing, customError: !!(this.#custom.peek() || (this.#hook.peek() && !missing)), badInput: false, typeMismatch: false, patternMismatch: false, rangeOverflow: false, rangeUnderflow: false, stepMismatch: false, tooLong: false, tooShort: false };
  }
  /** Set your own error (cross-field rules, server errors). An empty string clears it. */
  setCustomValidity(message) {
    this.#custom.value = String(message ?? '');
    this.#sync();
  }
  checkValidity() {
    if (!this.willValidate || this.valid) return true;
    this.dispatchEvent(new Event('invalid', { cancelable: true }));
    return false;
  }
  reportValidity() {
    const ok = this.checkValidity();
    if (!ok) { this.markTouched(); this.focusTarget?.focus?.(); }
    return ok;
  }

  /** The element inside that takes focus (and anchors the browser's validation bubble). Defaults to the first focusable child. */
  get focusTarget() {
    return /** @type {HTMLElement | null} */ (this.querySelector('input:not([type=hidden]),select,textarea,button,[contenteditable="true"],[tabindex]:not([tabindex="-1"])')) ?? (this.hasAttribute('tabindex') ? this : null);
  }

  // ---- reset to initial -------------------------------------------------------------------------------------------------

  /** Back to the initial value, untouched. The form calls this on reset. */
  reset() {
    batch(() => { this.#value.value = this.#initial.peek(); this.#touched.value = false; this.#custom.value = ''; });
    this.#sync();
  }
  /** Make the current value the new baseline, as after a successful save: `dirty` becomes false. */
  markPristine() {
    this.#initial.value = this.#value.peek();
    this.#reflect();
  }

  // ---- form-associated custom element callbacks ---------------------------------------------------------------------------

  formResetCallback() { this.reset(); }
  /** A fieldset disabled or enabled us. Not reflected into `disabled`: the browser would then keep us disabled for good. */
  formDisabledCallback(disabled) {
    this.#formDisabled = !!disabled;
    this.toggleAttribute('data-form-disabled', !!disabled);
    this.#sync();
  }
  formStateRestoreCallback(state) { if (state != null) this.setValue(state); }
  get form() { return this.#internals?.form ?? this.closest('form'); }

  // ---- lifecycle ----------------------------------------------------------------------------------------------------------

  connectedCallback() {
    super.connectedCallback();
    if (!this.#started) {
      this.#started = true;
      if (this.hasAttribute('value') && this.#value.peek() === '') { this.#value.value = this.getAttribute('value'); this.#initial.value = this.#value.peek(); }
    }
    this.#sync();
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (attr === 'value' && !this.#started) this.setValue(value);
    if (attr === 'required' || attr === 'disabled' || attr === 'readonly') this.#sync();
  }

  // ---- internals ----------------------------------------------------------------------------------------------------------

  /** Push value and validity to the browser and reflect the state as attributes. */
  #sync() {
    this.#hook.value = this.validate(this.#value.peek()) || '';
    const internals = this.#internals;
    if (internals) {
      try {
        internals.setFormValue(this.isDisabled ? null : this.serialize(this.#value.peek()));
        const message = this.validationMessage;
        if (message) internals.setValidity({ valueMissing: this.validity.valueMissing, customError: this.validity.customError }, message, this.focusTarget ?? undefined);
        else internals.setValidity({});
      } catch { /* a DOM with a partial ElementInternals: keep our own state */ }
    }
    this.#reflect();
  }

  #reflect() {
    this.toggleAttribute('data-dirty', this.dirty);
    this.toggleAttribute('data-touched', this.#touched.peek());
    this.toggleAttribute('data-invalid', !this.valid && this.willValidate);
  }
}

/** Equality for control values: primitives by value, structured values by their JSON form. */
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } }
  return false;
}

