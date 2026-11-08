// @ts-check
/**
 * <xo-slider> is a number on a track (a native range input, styled by the theme); `value` is a number.
 *
 *   <xo-slider name="quality" label="Image quality" min="0" max="100" step="5" value="80"></xo-slider>
 *
 * - The native keys work (arrows, Page, Home/End). `input` fires while dragging, `change` when released.
 * - `labels` names the stops for screen readers and for the visible value: `labels="Low,Medium,High"` with min=0 max=2 step=1 says "Medium".
 * - The filled part of the track follows the value (the custom property `--p`, set through the CSS object model).
 */
import { XoControl, define } from '@xoong/core';

class XoSlider extends XoControl {
  static props = { ...XoControl.props, label: String, min: Number, max: Number, step: Number, labels: String };

  /** @type {HTMLInputElement | null} */ #input = null;

  setValue(v) { const n = Number(v); super.setValue(v === '' || v == null || Number.isNaN(n) ? '' : n); this.#paint(); }
  get focusTarget() { return this.#input; }

  connected() {
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'xo-range';
    input.addEventListener('input', (e) => { e.stopPropagation(); this.userInput(Number(input.value)); this.#paint(); });
    input.addEventListener('change', (e) => { e.stopPropagation(); this.userChange(); });
    this.#input = input;
    this.replaceChildren(input);
    if (this.hasAttribute('value')) this.setValue(this.getAttribute('value')); // the base class would keep the attribute text: a number control holds a number
    queueMicrotask(() => this.#paint());
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }

  #paint() {
    const i = this.#input;
    if (!i) return;
    const min = this.hasAttribute('min') ? this.min : 0, max = this.hasAttribute('max') ? this.max : 100; // an absent Number prop reads as 0
    i.min = String(min); i.max = String(max); i.step = String(this.step || 1);
    i.disabled = this.isDisabled || this.readonly;
    i.setAttribute('aria-label', this.label || this.name || 'Value');
    const v = super.value === '' ? min : super.value;
    i.value = String(v);
    i.style.setProperty('--p', `${max > min ? ((v - min) / (max - min)) * 100 : 0}%`);
    const stop = this.labels ? this.labels.split(',')[Math.round((v - min) / (this.step || 1))]?.trim() : '';
    if (stop) i.setAttribute('aria-valuetext', stop); else i.removeAttribute('aria-valuetext');
  }
}
define('xo-slider', XoSlider);
