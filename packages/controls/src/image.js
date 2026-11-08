// @ts-check
/**
 * <xo-image> is an image that behaves well on a page: it loads lazily, keeps its space (no layout jump), shows a placeholder while it
 * loads and something useful when it fails.
 *
 *   <xo-image src="/img/cover.jpg" alt="The harbour at dusk" width="1200" height="800"></xo-image>
 *   <xo-image src="{cover.url}" alt="{cover.alt}" ratio="16/9" fit="cover" srcset="/s.jpg 480w, /l.jpg 1200w" sizes="(min-width: 60rem) 50vw, 100vw"></xo-image>
 *   <xo-image src="/hero.jpg" alt="" priority></xo-image>
 *
 * - `alt` is required: text for the image, or `alt=""` for a decorative one. `xoong check` warns when it is missing.
 * - Lazy by default (`loading="lazy"`, `decoding="async"`). `priority` is for the one image above the fold: eager, high fetch priority.
 * - The space is reserved from `width` and `height`, or from `ratio` (`16/9`, `1.5`). `fit` (cover by default, or contain) and `position` set how
 *   the picture fills it (the custom properties --xo-image-fit and --xo-image-position, set through the CSS object model: no style attribute).
 * - `srcset` and `sizes` go to the <img> as they are. A `src` that changes (in an <xo-view>, with `src="{path}"`) loads again.
 * - `data-state` on the element: `empty` (no src), `loading` (skeleton), `loaded`, `error`. On an error the `fallback` src is tried once;
 *   without one the alt text is shown in the box. `load` and `error` events are re-fired on the element (they do not bubble).
 */
import { XoElement, define } from '@xoong/core';

class XoImage extends XoElement {
  static props = { src: String, srcset: String, sizes: String, alt: String, width: Number, height: Number, ratio: String, fit: String, position: String, priority: Boolean, loading: String, fallback: String };

  /** @type {HTMLImageElement | null} */ #img = null;
  /** @type {HTMLElement | null} */ #note = null;
  #fellBack = false;
  #warned = false;

  connected() {
    const img = document.createElement('img');
    img.decoding = 'async';
    img.addEventListener('load', () => { this.#state('loaded'); this.dispatchEvent(new Event('load')); });
    img.addEventListener('error', () => this.#failed());
    this.#img = img;
    this.replaceChildren(img);
    this.#paint();
  }
  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (attr === 'src' || attr === 'srcset') this.#fellBack = false;
    this.#paint();
  }

  #state(/** @type {string} */ s) {
    this.dataset.state = s;
    if (s !== 'error') { this.#note?.remove(); this.#note = null; }
  }

  #paint() {
    const img = this.#img;
    if (!img) return;
    if (!this.hasAttribute('alt') && !this.#warned) { this.#warned = true; console.warn('xoong: <xo-image> needs an alt attribute (alt="" for a decorative image)', this.getAttribute('src')); }
    img.alt = this.alt ?? '';
    img.loading = this.priority ? 'eager' : this.loading === 'eager' ? 'eager' : 'lazy';
    img.fetchPriority = this.priority ? 'high' : 'auto';
    for (const k of /** @type {const} */ (['width', 'height'])) { if (this[k]) img.setAttribute(k, String(this[k])); else img.removeAttribute(k); }
    if (this.sizes) img.sizes = this.sizes; else img.removeAttribute('sizes');
    const ratio = this.ratio ? this.ratio.replace(/\s/g, '') : this.width && this.height ? `${this.width}/${this.height}` : '';
    const set = (/** @type {string} */ k, /** @type {string | null | undefined} */ v) => (v ? this.style.setProperty(k, v) : this.style.removeProperty(k));
    set('aspect-ratio', ratio);
    set('--xo-image-fit', this.fit);
    set('--xo-image-position', this.position);
    const src = this.#fellBack ? this.fallback : this.src;
    const srcset = this.#fellBack ? '' : this.srcset;
    if (!src && !srcset) { img.removeAttribute('src'); img.removeAttribute('srcset'); this.#state('empty'); return; }
    if (srcset) img.srcset = srcset; else img.removeAttribute('srcset');
    if (src && img.getAttribute('src') !== src) { this.#state('loading'); img.src = src; }
    else if (!src) this.#state('loading');
    if (img.complete && img.naturalWidth > 0) this.#state('loaded'); // from the cache: there may be no load event
    else if (!this.dataset.state || this.dataset.state === 'empty') this.#state('loading');
  }

  #failed() {
    if (this.fallback && !this.#fellBack) { this.#fellBack = true; this.#paint(); return; }
    this.#state('error');
    if (!this.#note) {
      this.#note = document.createElement('span');
      this.#note.className = 'xo-image-note';
      this.append(this.#note);
    }
    this.#note.textContent = this.alt ?? '';
    this.dispatchEvent(new Event('error'));
  }
}
define('xo-image', XoImage);
