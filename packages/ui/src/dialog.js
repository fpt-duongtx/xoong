// @ts-check
/**
 * <xo-dialog id="add"> ...content... </xo-dialog>
 * <button xo-open="#add">Add</button>        opens it (modal, on a native <dialog>)
 * <button xo-close>Cancel</button>           closes the dialog it is in
 *
 * The dialog also closes when a form inside it succeeds (`xo-done`). Escape, focus trapping and the
 * backdrop come from the browser's <dialog>; nothing is reimplemented.
 */
import { XoElement, define } from '@xoong/core';

class XoDialog extends XoElement {
  /** @type {HTMLDialogElement | null} */ #dialog = null;

  connected() {
    // Children may not exist yet when the element is connected (HTML parser): wrap them once the tree is complete.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.#wrap(), { once: true });
    else queueMicrotask(() => this.#wrap());
  }

  #wrap() {
    if (this.#dialog || !this.isConnected) return;
    const dialog = document.createElement('dialog');
    dialog.append(...this.childNodes);
    this.append(dialog);
    this.#dialog = dialog;
    this.addEventListener('xo-done', () => this.close());
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
        else console.error(`xoong: xo-open="${selector}" matches no <xo-dialog>`);
      } catch {
        console.error(`xoong: xo-open="${selector}" is not a valid selector (use an id such as #add)`);
      }
    }
    const closer = target.closest?.('[xo-close]');
    if (closer) closer.closest('xo-dialog')?.close(closer.getAttribute('value') ?? undefined);
  });
}
