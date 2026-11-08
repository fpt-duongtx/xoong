// @ts-check
/**
 * <xo-range-slider> picks a minimum and a maximum on one track: two native range inputs, the part between them filled.
 *
 *   <xo-range-slider name="price" label="Price" min="0" max="100" step="5" value="20,70" min-label="Minimum price" max-label="Maximum price"></xo-range-slider>
 *
 * - The value is `[min, max]` (numbers); the attribute is `value="20,70"`. The thumbs cannot cross: the one you move stops at the other.
 * - Each input is named (`min-label`, `max-label`, default "Minimum" and "Maximum"); the group is named by `label`. Native keys work on each thumb.
 * - `input` fires while dragging, `change` on release. The fill is placed through the CSS object model (no style attribute).
 */
import { XoControl, define, text } from '@xoong/core';

const pair = (/** @type {any} */ v) => (Array.isArray(v) ? v : typeof v === 'string' && v.includes(',') ? v.split(',') : []).map(Number);

class XoRangeSlider extends XoControl {
  static props = { ...XoControl.props, label: String, min: Number, max: Number, step: Number, minLabel: String, maxLabel: String };

  /** @type {HTMLInputElement[]} */ #inputs = [];
  /** @type {HTMLElement | null} */ #fill = null;

  get #lo() { return this.hasAttribute('min') ? this.min : 0; } // an absent Number prop reads as 0
  get #hi() { return this.hasAttribute('max') ? this.max : 100; }
  setValue(v) {
    let [a, b] = pair(v);
    if (Number.isNaN(a) || a === undefined) { a = this.#lo; b = this.#hi; }
    if (Number.isNaN(b) || b === undefined) b = this.#hi;
    a = Math.min(Math.max(a, this.#lo), this.#hi); b = Math.min(Math.max(b, this.#lo), this.#hi);
    super.setValue(a <= b ? [a, b] : [b, a]);
    this.#paint();
  }
  serialize(v) { return Array.isArray(v) ? v.join(',') : null; }
  isEmpty() { return false; }
  get focusTarget() { return this.#inputs[0] ?? null; }

  connected() {
    const box = document.createElement('div');
    box.className = 'xo-range-dual';
    box.setAttribute('role', 'group');
    const track = document.createElement('div');
    track.className = 'xo-range-dual__track';
    const fill = document.createElement('div');
    fill.className = 'xo-range-dual__fill';
    track.append(fill);
    box.append(track);
    this.#fill = fill;
    this.#inputs = [0, 1].map((i) => {
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'xo-range';
      input.addEventListener('input', (e) => { e.stopPropagation(); this.#move(i); });
      input.addEventListener('change', (e) => { e.stopPropagation(); this.userChange(); });
      box.append(input);
      return input;
    });
    this.replaceChildren(box);
    if (this.hasAttribute('value')) this.setValue(this.getAttribute('value'));
    else if (!Array.isArray(super.value)) this.setValue('');
    this.#paint();
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); if (attr === 'value' && this.#inputs.length) this.setValue(value); else this.#paint(); }

  #move(/** @type {number} */ i) {
    const [a, b] = this.#inputs.map((x) => Number(x.value));
    this.userInput(i === 0 ? [Math.min(a, b), b] : [a, Math.max(a, b)]);
    this.#paint();
  }

  #paint() {
    if (!this.#inputs.length) return;
    const v = super.value;
    const [a, b] = Array.isArray(v) ? v : [this.#lo, this.#hi];
    const span = this.#hi - this.#lo || 1;
    this.#inputs.forEach((x, i) => {
      x.min = String(this.#lo); x.max = String(this.#hi); x.step = String(this.step || 1);
      x.value = String(i ? b : a);
      x.disabled = this.isDisabled || this.readonly;
      x.setAttribute('aria-label', (i ? this.maxLabel : this.minLabel) || (i ? text('xoong.controls.maximum', 'Maximum') : text('xoong.controls.minimum', 'Minimum')));
      x.style.pointerEvents = 'none'; // the thumbs take the pointer (the CSS gives it back to them), the track under them does not
    });
    /** @type {HTMLElement} */ (this.firstElementChild).setAttribute('aria-label', this.label || this.name || text('xoong.controls.range', 'Range'));
    if (this.#fill) { this.#fill.style.left = `${((a - this.#lo) / span) * 100}%`; this.#fill.style.right = `${100 - ((b - this.#lo) / span) * 100}%`; }
  }
}
define('xo-range-slider', XoRangeSlider);
