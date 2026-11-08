// Types for XoControl, the base class of form-associated custom elements.
import { XoElement } from './element.js';

/** The validity state of a control: the same names as the native `ValidityState`, as a plain object. */
export interface XoValidity {
  readonly valid: boolean;
  readonly valueMissing: boolean;
  readonly customError: boolean;
  readonly badInput: boolean;
  readonly typeMismatch: boolean;
  readonly patternMismatch: boolean;
  readonly rangeOverflow: boolean;
  readonly rangeUnderflow: boolean;
  readonly stepMismatch: boolean;
  readonly tooLong: boolean;
  readonly tooShort: boolean;
}

/**
 * Base class for custom form controls. It behaves like a native input in a `<form>`: it submits `name` and `value` through ElementInternals,
 * takes part in constraint validation, resets with the form, is disabled with its fieldset, and tracks `dirty`, `touched` and `pristine`.
 * Subclass it, render the inner UI, and call `userInput(value)` when the person changes the value.
 *
 *     class StarRating extends XoControl {
 *       static props = { ...XoControl.props, max: Number };
 *       declare max: number;
 *       render() { return html`<button @click=${() => this.userInput(Number(this.value) + 1)}>+</button>`; }
 *       validate(value: unknown) { return Number(value) > this.max ? 'Too many stars' : ''; }
 *     }
 *     define('star-rating', StarRating);
 */
export class XoControl extends XoElement {
  static formAssociated: boolean;
  static props: { name: StringConstructor; required: BooleanConstructor; disabled: BooleanConstructor; readonly: BooleanConstructor };

  constructor();

  /** The form field name. */
  name: string;
  required: boolean;
  disabled: boolean;
  readonly: boolean;

  // ---- value
  /** The value. A string by default; a subclass may hold anything and override `serialize`. Reading it is tracked. */
  get value(): any;
  set value(v: any);
  /** Set the value programmatically (like `input.value = x`: no events). Before the control has started, it also becomes the initial value. */
  setValue(v: any): void;
  /** The person changed the value: sets it and fires `input`. */
  userInput(v: any): void;
  /** The person finished a change: fires `change`. */
  userChange(): void;
  /** What the form submits for a value: a string, a File, FormData, or null for nothing. Override for structured values. */
  serialize(v: any): string | File | FormData | null;
  /** Whether a value counts as "nothing entered" for `required`. Override for structured values. */
  isEmpty(v: any): boolean;
  /** Validation hook: return an error message for an invalid value, a falsy value when it is valid. Runs on every change. */
  validate(value: any): string | null | undefined | false;

  // ---- state (reading these inside a template or an effect is tracked)
  /** The value the control started with (what `reset` goes back to and `dirty` compares with). */
  get initialValue(): any;
  get dirty(): boolean;
  get pristine(): boolean;
  get touched(): boolean;
  /** True when there is no validation error. */
  get valid(): boolean;
  get invalid(): boolean;
  /** Mark the control as visited (blur does this). */
  markTouched(): void;

  // ---- validation
  /** The message to show, or '' when valid. */
  get validationMessage(): string;
  /** Disabled by its own attribute or by a disabled fieldset. */
  get isDisabled(): boolean;
  get willValidate(): boolean;
  get validity(): XoValidity;
  /** Set your own error (cross-field rules, server errors). An empty string clears it. */
  setCustomValidity(message: string | null | undefined): void;
  /** True when valid (or not validated); otherwise fires a cancelable `invalid` event and returns false. */
  checkValidity(): boolean;
  /** Like `checkValidity`, and on failure marks the control touched and focuses `focusTarget`. */
  reportValidity(): boolean;
  /** The element inside that takes focus (and anchors the validation bubble). */
  get focusTarget(): HTMLElement | null;

  // ---- reset
  /** Back to the initial value, untouched. The form calls this on reset. */
  reset(): void;
  /** Make the current value the new baseline, as after a successful save: `dirty` becomes false. */
  markPristine(): void;

  // ---- form-associated callbacks
  formResetCallback(): void;
  formDisabledCallback(disabled: boolean): void;
  formStateRestoreCallback(state: any): void;
  /** The form this control belongs to (through ElementInternals, else the closest `<form>`). */
  get form(): HTMLFormElement | null;
}
