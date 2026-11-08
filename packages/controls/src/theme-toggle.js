// @ts-check
/**
 * <xo-theme-toggle> lets the visitor choose the light or the dark theme.
 *
 *   <xo-theme-toggle></xo-theme-toggle>
 *
 * - A toggle button (`aria-pressed` = dark is on) that sets `data-theme="light" | "dark"` on <html>, which the themes read; the choice is saved
 *   in localStorage (`xoong-theme`, or the `storage` attribute). Until the visitor chooses, nothing is set and the system setting
 *   (prefers-color-scheme) decides, and the button follows it when it changes.
 * - To avoid a flash of the wrong theme, apply the saved value in a script in the <head> before the first paint:
 *   `try { const t = localStorage.getItem('xoong-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch {}`
 * - `xo-theme-change` fires with `{ theme }` ('light' | 'dark'); `reset()` forgets the choice and follows the system again.
 */
import { XoElement, define, text } from '@xoong/core';

class XoThemeToggle extends XoElement {
  static props = { storage: String };

  /** @type {HTMLButtonElement | null} */ #button = null;
  #query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  #onSystem = () => this.#paint();
  get #key() { return this.storage || 'xoong-theme'; }

  /** The theme in effect: the chosen one, else the system's. */
  get theme() {
    const set = document.documentElement.dataset.theme;
    return set === 'dark' || set === 'light' ? set : this.#query?.matches ? 'dark' : 'light';
  }

  connected() {
    try { const saved = localStorage.getItem(this.#key); if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved; } catch { /* not saved */ }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-only ghost';
    b.innerHTML = '<span class="ic" aria-hidden="true"></span>';
    b.addEventListener('click', () => this.#set(this.theme === 'dark' ? 'light' : 'dark'));
    this.#button = b;
    this.replaceChildren(b);
    this.#query?.addEventListener?.('change', this.#onSystem);
    this.#paint();
  }
  disconnected() { this.#query?.removeEventListener?.('change', this.#onSystem); }

  #set(/** @type {'light' | 'dark'} */ theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(this.#key, theme); } catch { /* not saved */ }
    this.#paint();
    this.dispatchEvent(new CustomEvent('xo-theme-change', { bubbles: true, detail: { theme } }));
  }

  /** Forget the choice: the system setting decides again. */
  reset() {
    delete document.documentElement.dataset.theme;
    try { localStorage.removeItem(this.#key); } catch { /* not saved */ }
    this.#paint();
    this.dispatchEvent(new CustomEvent('xo-theme-change', { bubbles: true, detail: { theme: this.theme } }));
  }

  #paint() {
    const b = this.#button;
    if (!b) return;
    const dark = this.theme === 'dark';
    b.setAttribute('aria-pressed', String(dark));
    b.setAttribute('aria-label', text('xoong.controls.darkTheme', 'Dark theme'));
    /** @type {HTMLElement} */ (b.firstElementChild).dataset.ic = dark ? 'sun' : 'moon';
  }
}
define('xo-theme-toggle', XoThemeToggle);
