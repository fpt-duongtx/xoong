// @ts-check
/**
 * <xo-alert> is a message that stays in the page: a notice above a form, a warning about the plan, a saved-successfully banner.
 *
 *   <xo-alert kind="warning" heading="Your trial ends in 3 days" dismissible>Add a payment method to keep your pages.
 *     <a slot="action" href="/billing">Add payment method</a></xo-alert>
 *
 * - `kind` is `info` (default), `success`, `warning` or `danger`. It draws the kit's notice, `div.notice.info|ok|warn|error.xo-alert`, with an icon by kind (an
 *   inline svg, `aria-hidden`: the kind is also in the colour and the icon, never the colour alone), `.xo-alert__body` (`.xo-alert__heading` and the text) and
 *   `.xo-alert__action` for the children marked `slot="action"`.
 * - The live region: `info` and `success` are `role="status"` (polite); `warning` and `danger` are `role="alert"` (assertive). `live="polite|assertive|off"` sets it yourself.
 * - `dismissible` adds a Close button (`.xo-alert__close`). It hides the alert (`hidden`) and fires `xo-dismiss`; `preventDefault()` on the event keeps it.
 */
import { XoElement, define, text } from '@xoong/core';

const ICONS = {
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  success: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>',
  warning: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  danger: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
};
const CLASS = { info: 'info', success: 'ok', warning: 'warn', danger: 'error' };
const svg = (/** @type {string} */ paths) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

class XoAlert extends XoElement {
  static props = { kind: String, heading: String, dismissible: Boolean, live: String };
  /** @type {HTMLElement | null} */ #box = null;

  connected() { void this.ready().then(() => this.#build()); }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); if (this.#box) this.#build(); }

  #build() {
    if (!this.isConnected) return;
    const old = this.#box ?? this.querySelector(':scope > .xo-alert'); // a re-draw or a copy of a drawn alert: keep what it holds
    const content = old
      ? [.../** @type {HTMLElement} */ (old.querySelector(':scope > .xo-alert__body')).childNodes].filter((n) => !(n instanceof Element && n.classList.contains('xo-alert__heading'))).concat([...old.querySelectorAll(':scope > .xo-alert__action > *')])
      : [...this.childNodes];
    const kind = /** @type {keyof typeof ICONS} */ (this.kind in ICONS ? this.kind : 'info');
    const box = document.createElement('div');
    box.className = `notice ${CLASS[kind]} xo-alert`;
    box.dataset.kind = kind;
    const live = this.live === 'off' ? '' : this.live === 'polite' ? 'status' : this.live === 'assertive' ? 'alert' : kind === 'warning' || kind === 'danger' ? 'alert' : 'status';
    if (live) box.setAttribute('role', live);
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.innerHTML = svg(ICONS[kind]);
    const body = document.createElement('div');
    body.className = 'xo-alert__body';
    if (this.heading) { const h = document.createElement('strong'); h.className = 'xo-alert__heading'; h.textContent = this.heading; body.append(h); }
    const action = document.createElement('div');
    action.className = 'xo-alert__action';
    for (const n of content) (n instanceof Element && n.getAttribute('slot') === 'action' ? action : body).append(n);
    box.append(icon, body);
    if (action.childElementCount) box.append(action);
    if (this.dismissible) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'icon-only ghost xo-alert__close';
      close.setAttribute('aria-label', text('xoong.alert.dismiss', 'Dismiss'));
      close.innerHTML = svg('<path d="m6 6 12 12M18 6 6 18"/>');
      close.addEventListener('click', () => { if (this.dispatchEvent(new CustomEvent('xo-dismiss', { bubbles: true, cancelable: true }))) this.hidden = true; });
      box.append(close);
    }
    this.replaceChildren(box);
    this.#box = box;
  }
}
define('xo-alert', XoAlert);
