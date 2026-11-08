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
 * - `xo-menu-open` and `xo-menu-close` fire on the element. An `<hr>` between items is a divider (role=separator, skipped by the keys).
 * - A choice menu: items with a `value` attribute are radio items (`menuitemradio`, `aria-checked`); the menu's `value` says which one is on.
 *   Choosing one sets `value` (an attribute, so CSS can read it) and fires `xo-menu-select` with `{ value }`.
 *
 *     <xo-menu label="Palette" value="calm"><button xo-menu-trigger>Palette</button><button value="calm">Calm</button><button value="ember">Ember</button></xo-menu>
 */
import { XoElement, define } from '@xoong/core';
import { prepareLayer, showLayer, hideLayer } from './layer.js';

let counter = 0;

class XoMenu extends XoElement {
  static props = { label: String, value: String };

  /** @type {HTMLElement | null} */ #trigger = null;
  /** @type {HTMLElement | null} */ #panel = null;
  #stopFollowing = () => {};
  #onDocument = (/** @type {Event} */ event) => { if (!this.contains(/** @type {Node} */ (event.target))) this.close(); };
  // Escape works wherever the focus is: a click leaves it on the trigger (or on the page, in Safari, which does not focus buttons on click)
  #onEscape = (/** @type {KeyboardEvent} */ event) => { if (event.key === 'Escape' && this.isOpen) { event.preventDefault(); this.close({ focus: true }); } };

  connected() {
    this.effect(() => this.#check(this.value));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.#build(), { once: true });
    else queueMicrotask(() => this.#build());
  }

  disconnected() { document.removeEventListener('pointerdown', this.#onDocument); document.removeEventListener('keydown', this.#onEscape); }

  get isOpen() { return !!this.#panel && !this.#panel.hidden; }
  get #items() { return /** @type {HTMLElement[]} */ ([...(this.#panel?.children ?? [])]).filter((i) => i.getAttribute('role') !== 'separator'); }

  #build() {
    if (this.#panel || !this.isConnected) return;
    const drawn = this.querySelector(':scope > [role="menu"]');
    if (drawn) drawn.replaceWith(...drawn.children); // a copy of a menu that was already built (a cloned row): take the items back out of its panel and start over
    const children = /** @type {HTMLElement[]} */ ([...this.children]);
    const trigger = children.find((c) => c.hasAttribute('xo-menu-trigger')) ?? children.find((c) => c.localName === 'button');
    if (!trigger) { console.error('xoong: <xo-menu> needs a trigger button (xo-menu-trigger)'); return; }
    const id = `xo-menu-${++counter}`;
    const panel = document.createElement('div');
    panel.id = id;
    panel.setAttribute('role', 'menu');
    if (this.label) panel.setAttribute('aria-label', this.label);
    for (const item of children) {
      if (item === trigger) continue;
      if (item.localName === 'hr') { item.setAttribute('role', 'separator'); panel.append(item); continue; } // a divider: not an item, skipped by the keys
      item.setAttribute('role', item.hasAttribute('value') ? 'menuitemradio' : 'menuitem');
      item.tabIndex = -1;
      panel.append(item);
    }
    this.append(panel);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id);
    if (trigger instanceof HTMLButtonElement && !trigger.hasAttribute('type')) trigger.type = 'button'; // the `type` property is never empty (it reads "submit"): test the attribute, or a trigger inside a form submits it
    this.#trigger = trigger;
    this.#panel = panel;
    prepareLayer(panel);
    this.#check(this.value);
    trigger.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); this.open('first'); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); this.open('last'); }
    });
    panel.addEventListener('click', (event) => {
      const item = /** @type {Element} */ (event.target).closest('[role=menuitem], [role=menuitemradio]');
      if (!item) return;
      if (item.getAttribute('role') === 'menuitemradio') {
        const value = item.getAttribute('value') ?? '';
        const changed = value !== this.value;
        this.setAttribute('value', value);
        if (changed) this.dispatchEvent(new CustomEvent('xo-menu-select', { bubbles: true, detail: { value } }));
      }
      this.close({ focus: true });
    });
    panel.addEventListener('keydown', (event) => this.#onKey(event));
  }

  /** @param {'first' | 'last'} [at] focus an item (a mouse click opens without moving the focus) */
  open(at) {
    const panel = this.#panel;
    if (!panel || this.isOpen) { if (at) this.#focusItem(at === 'last' ? this.#items.length - 1 : 0); return; }
    this.#stopFollowing = showLayer(panel, /** @type {HTMLElement} */ (this.#trigger));
    this.#trigger?.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this.#onDocument);
    document.addEventListener('keydown', this.#onEscape);
    if (at) this.#focusItem(at === 'last' ? this.#items.length - 1 : 0);
    this.dispatchEvent(new CustomEvent('xo-menu-open', { bubbles: true }));
  }

  close({ focus = false } = {}) {
    const panel = this.#panel;
    if (!panel || !this.isOpen) return;
    this.#stopFollowing();
    hideLayer(panel);
    this.#trigger?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.#onDocument);
    document.removeEventListener('keydown', this.#onEscape);
    if (focus) this.#trigger?.focus();
    this.dispatchEvent(new CustomEvent('xo-menu-close', { bubbles: true }));
  }

  /** The radio item whose `value` is the menu's is the checked one. */
  #check(/** @type {string | null | undefined} */ value) {
    for (const item of this.#items) if (item.getAttribute('role') === 'menuitemradio') item.setAttribute('aria-checked', String(item.getAttribute('value') === value));
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
