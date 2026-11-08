// @ts-check
/**
 * <xo-accordion> turns a stack of native <details> into an accordion.
 *
 *   <xo-accordion single>
 *     <details><summary>What is xoong?</summary><div class="xo-accordion__body">A small framework.</div></details>
 *     <details open><summary>Does it need a build?</summary><div class="xo-accordion__body">No.</div></details>
 *   </xo-accordion>
 *
 * - The children stay native <details>: Enter and Space on the summary work as the browser does. `single` allows one open at a time
 *   (the native `name` attribute of <details>). ArrowUp, ArrowDown, Home and End move between the summaries.
 * - Each <details> gets the class `xo-accordion` and a body class if you leave it out is up to you; `xo-accordion-change` fires with `{ index, open }`.
 */
import { XoElement, define } from '@xoong/core';

let counter = 0;

class XoAccordion extends XoElement {
  static props = { single: Boolean };
  #name = `xo-accordion-${++counter}`;

  connected() {
    this.addEventListener('toggle', (e) => {
      const d = e.target;
      if (d instanceof HTMLDetailsElement && d.parentElement === this) this.dispatchEvent(new CustomEvent('xo-accordion-change', { bubbles: true, detail: { index: this.#items.indexOf(d), open: d.open } }));
    }, true);
    this.addEventListener('keydown', (e) => this.#key(e));
    this.#setup();
    new MutationObserver(() => this.#setup()).observe(this, { childList: true });
  }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#setup(); }

  get #items() { return /** @type {HTMLDetailsElement[]} */ ([...this.children].filter((c) => c instanceof HTMLDetailsElement)); }
  #setup() {
    for (const d of this.#items) {
      d.classList.add('xo-accordion');
      if (this.single) d.setAttribute('name', this.#name); else if (d.getAttribute('name') === this.#name) d.removeAttribute('name');
    }
  }
  #key(/** @type {KeyboardEvent} */ e) {
    const t = e.target;
    if (!(t instanceof HTMLElement) || t.localName !== 'summary') return;
    const sums = this.#items.map((d) => /** @type {HTMLElement} */ (d.querySelector(':scope > summary')));
    const i = sums.indexOf(t);
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: sums.length - 1 }[e.key];
    if (to === undefined || i < 0) return;
    e.preventDefault();
    sums[(to + sums.length) % sums.length]?.focus();
  }
}
define('xo-accordion', XoAccordion);
