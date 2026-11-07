// @ts-check
/**
 * <xo-toast></xo-toast>: shows the message of the latest `xo-error` event anywhere on the page, and hides it on the next
 * `xo-done` or after `timeout` seconds (default 6; 0 keeps it until dismissed). Put one element in the layout; style
 * `.xo-toast` with your CSS.
 *
 *   <xo-toast timeout="8"></xo-toast>
 */
import { XoElement, define } from '@xoong/core';

class XoToast extends XoElement {
  static props = { timeout: Number };
  /** @type {HTMLElement | null} */ #box = null;
  #timer = 0;
  #onError = (/** @type {Event} */ e) => this.#show(/** @type {any} */ (e).detail);
  #onDone = () => this.#hide();

  connected() {
    this.#box = document.createElement('p');
    this.#box.className = 'xo-toast';
    this.#box.setAttribute('role', 'alert');
    this.#box.hidden = true;
    this.replaceChildren(this.#box);
    document.addEventListener('xo-error', this.#onError);
    document.addEventListener('xo-done', this.#onDone);
  }

  disconnected() {
    document.removeEventListener('xo-error', this.#onError);
    document.removeEventListener('xo-done', this.#onDone);
    clearTimeout(this.#timer);
  }

  #show(/** @type {any} */ error) {
    if (!this.#box) return;
    this.#box.textContent = error?.detail ?? error?.message ?? String(error ?? 'Something went wrong');
    this.#box.hidden = false;
    clearTimeout(this.#timer);
    const seconds = this.timeout ?? 6;
    if (seconds > 0) this.#timer = /** @type {any} */ (setTimeout(() => this.#hide(), seconds * 1000));
  }

  #hide() {
    if (this.#box) this.#box.hidden = true;
  }
}
define('xo-toast', XoToast);
