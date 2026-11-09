// @ts-check
/**
 * <xo-drawer> is a side sheet on a native modal <dialog>: a filter panel, an editor, a mobile menu, a details pane.
 *
 *   <button xo-open="#filters">Filters</button>
 *   <xo-drawer id="filters" heading="Filters" side="end" size="md" dismiss>
 *     <p>...the body, it scrolls...</p>
 *     <button slot="footer" type="button" xo-close>Cancel</button><button slot="footer" type="button" xo-close value="apply">Apply</button>
 *   </xo-drawer>
 *
 * - It is opened and closed like <xo-dialog>: `xo-open="#id"` on any button, `xo-close` inside it (its `value` is the `returnValue`), or `show()` / `close(value)` / `open()`
 *   in script (`open()` resolves with the `returnValue` when it closes). Escape, the focus trap, the backdrop and the focus going back to the opener come from <dialog>.
 *   It lives in @xoong/controls and repeats the few lines of the xo-open/xo-close wiring, so it does not need @xoong/ui.
 * - Draws `dialog.xo-drawer.xo-drawer--end|start.xo-drawer--sm|md|lg > .xo-drawer__head (h2.xo-drawer__title + button close) + .xo-drawer__body + .xo-drawer__foot`.
 *   The header and the footer stay in place, the body scrolls, the page behind does not (`body:has(dialog.xo-drawer[open])`). On a phone it covers the screen.
 * - `side` is `end` (default) or `start`: logical, so it follows the writing direction. `size` is `sm`, `md` (default) or `lg`. `dismiss` closes it on a click outside.
 *   `heading` is the title; without it give `label` as the accessible name. The elements marked `slot="footer"` become the footer.
 */
import { XoElement, define, text } from '@xoong/core';

let counter = 0;

class XoDrawer extends XoElement {
  static props = { heading: String, label: String, side: String, size: String, dismiss: Boolean };
  /** @type {HTMLDialogElement | null} */ #dialog = null;

  constructor() {
    super();
    this.addEventListener('click', (e) => {
      const d = this.#dialog;
      if (!this.hasAttribute('dismiss') || e.target !== d || !d) return;
      const r = d.getBoundingClientRect(); // a click on the backdrop reports the dialog as its target
      if (r.width && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) this.close();
    });
  }

  connected() { void this.ready().then(() => this.#build()); }

  #build() {
    if (this.#dialog || !this.isConnected) return;
    const old = /** @type {HTMLDialogElement | null} */ (this.querySelector(':scope > dialog.xo-drawer')); // a copy of a drawn drawer: keep what it holds
    if (old) { this.#dialog = old; return; }
    const d = document.createElement('dialog');
    const id = `xo-drawer-${++counter}`;
    d.className = 'xo-drawer';
    if (this.heading) d.setAttribute('aria-labelledby', id); else if (this.label) d.setAttribute('aria-label', this.label);
    const head = document.createElement('div');
    head.className = 'xo-drawer__head';
    const title = document.createElement('h2');
    title.className = 'xo-drawer__title';
    title.id = id;
    title.textContent = this.heading;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-only ghost';
    close.setAttribute('xo-close', '');
    close.setAttribute('aria-label', text('xoong.drawer.close', 'Close'));
    close.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    head.append(title, close);
    const body = document.createElement('div');
    body.className = 'xo-drawer__body';
    const foot = document.createElement('div');
    foot.className = 'xo-drawer__foot';
    for (const n of [...this.childNodes]) (n instanceof Element && n.getAttribute('slot') === 'footer' ? foot : body).append(n);
    d.append(head, body);
    if (foot.childElementCount) d.append(foot);
    this.append(d);
    this.#dialog = d;
    this.#paint();
  }

  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }
  #paint() {
    const d = this.#dialog;
    if (!d) return;
    d.classList.toggle('xo-drawer--start', this.side === 'start');
    d.classList.toggle('xo-drawer--end', this.side !== 'start');
    for (const s of ['sm', 'md', 'lg']) d.classList.toggle(`xo-drawer--${s}`, (this.size === s) || (s === 'md' && !['sm', 'lg'].includes(this.size)));
  }

  get dialog() { return this.#dialog; }
  show() {
    const d = this.#dialog;
    if (!d || d.open) return;
    if (d.showModal) d.showModal(); else d.setAttribute('open', ''); // DOMs without <dialog> support (tests)
  }
  /** Open it and wait: resolves with the `returnValue` when it closes ('' for Escape and the Close button). */
  open() {
    const d = this.#dialog;
    if (!d) return Promise.resolve('');
    return new Promise((resolve) => { d.addEventListener('close', () => resolve(d.returnValue), { once: true }); this.show(); });
  }
  close(/** @type {string | undefined} */ value) {
    const d = this.#dialog;
    if (!d?.open) return;
    if (d.close) d.close(value); else { d.returnValue = value ?? ''; d.removeAttribute('open'); d.dispatchEvent(new Event('close')); }
  }
}
define('xo-drawer', XoDrawer);

// One delegated listener for the page (the module runs once), the same attributes as <xo-dialog>.
document.addEventListener('click', (event) => {
  const target = /** @type {Element} */ (event.target);
  const opener = target.closest?.('[xo-open]');
  if (opener) { try { const d = document.querySelector(opener.getAttribute('xo-open') ?? ''); if (d instanceof XoDrawer) d.show(); } catch { /* not a selector: <xo-dialog> reports it */ } }
  const closer = target.closest?.('[xo-close]');
  const drawer = closer?.closest('xo-drawer');
  if (closer && drawer instanceof XoDrawer) drawer.close(closer.getAttribute('value') ?? undefined);
});
