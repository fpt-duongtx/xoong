// @ts-check
/**
 * <xo-toast></xo-toast>: messages for the person, from anywhere on the page.
 *
 *  - errors: the latest `xo-error` (a failed action), in a `role="alert"` region; hidden by the next `xo-done` or after `timeout` seconds.
 *    `detail.action` (`{ label, run }`) and `detail.timeout` are honoured, so a listener can add Retry before the toast draws it;
 *  - notices: an `xo-notice` event ({ message, kind: 'success' | 'info', action?, timeout? }) in a `role="status"` region. `xo-notice="Saved"`
 *    on an `xo-click`/`xo-submit` element raises one after success; from JavaScript use `toast.show({ message, action })`.
 *  - an action is a button inside the toast, for example Undo or Retry: `action: { label: 'Retry', run: () => ... }`.
 *
 *   <xo-toast timeout="8"></xo-toast>
 *
 * Put one element in the layout; style `.xo-toast` (and `.xo-toast-status`) with your CSS. `timeout` 0 keeps a toast until dismissed.
 */
import { XoElement, define } from '@xoong/core';

class XoToast extends XoElement {
  static props = { timeout: Number };
  /** @type {HTMLElement | null} */ #error = null;
  /** @type {HTMLElement | null} */ #status = null;
  #timers = /** @type {Record<string, any>} */ ({});
  // Decided after the event has gone round (a microtask): a handler anywhere, even on the document and registered later, can prevent it; a view that shows `$error` itself marks it handled
  #onError = (/** @type {Event} */ e) => queueMicrotask(() => { const d = /** @type {any} */ (e).detail; if (!e.defaultPrevented && !(/** @type {any} */ (e).handled)) this.#show('error', { message: this.#text(d), action: d?.action, timeout: d?.timeout }); });
  #onNotice = (/** @type {Event} */ e) => this.#show('status', /** @type {any} */ (e).detail ?? {});
  #onDone = () => this.#hide('error');

  connected() {
    this.#error = this.#region('xo-toast', 'alert');
    this.#status = this.#region('xo-toast xo-toast-status', 'status');
    this.replaceChildren(this.#error, this.#status);
    document.addEventListener('xo-error', this.#onError);
    document.addEventListener('xo-notice', this.#onNotice);
    document.addEventListener('xo-done', this.#onDone);
  }

  disconnected() {
    document.removeEventListener('xo-error', this.#onError);
    document.removeEventListener('xo-notice', this.#onNotice);
    document.removeEventListener('xo-done', this.#onDone);
    for (const t of Object.values(this.#timers)) clearTimeout(t);
  }

  #region(className, role) {
    const p = document.createElement('p');
    p.className = className;
    p.setAttribute('role', role); // present from the start, so assistive technology announces what is put in it later
    p.hidden = true;
    return p;
  }

  #text(error) { return error?.detail ?? error?.message ?? String(error ?? 'Something went wrong'); }

  /** @param {'error' | 'status'} which @param {{ message?: string, action?: { label: string, run: () => any }, timeout?: number }} notice */
  #show(which, notice) {
    const box = /** @type {HTMLElement} */ (which === 'error' ? this.#error : this.#status);
    box.replaceChildren(document.createTextNode(notice.message ?? ''));
    if (notice.action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'xo-toast-action';
      button.textContent = notice.action.label;
      button.addEventListener('click', async () => { this.#hide(which); await notice.action?.run(); });
      box.append(' ', button);
    }
    box.hidden = false;
    clearTimeout(this.#timers[which]);
    const seconds = notice.timeout ?? this.timeout ?? 6;
    if (seconds > 0) this.#timers[which] = setTimeout(() => this.#hide(which), seconds * 1000);
  }

  #hide(which) {
    const box = which === 'error' ? this.#error : this.#status;
    if (box) box.hidden = true;
  }
}
define('xo-toast', XoToast);

/** Show a notice from JavaScript: `toast.show({ message: 'Published 3', action: { label: 'Undo', run: undo } })`. */
export const toast = {
  show(/** @type {{ message: string, kind?: string, action?: { label: string, run: () => any }, timeout?: number }} */ notice) {
    document.dispatchEvent(new CustomEvent('xo-notice', { detail: { kind: 'info', ...notice }, bubbles: true }));
  },
};
