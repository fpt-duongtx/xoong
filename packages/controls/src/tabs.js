// @ts-check
/**
 * <xo-tabs> turns sections into an accessible tab set (the WAI-ARIA tabs pattern, automatic activation).
 *
 *   <xo-tabs label="Article" value="seo">
 *     <section xo-tab="General">...</section>
 *     <section xo-tab="SEO" id="seo">...</section>
 *   </xo-tabs>
 *
 * - The `xo-tab` attribute is the tab's label; the section's `id` is its key (the position when there is none).
 * - `value` is the key of the selected tab (the first one by default); `tabs.select(key)` changes it. `xo-tab-change` fires with `{ value }`.
 * - Keys: Left and Right (wrapping), Home and End move and select; only the selected tab is in the tab order.
 * - Panels are hidden, not removed: their form controls stay in the form, so a required field on another tab still blocks submit.
 *   On `xo-reveal` (a form found an invalid field) the tab that holds that field is selected, and the event is answered.
 * - A tab whose panel has a control with `aria-invalid="true"` gets `data-invalid`, for a marker in CSS.
 */
import { XoElement, define } from '@xoong/core';

let counter = 0;

class XoTabs extends XoElement {
  static props = { value: String, label: String };

  /** @type {{ key: string, panel: HTMLElement, tab: HTMLButtonElement }[]} */ #items = [];
  /** @type {HTMLElement | null} */ #list = null;
  /** @type {MutationObserver | null} */ #watch = null;
  #onReveal = (/** @type {Event} */ event) => {
    const path = /** @type {CustomEvent} */ (event).detail?.path;
    if (!path || event.defaultPrevented) return;
    const item = this.#items.find(({ panel }) => panel.querySelector(`[name="${String(path).replace(/["\\]/g, '\\$&')}"]`));
    if (item && !this.#isSelected(item)) { this.select(item.key); event.preventDefault(); }
  };

  connected() {
    // The children may not exist yet when the parser connects the element: build once the tree is complete.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.#build(), { once: true });
    else queueMicrotask(() => this.#build());
    document.addEventListener('xo-reveal', this.#onReveal);
  }

  disconnected() {
    document.removeEventListener('xo-reveal', this.#onReveal);
    this.#watch?.disconnect();
  }

  /** Select a tab by key (or by position); unknown keys are ignored. */
  select(key, { focus = false } = {}) {
    const item = this.#items.find((i) => i.key === String(key));
    if (!item) return;
    const changed = this.getAttribute('value') !== item.key;
    for (const other of this.#items) {
      const on = other === item;
      other.panel.hidden = !on;
      other.tab.setAttribute('aria-selected', String(on));
      other.tab.tabIndex = on ? 0 : -1;
    }
    this.setAttribute('value', item.key);
    if (focus) item.tab.focus();
    if (changed) this.dispatchEvent(new CustomEvent('xo-tab-change', { bubbles: true, detail: { value: item.key } }));
  }

  #isSelected(/** @type {{ tab: HTMLElement }} */ item) { return item.tab.getAttribute('aria-selected') === 'true'; }

  #build() {
    if (this.#list || !this.isConnected) return;
    const id = `xo-tabs-${++counter}`;
    this.querySelector(':scope > [role="tablist"]')?.remove(); // a copy of a tabs element that was already built (a view clones its content): start over
    const panels = /** @type {HTMLElement[]} */ ([...this.children].filter((c) => c.hasAttribute('xo-tab')));
    const list = document.createElement('div');
    list.setAttribute('role', 'tablist');
    if (this.label) list.setAttribute('aria-label', this.label);
    this.#items = panels.map((panel, i) => {
      if ('xoGenId' in panel.dataset) { panel.removeAttribute('id'); delete panel.dataset.xoGenId; } // an id made by an earlier build is not a key
      const key = panel.id || String(i); // the section's id when it has one, else its position
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.id = `${id}-tab-${i}`;
      tab.setAttribute('role', 'tab');
      tab.dataset.tab = key;
      tab.textContent = panel.getAttribute('xo-tab') ?? key;
      if (!panel.id) { panel.id = `${id}-panel-${i}`; panel.dataset.xoGenId = ''; } // for aria-controls only: the key stays the position
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      tab.addEventListener('click', () => this.select(key));
      list.append(tab);
      return { key, panel, tab };
    });
    list.addEventListener('keydown', (event) => this.#onKey(/** @type {KeyboardEvent} */ (event)));
    this.prepend(list);
    this.#list = list;
    this.select(this.#items.some((i) => i.key === this.value) ? this.value : (this.#items[0]?.key ?? ''));
    this.#watch = new MutationObserver(() => this.#markInvalid());
    this.#watch.observe(this, { subtree: true, attributes: true, attributeFilter: ['aria-invalid'] });
    this.#markInvalid();
  }

  #markInvalid() {
    for (const { panel, tab } of this.#items) tab.toggleAttribute('data-invalid', !!panel.querySelector('[aria-invalid="true"]'));
  }

  #onKey(/** @type {KeyboardEvent} */ event) {
    const at = this.#items.findIndex((i) => i.tab === event.target);
    if (at < 0) return;
    const n = this.#items.length, rtl = getComputedStyle(this).direction === 'rtl'; // the arrows follow the screen: in right-to-left the first tab is on the right
    const by = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    const next = by ? (at + by + n) % n : event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.select(this.#items[next].key, { focus: true });
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (attr === 'value' && this.#list && value !== null && !this.#items.some((i) => i.key === value && this.#isSelected(i))) this.select(value);
  }
}
define('xo-tabs', XoTabs);
