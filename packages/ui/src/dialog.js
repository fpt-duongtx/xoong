// @ts-check
/**
 * <xo-dialog id="add"> ...content... </xo-dialog>
 * <button xo-open="#add">Add</button>        opens it (modal, on a native <dialog>)
 * <button xo-close>Cancel</button>           closes the dialog it is in
 *
 * The dialog also closes when a form inside it succeeds (`xo-done`). Escape, focus trapping and the
 * backdrop come from the browser's <dialog>; nothing is reimplemented.
 *
 * With `heading` it is a titled modal (the kit's dialog.xo-modal): a header with the title and a Close button, the content as the body, and the
 * elements marked `slot="footer"` as the footer. `size="sm|wide|full"` changes the width and `dismiss` closes it on a click outside it.
 *
 *   <xo-dialog id="edit" heading="Edit person" size="wide" dismiss>
 *     <xo-form op="updatePerson" ...></xo-form>
 *     <button slot="footer" type="button" xo-close>Cancel</button>
 *   </xo-dialog>
 */
import { XoElement, define } from '@xoong/core';
import { text } from '@xoong/core';

let counter = 0;

class XoDialog extends XoElement {
  static props = { heading: String, size: String };
  /** @type {HTMLDialogElement | null} */ #dialog = null;

  connected() {
    // Children may not exist yet when the element is connected (HTML parser): wrap them once the tree is complete.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.#wrap(), { once: true });
    else queueMicrotask(() => this.#wrap());
  }

  #wrap() {
    if (this.#dialog || !this.isConnected) return;
    const dialog = document.createElement('dialog');
    if (this.heading) this.#modal(dialog); else dialog.append(...this.childNodes);
    this.append(dialog);
    this.#dialog = dialog;
    this.addEventListener('xo-done', () => this.close());
    if (this.hasAttribute('dismiss')) {
      dialog.addEventListener('click', (event) => {
        const r = dialog.getBoundingClientRect();
        if (r.width && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) this.close(); // the backdrop is part of the dialog's box model
      });
    }
  }

  /** A titled modal: header (title and Close), body, and the footer the author marked. @param {HTMLDialogElement} dialog */
  #modal(dialog) {
    const id = `xo-modal-${++counter}`;
    dialog.className = `xo-modal${this.size === 'wide' || this.size === 'full' || this.size === 'sm' ? ` xo-modal--${this.size}` : ''}`;
    dialog.setAttribute('aria-labelledby', id);
    const head = document.createElement('div');
    head.className = 'xo-modal__head';
    const title = document.createElement('h2');
    title.id = id;
    title.textContent = this.heading;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-only ghost';
    close.setAttribute('xo-close', '');
    close.setAttribute('aria-label', text('xoong.dialog.close', 'Close'));
    close.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    head.append(title, close);
    const body = document.createElement('div');
    body.className = 'xo-modal__body';
    const foot = document.createElement('div');
    foot.className = 'xo-modal__foot';
    for (const node of [...this.childNodes]) (node instanceof Element && node.getAttribute('slot') === 'footer' ? foot : body).append(node);
    dialog.append(head, body);
    if (foot.childElementCount) dialog.append(foot);
  }

  get dialog() { return this.#dialog; }
  show() {
    const d = this.#dialog;
    if (!d || d.open) return;
    if (d.showModal) d.showModal(); else d.setAttribute('open', ''); // DOMs without <dialog> support (tests)
  }
  /** Open it and wait for the answer: resolves with the `returnValue` when it closes (`xo-close value="ok"`, `close('ok')`, or '' for Escape and Cancel). */
  open() {
    const d = this.#dialog;
    if (!d) return Promise.resolve('');
    return new Promise((resolve) => {
      d.addEventListener('close', () => resolve(d.returnValue), { once: true });
      this.show();
    });
  }
  close(/** @type {string | undefined} */ value) {
    const d = this.#dialog;
    if (!d?.open) return;
    if (d.close) d.close(value); else { d.returnValue = value ?? ''; d.removeAttribute('open'); d.dispatchEvent(new Event('close')); }
  }
}
define('xo-dialog', XoDialog);

// One delegated listener for the page (the module runs once): buttons do not need wiring.
{
  document.addEventListener('click', (event) => {
    const target = /** @type {Element} */ (event.target);
    const opener = target.closest?.('[xo-open]');
    if (opener) {
      const selector = opener.getAttribute('xo-open') ?? '';
      try {
        const dialog = document.querySelector(selector);
        if (dialog instanceof XoDialog) dialog.show();
        else if (dialog?.localName !== 'xo-drawer') console.error(`xoong: xo-open="${selector}" matches no <xo-dialog>`); // an <xo-drawer> (@xoong/controls) opens itself
      } catch {
        console.error(`xoong: xo-open="${selector}" is not a valid selector`);
      }
    }
    const closer = target.closest?.('[xo-close]');
    if (closer) closer.closest('xo-dialog')?.close(closer.getAttribute('value') ?? undefined);
  });
}
