// @ts-check
/**
 * <xo-command> is a command palette: press Ctrl/Cmd+K, type, pick with the arrows, press Enter.
 *
 *   <xo-command shortcut="k" label="Search commands">
 *     <a href="/articles" data-group="Go to">Articles</a>
 *     <button data-group="Actions" data-value="new-article">New article</button>
 *   </xo-command>
 *
 * - The children are the commands (links or buttons; `data-group` names the group; an icon inside is kept). They are listed in a dialog;
 *   typing filters them by their text. ArrowUp/ArrowDown (wrapping) move the highlight (`aria-activedescendant`), Home/End jump, Enter runs it, Escape closes.
 * - Running a command clicks its original element (a link navigates, a button runs its own handler or `xo-click`) and fires
 *   `xo-command-run` with `{ value, label }` (`value` is `data-value`, or the href).
 * - `open()` and `close()`; the shortcut is Ctrl/Cmd plus the key of `shortcut` (default `k`).
 */
import { XoElement, define, text } from '@xoong/core';

let counter = 0;

class XoCommand extends XoElement {
  static props = { shortcut: String, label: String };

  #id = `xo-command-${++counter}`;
  /** @type {HTMLDialogElement | null} */ #dialog = null;
  /** @type {HTMLInputElement | null} */ #input = null;
  /** @type {HTMLElement | null} */ #list = null;
  /** @type {HTMLElement[]} */ #items = [];
  /** @type {{ el: HTMLElement, label: string, group: string, html: string }[]} */ #commands = [];
  #active = 0;
  #onKey = (/** @type {KeyboardEvent} */ e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === (this.shortcut || 'k').toLowerCase()) { e.preventDefault(); this.open(); } };

  connected() { void this.ready().then(() => this.#init()); document.addEventListener('keydown', this.#onKey); } // the commands are the children: wait until the parser has them

  #init() {
    if (this.#dialog) return;
    this.#commands = [...this.children].filter((c) => c instanceof HTMLElement).map((el) => ({ el: /** @type {HTMLElement} */ (el), label: (el.textContent ?? '').trim(), group: el.dataset.group ?? '', html: el.innerHTML }));
    for (const c of this.#commands) c.el.hidden = true;
    const dialog = document.createElement('dialog');
    dialog.className = 'xo-command-dialog';
    dialog.setAttribute('aria-label', this.label || text('xoong.command.label', 'Search commands'));
    dialog.innerHTML = `<div class="xo-float xo-command"><div class="xo-command__input"><span class="ic" data-ic="search" aria-hidden="true"></span><input role="combobox" aria-expanded="true" aria-autocomplete="list" autocomplete="off"><span class="xo-kbd" aria-hidden="true">Esc</span></div><div class="xo-listbox" role="listbox"></div></div>`;
    const input = /** @type {HTMLInputElement} */ (dialog.querySelector('input'));
    const list = /** @type {HTMLElement} */ (dialog.querySelector('.xo-listbox'));
    list.id = `${this.#id}-list`; list.setAttribute('aria-label', text('xoong.command.results', 'Results'));
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-label', this.label || text('xoong.command.label', 'Search commands'));
    input.placeholder = text('xoong.command.placeholder', 'Type a command or page');
    input.addEventListener('input', () => { this.#active = 0; this.#render(); });
    input.addEventListener('keydown', (e) => this.#key(e));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) this.close(); }); // the backdrop
    dialog.addEventListener('close', () => { input.value = ''; });
    this.#dialog = dialog; this.#input = input; this.#list = list;
    this.append(dialog);
  }
  disconnected() { document.removeEventListener('keydown', this.#onKey); }

  open() { if (!this.#dialog || this.#dialog.open) return; this.#active = 0; this.#render(); this.#dialog.showModal(); this.#input?.focus(); }
  close() { this.#dialog?.close(); }

  #render() {
    const q = (this.#input?.value ?? '').trim().toLowerCase();
    const shown = this.#commands.filter((c) => !q || c.label.toLowerCase().includes(q));
    const list = /** @type {HTMLElement} */ (this.#list);
    list.replaceChildren();
    this.#items = [];
    if (!shown.length) { const p = document.createElement('p'); p.className = 'xo-option__group'; p.textContent = text('xoong.controls.noResults', 'No results'); list.append(p); }
    let group = null;
    shown.forEach((c, i) => {
      if (c.group && c.group !== group) { group = c.group; const g = document.createElement('div'); g.className = 'xo-option__group'; g.setAttribute('role', 'presentation'); g.textContent = c.group; list.append(g); }
      const o = document.createElement('button');
      o.type = 'button'; o.className = 'xo-option'; o.setAttribute('role', 'option'); o.tabIndex = -1; o.id = `${this.#id}-o${i}`; o.innerHTML = c.html;
      o.addEventListener('click', () => this.#run(c));
      o.addEventListener('pointermove', () => { this.#active = i; this.#mark(); });
      list.append(o);
      this.#items.push(o);
    });
    this.#shown = shown;
    this.#mark();
  }
  /** @type {typeof this.#commands} */ #shown = [];
  #mark() {
    this.#items.forEach((o, i) => { const on = i === this.#active; o.classList.toggle('xo-option--active', on); o.setAttribute('aria-selected', String(on)); if (on) o.scrollIntoView?.({ block: 'nearest' }); });
    const on = this.#items[this.#active];
    if (on) this.#input?.setAttribute('aria-activedescendant', on.id); else this.#input?.removeAttribute('aria-activedescendant');
  }
  #key(/** @type {KeyboardEvent} */ e) {
    const n = this.#items.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (n) { this.#active = (this.#active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; this.#mark(); } }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); this.#active = e.key === 'Home' ? 0 : Math.max(0, n - 1); this.#mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = this.#shown[this.#active]; if (c) this.#run(c); }
  }
  #run(/** @type {{ el: HTMLElement, label: string }} */ c) {
    this.close();
    const value = c.el.dataset.value ?? c.el.getAttribute('href') ?? c.label;
    this.dispatchEvent(new CustomEvent('xo-command-run', { bubbles: true, detail: { value, label: c.label } }));
    c.el.hidden = false; c.el.click(); c.el.hidden = true;
  }
}
define('xo-command', XoCommand);
