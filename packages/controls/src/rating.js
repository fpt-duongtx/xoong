// @ts-check
/**
 * <xo-rating> is a star rating: a review score, a priority, a difficulty.
 *
 *   <xo-rating name="score" label="Your rating" value="4"></xo-rating>
 *   <xo-rating name="quality" label="Quality" max="10" half clearable></xo-rating>
 *   <xo-rating label="Average" value="3.5" half readonly></xo-rating>
 *
 * - A radio group: `div.xo-rating[role=radiogroup] > span.xo-rating__star > input[type=radio]` (one native radio per star, two with `half`, drawn over the star and
 *   named "3 of 5"), so the arrow keys, Tab, a screen reader and `:focus-visible` are the browser's. The star shows `data-state="full|half|empty"`; the glyph is CSS.
 * - `value` is a number from 0 (nothing) to `max` (default 5), in steps of 1, or 0.5 with `half`. It submits as a number and nothing when 0. `required` means at least a star.
 * - Moving the pointer over the stars previews the value. `readonly` shows it without a way to change it; `disabled` greys it. `clearable` lets a click on the chosen star,
 *   or Delete / Backspace, set it back to nothing. `label` names the group. `input` and `change` fire on the element.
 */
import { XoControl, define, text } from '@xoong/core';

let counter = 0;

class XoRating extends XoControl {
  static props = { ...XoControl.props, label: String, max: Number, half: Boolean, clearable: Boolean };

  /** @type {HTMLElement | null} */ #group = null;

  get #max() { return Math.min(Math.max(Math.floor(this.max) || 5, 1), 20); }
  get value() { return Number(super.value) || 0; }
  set value(v) { this.setValue(v); }
  setValue(v) {
    const step = this.half ? 2 : 1;
    super.setValue(Math.min(this.#max, Math.max(0, Math.round((Number(v) || 0) * step) / step)));
    this.#paint();
  }
  serialize(v) { return v > 0 ? String(v) : null; }
  isEmpty(v) { return !v; }
  get focusTarget() { return /** @type {HTMLElement | null} */ (this.querySelector('input:checked') ?? this.querySelector('input')); }

  constructor() {
    super();
    for (const t of ['input', 'change']) this.addEventListener(t, (e) => { if (e.target !== this) e.stopImmediatePropagation(); }); // the radios' own events stay inside
  }

  connected() { if (!this.#group?.isConnected) this.#build(); } // moved in the DOM: it keeps its stars

  #build() { // a copy of a drawn control has no state of its own: it is drawn from scratch
    const group = document.createElement('div');
    group.className = 'xo-rating';
    group.setAttribute('role', 'radiogroup');
    const name = `xo-rating-${++counter}`, max = this.#max, step = this.half ? 0.5 : 1;
    const radio = (/** @type {number} */ n, /** @type {string} */ cls) => {
      const r = document.createElement('input');
      r.type = 'radio';
      r.name = name;
      r.setAttribute('form', ''); // not a field of the surrounding form: this control submits its own value
      r.value = String(n);
      r.className = cls;
      r.setAttribute('aria-label', text('xoong.rating.of', '{n} of {max}', { n, max }));
      r.addEventListener('change', () => { if (this.#locked()) { this.#paint(); return; } this.userInput(n); this.userChange(); });
      r.addEventListener('click', (e) => {
        if (this.#locked()) { e.preventDefault(); return; } // a read-only rating keeps its value
        if (this.clearable && this.#wasChecked === r) { this.userInput(0); this.userChange(); } // a click on the chosen star
        this.#wasChecked = null;
      });
      r.addEventListener('pointerdown', () => { this.#wasChecked = r.checked ? r : null; });
      r.addEventListener('keydown', (e) => { if (this.clearable && !this.#locked() && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); this.userInput(0); this.userChange(); } });
      return r;
    };
    for (let i = 1; i <= max; i++) {
      const star = document.createElement('span');
      star.className = 'xo-rating__star';
      star.append(...(this.half ? [radio(i - step, 'xo-rating__input xo-rating__input--half')] : []), radio(i, 'xo-rating__input'));
      group.append(star);
    }
    group.addEventListener('pointerover', (e) => { const r = /** @type {Element} */ (e.target); if (r instanceof HTMLInputElement && !this.#locked()) this.#paint(Number(r.value)); });
    group.addEventListener('pointerleave', () => this.#paint());
    this.replaceChildren(group);
    this.#group = group;
    if (!this.#seeded && this.hasAttribute('value')) this.setValue(this.getAttribute('value'));
    this.#seeded = true;
    this.#paint();
  }
  #seeded = false;

  /** @type {HTMLInputElement | null} */ #wasChecked = null;
  #locked() { return this.readonly || this.isDisabled; }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (!this.#group) return;
    if (attr === 'max' || attr === 'half') { this.#build(); this.setValue(this.value); } else this.#paint();
  }

  #paint(preview = /** @type {number | null} */ (null)) {
    const g = this.#group;
    if (!g) return;
    const v = preview ?? this.value;
    g.setAttribute('aria-label', this.label || text('xoong.rating.label', 'Rating'));
    if (this.readonly) g.setAttribute('aria-readonly', 'true'); else g.removeAttribute('aria-readonly');
    g.toggleAttribute('data-preview', preview !== null);
    [...g.children].forEach((star, i) => { /** @type {HTMLElement} */ (star).dataset.state = v >= i + 1 ? 'full' : this.half && v >= i + 0.5 ? 'half' : 'empty'; });
    for (const r of g.querySelectorAll('input')) { r.checked = Number(r.value) === this.value; r.disabled = this.isDisabled; }
  }
}
define('xo-rating', XoRating);
