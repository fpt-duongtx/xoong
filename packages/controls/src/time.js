// @ts-check
/**
 * <xo-time> is a time of day as two selects, hour and minute.
 *
 *   <xo-time name="at" label="Time" step="15" value="09:30"></xo-time>
 *
 * - The value is `HH:mm` (24 hours) or '' when empty. `step` is the minutes between choices (default 5, 1 to 30); a value off the step is kept as a choice.
 * - Choosing an hour on an empty field sets the minutes to 00. Both selects are native (keyboard and screen readers as they are), named Hour and Minute.
 * - `change` and `input` fire when the person chooses; `min` and `max` (`HH:mm`) make a value outside invalid.
 */
import { XoControl, define, text } from '@xoong/core';

const pad = (n) => String(n).padStart(2, '0');
const parse = (v) => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v ?? ''); return m ? [m[1], m[2]] : null; };

class XoTime extends XoControl {
  static props = { ...XoControl.props, label: String, step: Number, min: String, max: String };

  /** @type {HTMLSelectElement | null} */ #h = null;
  /** @type {HTMLSelectElement | null} */ #m = null;

  setValue(v) { super.setValue(parse(v) ? v : ''); this.#paint(); }
  isEmpty(v) { return !v; }
  get focusTarget() { return this.#h; }
  validate(v) { return v && ((this.min && v < this.min) || (this.max && v > this.max)) ? text('xoong.controls.timeRange', 'Choose a time within the allowed range.') : ''; }

  connected() {
    const group = document.createElement('div');
    group.className = 'row-inline xo-time';
    group.setAttribute('role', 'group');
    if (this.label) group.setAttribute('aria-label', this.label);
    // the native `change` stops here: the control fires its own, once
    const make = (name) => { const s = document.createElement('select'); s.setAttribute('aria-label', name); s.addEventListener('change', (e) => { e.stopPropagation(); this.#choose(); }); return s; };
    this.#h = make(text('xoong.controls.hour', 'Hour'));
    this.#m = make(text('xoong.controls.minute', 'Minute'));
    const colon = document.createElement('span');
    colon.textContent = ':'; colon.setAttribute('aria-hidden', 'true');
    group.append(this.#h, colon, this.#m);
    this.replaceChildren(group);
    queueMicrotask(() => this.#paint()); // the base class applies a `value` attribute after connected()
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }

  #paint() {
    const h = this.#h, m = this.#m;
    if (!h || !m) return;
    const [vh, vm] = parse(super.value) ?? ['', ''];
    const step = Math.min(30, Math.max(1, this.step || 5));
    const fill = (/** @type {HTMLSelectElement} */ s, /** @type {string[]} */ list, /** @type {string} */ now) => {
      const all = list.includes(now) || !now ? list : [...list, now].sort();
      s.replaceChildren(...['', ...all].map((t) => { const o = document.createElement('option'); o.value = t; o.textContent = t || '--'; return o; }));
      s.value = now;
    };
    fill(h, Array.from({ length: 24 }, (_, i) => pad(i)), vh);
    fill(m, Array.from({ length: Math.ceil(60 / step) }, (_, i) => pad(i * step)), vm);
    h.disabled = m.disabled = this.isDisabled || this.readonly;
  }

  #choose() {
    const h = /** @type {HTMLSelectElement} */ (this.#h).value;
    let m = /** @type {HTMLSelectElement} */ (this.#m).value;
    if (h && !m) m = '00';
    this.setValue(h ? `${h}:${m}` : '');
    this.userInput(super.value);
    this.userChange();
  }
}
define('xo-time', XoTime);
