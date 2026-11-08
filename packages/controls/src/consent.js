// @ts-check
/**
 * <xo-consent> is a cookie (or tracking) consent bar that remembers the choice.
 *
 *   <xo-consent categories="analytics,marketing" label="Cookie consent">
 *     <b>We use two cookies.</b> One keeps you signed in, one measures anonymous visits. You choose.
 *   </xo-consent>
 *   <button xo-consent-open>Cookie settings</button>
 *
 * - The text inside is the message. Two buttons: "Essential only" (every category false) and "Accept all" (every category true).
 * - The choice is saved in localStorage (`xoong-consent`, or `storage`) as `{ analytics: true, ... }`; the bar stays hidden until
 *   `open()` or a click on any element with `xo-consent-open`. `xo-consent` fires with the choices when the person chooses.
 * - Read it anywhere with `el.choices` (null until chosen). Nothing is loaded or blocked by this element: your code decides what a choice allows.
 */
import { XoElement, define, text } from '@xoong/core';

class XoConsent extends XoElement {
  static props = { categories: String, storage: String, label: String };

  /** @type {HTMLElement | null} */ #bar = null;
  #onOpen = (/** @type {Event} */ e) => { if (/** @type {Element} */ (e.target).closest?.('[xo-consent-open]')) this.open(); };
  get #key() { return this.storage || 'xoong-consent'; }
  get #names() { return (this.categories ?? '').split(',').map((s) => s.trim()).filter(Boolean); }

  /** The saved choices, or null when the visitor has not chosen. */
  get choices() { try { return JSON.parse(localStorage.getItem(this.#key) ?? 'null'); } catch { return null; } }

  connected() { document.addEventListener('click', this.#onOpen); void this.ready().then(() => this.#init()); } // the message is the children: wait until the parser has them

  #init() {
    if (this.#bar) return;
    const message = document.createElement('p');
    message.append(...this.childNodes);
    const row = document.createElement('div');
    row.className = 'row-inline';
    const make = (/** @type {string} */ label, /** @type {boolean} */ all, /** @type {boolean} */ primary) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `button${primary ? ' primary' : ''}`; b.textContent = label;
      b.addEventListener('click', () => this.#choose(all));
      return b;
    };
    row.append(make(text('xoong.consent.essential', 'Essential only'), false, false), make(text('xoong.consent.all', 'Accept all'), true, true));
    const bar = document.createElement('div');
    bar.className = 'xo-consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', this.label || text('xoong.consent.label', 'Cookie consent'));
    bar.append(message, row);
    this.#bar = bar;
    this.replaceChildren(bar);
    bar.hidden = this.choices !== null;
  }
  disconnected() { document.removeEventListener('click', this.#onOpen); }

  /** Show the bar again (cookie settings). */
  open() { if (this.#bar) { this.#bar.hidden = false; /** @type {HTMLElement | null} */ (this.#bar.querySelector('button.primary'))?.focus(); } }

  #choose(/** @type {boolean} */ all) {
    const choices = Object.fromEntries(this.#names.map((n) => [n, all]));
    try { localStorage.setItem(this.#key, JSON.stringify(choices)); } catch { /* not saved */ }
    if (this.#bar) this.#bar.hidden = true;
    this.dispatchEvent(new CustomEvent('xo-consent', { bubbles: true, detail: choices }));
  }
}
define('xo-consent', XoConsent);
