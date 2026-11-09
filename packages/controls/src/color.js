// @ts-check
/**
 * <xo-color> is a color field: a swatch button that opens a panel to pick a color (a brand color, a label, a chart series).
 *
 *   <xo-color name="brand" label="Brand color" value="#0b7285" swatches="#0b7285,#c92a2a,#2b8a3e,#f08c00"></xo-color>
 *   <xo-color name="overlay" label="Overlay" alpha value="#00000080"></xo-color>
 *
 * - The value is `#rrggbb` (lower case), or `#rrggbbaa` with `alpha`; '' means none. A short `#rgb` and upper case are accepted and normalised.
 *   It submits like a text field and works in a `<form>`, with `required`, `disabled` and `readonly`.
 * - It draws `button.xo-color__swatch (span.xo-color__chip + span.xo-color__code)` and a `<xo-popover>` panel `.xo-color__panel` with the browser's `input[type=color]`
 *   (the area and hue; it is the keyboard-operable native picker), a hex field (`.xo-color__hex`, validated: `aria-invalid` and a message while it is not a color),
 *   with `alpha` an opacity slider, and `.xo-color__swatches` for `swatches="#..,#.."`. Each swatch is a button with its hex as its name.
 * - A choice announces itself in a visually hidden status ("Color #0b7285"). `input` fires while the person picks, `change` when they finish.
 */
import { XoControl, define, text } from '@xoong/core';
import './popover.js';

let counter = 0;

const HEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const el = (/** @type {string} */ tag, /** @type {string} */ cls, /** @type {Record<string, string>} */ attrs = {}) => { const e = document.createElement(tag); e.className = cls; for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

class XoColor extends XoControl {
  static props = { ...XoControl.props, label: String, alpha: Boolean, swatches: String };

  /** @type {Record<string, HTMLElement | HTMLInputElement>} */ #p = {};

  /** `#rrggbb` or `#rrggbbaa` from what was typed, or '' when it is not a color. */
  #norm(/** @type {unknown} */ v) {
    const m = HEX.exec(String(v ?? '').trim());
    if (!m) return '';
    let h = m[1].toLowerCase();
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const rgb = h.slice(0, 6), a = h.slice(6) || 'ff';
    return `#${rgb}${this.alpha ? a : ''}`;
  }
  #typing = false; // the hex field is being typed in: do not rewrite its text under the cursor
  #seeded = false;
  setValue(v) { super.setValue(this.#norm(v)); this.#paint(this.#typing); }
  get focusTarget() { return /** @type {HTMLElement | null} */ (this.#p.swatch ?? null); }

  connected() { if (!this.#p.swatch?.isConnected) this.#build(); } // moved in the DOM: it keeps its panel

  #build() { // a copy of a drawn control has no state of its own: it is drawn from scratch (replaceChildren drops the copied panel)
    const label = this.label || text('xoong.color.label', 'Color');
    const swatch = el('button', 'xo-color__swatch', { type: 'button' });
    const chip = el('span', 'xo-color__chip', { 'aria-hidden': 'true' });
    const code = el('span', 'xo-color__code', { 'aria-hidden': 'true' });
    swatch.append(chip, code);
    const panel = document.createElement('xo-popover');
    panel.className = 'xo-color__panel';
    panel.setAttribute('label', label);
    const native = /** @type {HTMLInputElement} */ (el('input', 'xo-color__native', { type: 'color', 'aria-label': text('xoong.color.pick', 'Pick a color') }));
    const hex = /** @type {HTMLInputElement} */ (el('input', 'xo-color__hex', { type: 'text', spellcheck: 'false', autocomplete: 'off', maxlength: '9', 'aria-label': text('xoong.color.hex', 'Hex code') }));
    const err = el('span', 'xo-color__error', { role: 'alert' });
    hex.setAttribute('aria-describedby', (err.id = `xo-color-err-${++counter}`));
    panel.append(native, hex, err);
    const range = /** @type {HTMLInputElement} */ (el('input', 'xo-color__alpha', { type: 'range', min: '0', max: '255', 'aria-label': text('xoong.color.opacity', 'Opacity') }));
    if (this.alpha) panel.append(range);
    const live = el('span', 'xo-color__live xo-visually-hidden', { role: 'status' });
    if (this.swatches) {
      const list = el('div', 'xo-color__swatches', { role: 'group', 'aria-label': text('xoong.color.presets', 'Preset colors') });
      for (const c of this.swatches.split(',').map((s) => this.#norm(s)).filter(Boolean)) {
        const b = el('button', 'xo-color__sw', { type: 'button', 'aria-label': c.slice(0, 7), title: c.slice(0, 7) });
        b.dataset.color = c;
        const dot = el('span', 'xo-color__chip', { 'aria-hidden': 'true' }); // the color is drawn by an inner span: a page's button styles cannot paint over it
        dot.style.setProperty('--xo-color-chip', c);
        b.append(dot);
        b.addEventListener('click', () => this.#set(c, true));
        list.append(b);
      }
      panel.append(list);
    }
    swatch.addEventListener('click', (e) => { if (this.readonly) e.stopImmediatePropagation(); }); // before the popover's own listener: nothing opens
    this.#p = { swatch, chip, code, native, hex, err, range, live, panel };
    this.replaceChildren(swatch, panel, live);
    const alphaOf = () => (this.alpha ? Number(range.value).toString(16).padStart(2, '0') : '');
    native.addEventListener('input', () => this.#set(native.value + alphaOf(), false));
    native.addEventListener('change', () => this.userChange());
    range.addEventListener('input', () => this.#set(native.value + alphaOf(), false));
    range.addEventListener('change', () => this.userChange());
    for (const i of [native, hex, range]) for (const t of ['input', 'change']) i.addEventListener(t, (e) => e.stopPropagation());
    hex.addEventListener('input', (e) => {
      if (/** @type {InputEvent} */ (e).isComposing) return;
      const v = this.#norm(hex.value);
      const bad = hex.value.trim() !== '' && !v;
      hex.setAttribute('aria-invalid', String(bad));
      err.textContent = bad ? text('xoong.color.invalid', 'Use a color such as #1a2b3c.') : '';
      if (v && v !== this.value) { this.#typing = true; this.#set(v, false); this.#typing = false; }
    });
    hex.addEventListener('change', () => { if (!hex.hasAttribute('aria-invalid') || hex.getAttribute('aria-invalid') === 'false') this.userChange(); });
    hex.addEventListener('blur', () => { if (hex.getAttribute('aria-invalid') === 'true') { hex.value = this.value; hex.setAttribute('aria-invalid', 'false'); err.textContent = ''; } });
    if (!this.#seeded && this.hasAttribute('value')) this.setValue(this.getAttribute('value'));
    this.#seeded = true;
    this.#paint();
  }

  #set(/** @type {string} */ v, /** @type {boolean} */ done) {
    if (this.isDisabled || this.readonly) return;
    this.userInput(this.#norm(v));
    if (done) this.userChange();
    this.#p.live.textContent = text('xoong.color.value', 'Color {value}', { value: this.value });
  }

  #paint(keepText = false) {
    const { swatch, chip, code, native, hex, range, panel } = this.#p;
    if (!swatch) return;
    const v = this.value;
    /** @type {HTMLInputElement} */ (native).value = v ? v.slice(0, 7) : '#000000';
    if (!keepText) { /** @type {HTMLInputElement} */ (hex).value = v; hex.setAttribute('aria-invalid', 'false'); }
    /** @type {HTMLInputElement} */ (range).value = v ? String(parseInt(v.slice(7) || 'ff', 16)) : '255';
    chip.style.setProperty('--xo-color-chip', v || 'transparent');
    chip.toggleAttribute('data-empty', !v);
    code.textContent = v || text('xoong.color.none', 'None');
    swatch.setAttribute('aria-label', `${this.label || text('xoong.color.label', 'Color')}: ${v || text('xoong.color.none', 'None')}`);
    for (const b of panel.querySelectorAll('.xo-color__sw')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.color === v));
    for (const i of [swatch, native, hex, range]) /** @type {HTMLButtonElement} */ (i).disabled = this.isDisabled;
    swatch.toggleAttribute('aria-disabled', this.readonly);
    if (this.readonly) panel.removeAttribute('open');
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (!this.#p.swatch) return;
    if (attr === 'alpha' || attr === 'label' || attr === 'swatches') { const v = this.value; this.#build(); this.setValue(v); } else this.#paint();
  }
}
define('xo-color', XoColor);
