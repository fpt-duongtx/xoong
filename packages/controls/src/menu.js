// @ts-check
/**
 * <xo-menu> is an action menu (the WAI-ARIA menu button pattern): one trigger and a list of items.
 *
 *   <xo-menu label="Row actions">
 *     <button xo-menu-trigger>Actions</button>
 *     <button xo-click="POST /users/{id}/disable">Disable</button>
 *     <a href="/users/{id}">Open</a>
 *   </xo-menu>
 *
 * - The trigger is the child with `xo-menu-trigger` (the first button when none has it); every other child is an item.
 * - Open with a click, Enter, Space or ArrowDown (ArrowUp opens on the last item). Inside: ArrowUp/ArrowDown (wrapping), Home, End,
 *   typing a letter jumps to the next item that starts with it. Escape closes and returns the focus to the trigger; Tab closes.
 *   Choosing an item (click or Enter) closes the menu and runs the item as usual (xo-click, a link, a click handler).
 * - Where the browser has the Popover API the list is drawn in the top layer, so it is never clipped by a table or a scroll area.
 * - `xo-menu-open` and `xo-menu-close` fire on the element.
 */
import { XoElement, define } from '@xoong/core';

let counter = 0;

class XoMenu extends XoElement {
  static props = { label: String };

  /** @type {HTMLElement | null} */ #trigger = null;
  /** @type {HTMLElement | null} */ #panel = null;
  #onDocument = (/** @type {Event} */ event) => { if (!this.contains(/** @type {Node} */ (event.target))) this.close(); };
  // Escape works wherever the focus is: a click leaves it on the trigger (or on the page, in Safari, which does not focus buttons on click)
  #onEscape = (/** @type {KeyboardEvent} */ event) => { if (event.key === 'Escape' && this.isOpen) { event.preventDefault(); this.close({ focus: true }); } };

  connected() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.#build(), { once: true });
    else queueMicrotask(() => this.#build());
  }

  disconnected() { document.removeEventListener('pointerdown', this.#onDocument); document.removeEventListener('keydown', this.#onEscape); }

  get isOpen() { return !!this.#panel && !this.#panel.hidden; }
  get #items() { return /** @type {HTMLElement[]} */ ([...(this.#panel?.children ?? [])]); }

  #build() {
    if (this.#panel || !this.isConnected) return;
    const children = /** @type {HTMLElement[]} */ ([...this.children]);
    const trigger = children.find((c) => c.hasAttribute('xo-menu-trigger')) ?? children.find((c) => c.localName === 'button');
    if (!trigger) { console.error('xoong: <xo-menu> needs a trigger button (xo-menu-trigger)'); return; }
    const id = `xo-menu-${++counter}`;
    const panel = document.createElement('div');
    panel.id = id;
    panel.setAttribute('role', 'menu');
    if (this.label) panel.setAttribute('aria-label', this.label);
    panel.hidden = true;
    for (const item of children) {
      if (item === trigger) continue;
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      panel.append(item);
    }
    this.append(panel);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id);
    if (trigger instanceof HTMLButtonElement && !trigger.type) trigger.type = 'button';
    this.#trigger = trigger;
    this.#panel = panel;
    if ('showPopover' in panel) panel.setAttribute('popover', 'manual'); // top layer; we dismiss it ourselves, the same way everywhere
    trigger.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); this.open('first'); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); this.open('last'); }
    });
    panel.addEventListener('click', (event) => { if (/** @type {Element} */ (event.target).closest('[role=menuitem]')) this.close({ focus: true }); });
    panel.addEventListener('keydown', (event) => this.#onKey(event));
  }

  /** @param {'first' | 'last'} [at] focus an item (a mouse click opens without moving the focus) */
  open(at) {
    const panel = this.#panel;
    if (!panel || this.isOpen) { if (at) this.#focusItem(at === 'last' ? this.#items.length - 1 : 0); return; }
    panel.hidden = false;
    if (panel.hasAttribute('popover')) {
      panel.showPopover();
      const r = /** @type {HTMLElement} */ (this.#trigger).getBoundingClientRect();
      Object.assign(panel.style, { position: 'fixed', inset: 'auto', margin: '0', top: `${r.bottom}px`, left: `${r.left}px` });
    }
    this.#trigger?.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this.#onDocument);
    document.addEventListener('keydown', this.#onEscape);
    if (at) this.#focusItem(at === 'last' ? this.#items.length - 1 : 0);
    this.dispatchEvent(new CustomEvent('xo-menu-open', { bubbles: true }));
  }

  close({ focus = false } = {}) {
    const panel = this.#panel;
    if (!panel || !this.isOpen) return;
    if (panel.hasAttribute('popover')) panel.hidePopover();
    panel.hidden = true;
    this.#trigger?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.#onDocument);
    document.removeEventListener('keydown', this.#onEscape);
    if (focus) this.#trigger?.focus();
    this.dispatchEvent(new CustomEvent('xo-menu-close', { bubbles: true }));
  }

  #focusItem(/** @type {number} */ index) {
    const items = this.#items;
    items[(index + items.length) % items.length]?.focus();
  }

  #onKey(/** @type {KeyboardEvent} */ event) {
    const items = this.#items;
    const at = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close({ focus: true }); return; }
    if (event.key === 'Tab') { this.close(); return; }
    if (event.key === ' ' && /** @type {Element} */ (event.target).localName === 'a') { event.preventDefault(); /** @type {HTMLElement} */ (event.target).click(); return; } // Space activates a link, as it does a button
    /** @type {number | null} */ let next = null;
    if (event.key === 'ArrowDown') next = at + 1;
    else if (event.key === 'ArrowUp') next = at < 0 ? items.length - 1 : at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const letter = event.key.toLowerCase();
      const order = [...items.slice(at + 1), ...items.slice(0, at + 1)];
      const hit = order.find((i) => (i.textContent ?? '').trim().toLowerCase().startsWith(letter));
      if (hit) { event.preventDefault(); hit.focus(); }
      return;
    }
    if (next === null) return;
    event.preventDefault();
    this.#focusItem(next);
  }
}
define('xo-menu', XoMenu);
