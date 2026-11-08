// @ts-check
/**
 * <xo-popover> is a small panel that opens from a button (notifications, a menu of settings, a mini form).
 *
 *   <div class="xo-notify">
 *     <button aria-label="Notifications">...</button>
 *     <xo-popover label="Notifications">...</xo-popover>
 *   </div>
 *
 * - The trigger is the element named by `anchor` (a selector), or the element just before the popover. It gets `aria-expanded` and `aria-controls`.
 * - A click on the trigger toggles it. Escape closes it and gives the focus back to the trigger; a click outside, or Tab out of the panel, closes it.
 * - `open()`, `close()` and `toggle()`; the property/attribute `open`; `xo-popover-open` and `xo-popover-close` fire on the element.
 * - The panel has the class `xo-popover` (the theme draws it) and `role="region"` named by `label`. With the Popover API it is drawn in the top layer under the
 *   trigger and kept inside the viewport (flips up when there is more room above, scrolls when neither side has enough).
 */
import { XoElement, define } from '@xoong/core';
import { prepareLayer, showLayer, hideLayer } from './layer.js';

let counter = 0;

class XoPopover extends XoElement {
  static props = { anchor: String, label: String, open: Boolean };

  #id = `xo-popover-${++counter}`;
  /** @type {HTMLElement | null} */ #trigger = null;
  #onClick = () => this.toggle();
  #onDocument = (/** @type {Event} */ e) => { const t = /** @type {Node} */ (e.target); if (!this.contains(t) && !this.#trigger?.contains(t)) this.close(); };

  connected() {
    this.classList.add('xo-popover');
    prepareLayer(this);
    this.setAttribute('role', 'region');
    if (!this.id) this.id = this.#id;
    this.#trigger = this.anchor ? document.querySelector(this.anchor) : /** @type {HTMLElement | null} */ (this.previousElementSibling);
    const t = this.#trigger;
    if (t) { t.setAttribute('aria-controls', this.id); t.setAttribute('aria-haspopup', 'true'); t.addEventListener('click', this.#onClick); }
    this.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(true); } });
    this.addEventListener('focusout', (e) => { if (this.open && e.relatedTarget && !this.contains(/** @type {Node} */ (e.relatedTarget)) && e.relatedTarget !== this.#trigger) this.close(); });
    this.#paint();
  }
  disconnected() { this.#trigger?.removeEventListener('click', this.#onClick); document.removeEventListener('pointerdown', this.#onDocument); this.#stop(); }
  #stop = () => {};
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }

  /** Open it; the focus moves to the first focusable element of the panel. */
  show() { this.setAttribute('open', ''); }
  toggle() { this.open ? this.close() : this.show(); }
  /** @param {boolean} [refocus] give the focus back to the trigger */
  close(refocus = false) { if (!this.open) return; this.removeAttribute('open'); if (refocus) this.#trigger?.focus(); }

  #paint() {
    if (!this.isConnected) return;
    if (this.label) this.setAttribute('aria-label', this.label); else this.removeAttribute('aria-label');
    this.#trigger?.setAttribute('aria-expanded', String(this.open));
    if (this.open === this.#wasOpen) return;
    if (this.open) {
      this.#stop();
      this.#stop = showLayer(this, this.#trigger ?? this);
      document.addEventListener('pointerdown', this.#onDocument);
      this.dispatchEvent(new Event('xo-popover-open', { bubbles: true }));
      /** @type {HTMLElement | null} */ (this.querySelector('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))?.focus();
    } else {
      this.#stop();
      hideLayer(this);
      document.removeEventListener('pointerdown', this.#onDocument);
      this.dispatchEvent(new Event('xo-popover-close', { bubbles: true }));
    }
    this.#wasOpen = this.open;
  }
  #wasOpen = false;
}
define('xo-popover', XoPopover);
