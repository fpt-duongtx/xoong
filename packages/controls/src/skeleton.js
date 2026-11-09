// @ts-check
/**
 * <xo-skeleton> is a grey placeholder with the shape of what is loading: lines of text, an avatar, a picture.
 *
 *   <xo-skeleton lines="3"></xo-skeleton>
 *   <xo-skeleton shape="circle" width="48"></xo-skeleton>
 *   <xo-skeleton shape="rect" width="100%" height="8rem" label="Loading the chart"></xo-skeleton>
 *
 * - `shape` is `text` (default: `lines` bars, the last one shorter), `circle` (width = height) or `rect`. `width` and `height` are CSS lengths; a bare number is pixels.
 * - It adds the class `xo-skeleton` and draws `span.xo-skeleton__shapes[aria-hidden] > i.xo-skeleton__shape`, so the grey shapes are invisible to a screen reader, and one
 *   visually hidden `span.xo-skeleton__label[role=status]` says "Loading" (`label` changes the words; `label=""` leaves it out when a nearby one already says it).
 * - The shimmer is CSS and is switched off under `prefers-reduced-motion`.
 */
import { XoElement, define, text } from '@xoong/core';

const length = (/** @type {string} */ v) => (/^\d+(\.\d+)?$/.test(v) ? `${v}px` : v);

class XoSkeleton extends XoElement {
  static props = { lines: Number, shape: String, width: String, height: String, label: String };

  connected() { this.#draw(); }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); if (this.isConnected) this.#draw(); }

  #draw() {
    const shape = this.shape === 'circle' || this.shape === 'rect' ? this.shape : 'text';
    const shapes = document.createElement('span');
    shapes.className = 'xo-skeleton__shapes';
    shapes.setAttribute('aria-hidden', 'true');
    const count = shape === 'text' ? Math.min(Math.max(Math.floor(this.lines) || 1, 1), 20) : 1;
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('i');
      bar.className = `xo-skeleton__shape xo-skeleton__shape--${shape}`;
      const w = this.width ? length(this.width) : shape === 'text' && count > 1 && i === count - 1 ? '60%' : '';
      if (w) bar.style.width = w;
      const h = this.height ? length(this.height) : shape === 'circle' && w ? w : '';
      if (h) bar.style.height = h;
      shapes.append(bar);
    }
    const parts = [shapes];
    const words = this.hasAttribute('label') ? this.label : text('xoong.skeleton.label', 'Loading');
    if (words) {
      const status = document.createElement('span');
      status.className = 'xo-skeleton__label xo-visually-hidden';
      status.setAttribute('role', 'status');
      status.textContent = words;
      parts.push(status);
    }
    this.classList.add('xo-skeleton');
    this.replaceChildren(...parts);
  }
}
define('xo-skeleton', XoSkeleton);
