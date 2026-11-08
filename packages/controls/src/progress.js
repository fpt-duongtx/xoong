// @ts-check
/**
 * <xo-progress> is a bar that shows how much is done; <xo-spinner> shows that something is happening and nobody knows for how long.
 *
 *   <xo-progress value="45" label="Upload"></xo-progress>
 *   <xo-progress value="30" max="50" thin label="Characters used"></xo-progress>
 *   <xo-progress label="Importing"></xo-progress>            <!-- no value: indeterminate -->
 *   <xo-spinner label="Saving" size="md"></xo-spinner>
 *
 * - <xo-progress> draws `.xo-progress[role=progressbar] > i`, with `aria-valuemin="0"`, `aria-valuemax` (`max`, 100 by default) and `aria-valuenow`
 *   (`value`, clamped between 0 and `max`). The bar's width is set through the CSS object model (strict CSP: no style attribute). `label` is its name.
 *   Without a `value` attribute (or with `value` set to null) the bar is indeterminate: no `aria-valuenow`, `data-state="indeterminate"`, and the
 *   bar shows a short fixed fill. `thin` is the 4px bar (`.xo-progress--thin`).
 * - <xo-spinner> draws `.xo-spinner` (`size="md"` or `"lg"` for the larger ones) with `role=status` and the name `label` ("Loading" by default).
 *   `label=""` makes it decorative (`aria-hidden`, no role) for a spinner that sits next to text that already says it. Reduced motion is handled by the CSS.
 */
import { XoElement, define, text, signal } from '@xoong/core';

class XoProgress extends XoElement {
  static props = { max: Number, label: String, thin: Boolean };
  static get observedAttributes() { return [...super.observedAttributes, 'value']; }

  #value = signal(/** @type {number | null} */ (null));
  /** @type {HTMLElement | null} */ #bar = null;
  /** @type {HTMLElement | null} */ #fill = null;

  /** The amount done, or null when it is not known (indeterminate). */
  get value() { return this.#value.value; }
  set value(v) { this.#value.value = v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v); this.#paint(); }

  connected() {
    const bar = document.createElement('div');
    bar.setAttribute('role', 'progressbar');
    const fill = document.createElement('i');
    bar.append(fill);
    this.#bar = bar; this.#fill = fill;
    this.replaceChildren(bar);
    if (this.hasAttribute('value')) this.#value.value = this.#number(this.getAttribute('value'));
    this.#paint();
  }

  #number(/** @type {string | null} */ raw) { return raw == null || raw.trim() === '' || Number.isNaN(Number(raw)) ? null : Number(raw); }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (attr === 'value') this.#value.value = this.#number(value);
    this.#paint();
  }

  #paint() {
    const bar = this.#bar, fill = this.#fill;
    if (!bar || !fill) return;
    const max = this.max > 0 ? this.max : 100;
    const v = this.#value.peek();
    bar.className = this.thin ? 'xo-progress xo-progress--thin' : 'xo-progress';
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(max));
    bar.setAttribute('aria-label', this.label || text('xoong.progress.label', 'Progress'));
    if (v === null) {
      bar.removeAttribute('aria-valuenow');
      this.dataset.state = 'indeterminate';
      fill.style.width = '40%';
    } else {
      const now = Math.min(max, Math.max(0, v));
      bar.setAttribute('aria-valuenow', String(now));
      this.dataset.state = now >= max ? 'complete' : 'progress';
      fill.style.width = `${(now / max) * 100}%`;
    }
  }
}
define('xo-progress', XoProgress);

class XoSpinner extends XoElement {
  static props = { label: String, size: String };

  /** @type {HTMLElement | null} */ #dot = null;

  connected() {
    const dot = document.createElement('span');
    this.#dot = dot;
    this.replaceChildren(dot);
    this.#paint();
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }

  #paint() {
    const dot = this.#dot;
    if (!dot) return;
    dot.className = 'xo-spinner' + (this.size === 'md' || this.size === 'lg' ? ` xo-spinner--${this.size}` : '');
    if (this.hasAttribute('label') && this.label === '') {
      dot.removeAttribute('role'); dot.removeAttribute('aria-label'); dot.setAttribute('aria-hidden', 'true');
    } else {
      dot.removeAttribute('aria-hidden'); dot.setAttribute('role', 'status');
      dot.setAttribute('aria-label', this.label || text('xoong.spinner.label', 'Loading'));
    }
  }
}
define('xo-spinner', XoSpinner);
