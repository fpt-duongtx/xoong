// @ts-check
/**
 * <xo-tree> is a tree view (the WAI-ARIA tree pattern): folders and files, a category tree, a page outline.
 *
 *   <xo-tree label="Files" selectable><ul><li>src<ul><li>index.js</li><li>util.js</li></ul></li><li>README.md</li></ul></xo-tree>
 *   <xo-tree label="Regions" multiple expanded="asia" data='[{"id":"asia","label":"Asia","children":[{"id":"vn","label":"Vietnam"}]}]'></xo-tree>
 *
 * - The data is nested `<ul><li>` markup (the text of an `li` is its label; `data-id`, or the `id`, or the text is its id; `open` expands it; `data-lazy` marks
 *   children to load) or the JSON `data` (`[{ id, label, children, open, lazy }]`; the property takes the array). It draws `ul.xo-tree[role=tree] > li[role=treeitem] >
 *   .xo-tree__row (.xo-tree__caret + .xo-tree__check + .xo-tree__label) + ul[role=group]`. The state lives in the DOM (`aria-expanded`, `aria-selected`, `aria-checked`).
 * - `selectable` chooses one item (`aria-selected`); `multiple` shows a checkbox on every item (`aria-checked`, a parent is true, false or `mixed` from its children) and
 *   toggles each with Space or a click. `selected` (attribute: ids separated by commas; property: an array) and `expanded` (ids) are the state; `xo-tree-select` fires with
 *   `{ id, selected }` and `xo-tree-toggle` with `{ id, expanded }`.
 * - Keys, on one item that has the focus (a roving tabindex: one Tab stop): Down and Up move, Right opens a closed parent and then goes to its first child, Left closes an
 *   open one and then goes to the parent (swapped in right-to-left text), Home and End go to the first and the last visible item, `*` opens all the siblings, typing
 *   goes to the next item that starts with it (accents ignored), Enter and Space choose (without `selectable` they open and close).
 * - Lazy children: an item with `data-lazy` (or `lazy: true`) fires `xo-tree-load` with `{ id }` when it is opened the first time; answer with `tree.setChildren(id, [...])`.
 */
import { XoElement, define } from '@xoong/core';
import { fold } from './fold.js';

const ROLE = '[role=treeitem]';
const el = (/** @type {string} */ tag, /** @type {string} */ cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

class XoTree extends XoElement {
  static props = { data: String, label: String, selectable: Boolean, multiple: Boolean, expanded: String, selected: String };

  /** @type {any[]} */ #model = [];
  #typed = '';
  /** @type {any} */ #timer = 0;

  constructor() {
    super();
    this.addEventListener('click', (e) => this.#click(e));
    this.addEventListener('keydown', (e) => this.#key(e));
  }

  get data() { return this.#model; }
  set data(v) { this.#model = typeof v === 'string' ? JSON.parse(v || '[]') : Array.isArray(v) ? v : []; if (this.isConnected) this.#draw(this.selected); }
  get selected() { return [...this.querySelectorAll('[aria-selected=true], [aria-checked=true]')].map((li) => /** @type {HTMLElement} */ (li).dataset.id ?? ''); }
  set selected(ids) { this.#choose(Array.isArray(ids) ? ids.map(String) : String(ids).split(',').map((s) => s.trim()).filter(Boolean)); }

  connected() { void this.ready().then(() => { if (!this.querySelector(':scope > .xo-tree')) { this.#read(); this.#draw(); } }); }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (!this.isConnected || !this.querySelector(':scope > .xo-tree')) return;
    if (attr === 'data') this.data = value ?? '';
    else if (attr === 'selectable' || attr === 'multiple') this.#draw(this.selected);
    else if (attr === 'label') this.querySelector(':scope > .xo-tree')?.setAttribute('aria-label', this.label);
    else if (attr === 'expanded') this.#open(value ?? '');
    else if (attr === 'selected') this.#choose((value ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  }

  /** The tree the author wrote: attribute JSON, else the nested lists. */
  #read() {
    if (this.#model.length) return; // set as a property
    if (this.hasAttribute('data')) { try { this.#model = JSON.parse(this.getAttribute('data') ?? '[]'); } catch { this.#model = []; } return; }
    const parse = (/** @type {Element} */ ul) => [...ul.children].filter((li) => li.localName === 'li').map((li) => {
      const sub = li.querySelector(':scope > ul');
      const label = [...li.childNodes].filter((n) => n !== sub).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
      return { id: /** @type {HTMLElement} */ (li).dataset.id || li.id || label, label, open: li.hasAttribute('open'), lazy: li.hasAttribute('data-lazy'), children: sub ? parse(sub) : [] };
    });
    const root = this.querySelector('ul');
    this.#model = root ? parse(root) : [];
  }

  #mode() { return this.multiple ? 'checked' : this.selectable ? 'selected' : ''; }

  #node(/** @type {any} */ n) {
    const li = el('li', '');
    li.setAttribute('role', 'treeitem');
    li.dataset.id = String(n.id ?? n.label);
    li.tabIndex = -1;
    const row = el('div', 'xo-tree__row');
    const kids = n.children?.length;
    const caret = el('span', 'xo-tree__caret');
    caret.setAttribute('aria-hidden', 'true');
    row.append(caret);
    if (this.multiple) { const box = el('span', 'xo-tree__check'); box.setAttribute('aria-hidden', 'true'); row.append(box); }
    const text = el('span', 'xo-tree__label');
    text.textContent = String(n.label ?? n.id);
    row.append(text);
    li.append(row);
    if (kids || n.lazy) li.setAttribute('aria-expanded', String(!!(kids && n.open)));
    if (n.lazy && !kids) li.dataset.lazy = '';
    if (kids) this.#group(li, n.children, !!n.open);
    else caret.classList.add('xo-tree__caret--leaf');
    const mode = this.#mode();
    if (mode) li.setAttribute(`aria-${mode}`, 'false');
    return li;
  }
  #group(/** @type {HTMLElement} */ li, /** @type {any[]} */ list, /** @type {boolean} */ open) {
    const g = el('ul', '');
    g.setAttribute('role', 'group');
    g.hidden = !open;
    g.append(...list.map((c) => this.#node(c)));
    li.append(g);
  }

  #draw(keep = /** @type {string[]} */ ([])) {
    const open = new Set([...this.querySelectorAll('[aria-expanded=true]')].map((li) => /** @type {HTMLElement} */ (li).dataset.id));
    const root = el('ul', 'xo-tree');
    root.setAttribute('role', 'tree');
    if (this.label) root.setAttribute('aria-label', this.label);
    if (this.multiple) root.setAttribute('aria-multiselectable', 'true');
    root.append(...this.#model.map((n) => this.#node(n)));
    this.replaceChildren(root);
    this.#open([...open, ...this.expanded.split(',')].join(','));
    this.#choose(keep.length ? keep : (this.getAttribute('selected') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
    const first = /** @type {HTMLElement | null} */ (this.querySelector('[aria-selected=true], [aria-checked=true]') ?? this.querySelector(ROLE));
    if (first) first.tabIndex = 0;
  }

  #items() { return /** @type {HTMLElement[]} */ ([...this.querySelectorAll(ROLE)]); }
  #visible() { return this.#items().filter((li) => !li.parentElement?.closest('[role=group][hidden]')); }
  #byId(/** @type {string} */ id) { return this.#items().find((li) => li.dataset.id === id) ?? null; }

  #open(/** @type {string} */ ids) {
    for (const id of ids.split(',').map((s) => s.trim()).filter(Boolean)) { const li = this.#byId(id); if (li) this.#toggle(li, true, false); }
  }

  #toggle(/** @type {HTMLElement} */ li, /** @type {boolean} */ on, /** @type {boolean} */ fire = true) {
    const group = li.querySelector(':scope > [role=group]');
    if (li.hasAttribute('aria-busy') || !li.hasAttribute('aria-expanded') || li.getAttribute('aria-expanded') === String(on)) return;
    if (on && !group && li.hasAttribute('data-lazy')) { // children to load: the app answers with setChildren
      li.setAttribute('aria-busy', 'true');
      li.removeAttribute('data-lazy');
      this.emit('xo-tree-load', { id: li.dataset.id });
      return;
    }
    li.setAttribute('aria-expanded', String(on));
    if (group) /** @type {HTMLElement} */ (group).hidden = !on;
    if (fire) this.emit('xo-tree-toggle', { id: li.dataset.id, expanded: on });
  }

  /** Give a lazy item its children (answer to `xo-tree-load`); an empty list makes it a leaf. */
  setChildren(/** @type {string} */ id, /** @type {any[]} */ list) {
    const li = this.#byId(id);
    if (!li) return;
    li.removeAttribute('aria-busy');
    li.querySelector(':scope > [role=group]')?.remove();
    if (!list?.length) { li.removeAttribute('aria-expanded'); li.querySelector('.xo-tree__caret')?.classList.add('xo-tree__caret--leaf'); return; }
    li.querySelector('.xo-tree__caret')?.classList.remove('xo-tree__caret--leaf');
    this.#group(li, list, true);
    li.setAttribute('aria-expanded', 'true');
    this.#roll();
    this.emit('xo-tree-toggle', { id, expanded: true });
  }

  /** Make exactly these ids the selection (checking a parent checks its items). */
  #choose(/** @type {string[]} */ ids) {
    const mode = this.#mode();
    if (!mode) return;
    for (const li of this.#items()) li.setAttribute(`aria-${mode}`, 'false');
    for (const id of mode === 'selected' ? ids.slice(0, 1) : ids) {
      const li = this.#byId(id);
      if (li) for (const x of mode === 'checked' ? [li, ...li.querySelectorAll(ROLE)] : [li]) x.setAttribute(`aria-${mode}`, 'true');
    }
    this.#roll();
  }

  /** A parent is true when all its children are, false when none is, else mixed (children before parents: the list is in document order). */
  #roll() {
    if (!this.multiple) return;
    for (const li of this.#items().reverse()) {
      const kids = [...li.querySelectorAll(':scope > [role=group] > [role=treeitem]')].map((k) => k.getAttribute('aria-checked'));
      if (kids.length) li.setAttribute('aria-checked', kids.every((v) => v === 'true') ? 'true' : kids.every((v) => v === 'false') ? 'false' : 'mixed');
    }
  }

  #pick(/** @type {HTMLElement} */ li) {
    const mode = this.#mode();
    if (!mode) { this.#toggle(li, li.getAttribute('aria-expanded') !== 'true'); return; }
    if (mode === 'selected') this.#choose([li.dataset.id ?? '']);
    else {
      const on = li.getAttribute('aria-checked') !== 'true';
      for (const x of [li, ...li.querySelectorAll(ROLE)]) x.setAttribute('aria-checked', String(on));
      this.#roll();
    }
    this.emit('xo-tree-select', { id: li.dataset.id, selected: this.selected });
  }

  #focus(/** @type {HTMLElement | undefined | null} */ li) {
    if (!li) return;
    for (const x of this.#items()) x.tabIndex = x === li ? 0 : -1;
    li.focus();
  }

  #click(/** @type {MouseEvent} */ e) {
    const row = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest?.('.xo-tree__row'));
    const li = row?.parentElement;
    if (!li || !this.contains(li)) return;
    this.#focus(li);
    if ((/** @type {Element} */ (e.target)).closest('.xo-tree__caret')) this.#toggle(li, li.getAttribute('aria-expanded') !== 'true');
    else this.#pick(li);
  }

  #key(/** @type {KeyboardEvent} */ e) {
    const li = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest?.(ROLE));
    if (!li || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.keyCode === 229 || li !== e.target) return;
    const list = this.#visible(), i = list.indexOf(li);
    const rtl = getComputedStyle(this).direction === 'rtl';
    const open = li.getAttribute('aria-expanded');
    const k = e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? 'in' : e.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? 'out' : e.key;
    let to;
    if (k === 'ArrowDown') to = list[i + 1];
    else if (k === 'ArrowUp') to = list[i - 1];
    else if (k === 'Home') to = list[0];
    else if (k === 'End') to = list[list.length - 1];
    else if (k === 'in') { if (open === 'false') this.#toggle(li, true); else if (open === 'true') to = li.querySelector(ROLE); }
    else if (k === 'out') { if (open === 'true') this.#toggle(li, false); else to = li.parentElement?.closest(ROLE); }
    else if (k === '*') for (const s of li.parentElement?.children ?? []) this.#toggle(/** @type {HTMLElement} */ (s), true);
    else if (k === 'Enter' || (k === ' ' && !this.#typed)) this.#pick(li);
    else if (k.length === 1) { // type-ahead: the next item whose label starts with what was typed
      this.#typed += fold(k);
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => { this.#typed = ''; }, 600);
      const from = this.#typed.length === 1 ? i + 1 : i;
      const order = [...list.slice(from), ...list.slice(0, from)];
      to = order.find((x) => fold(x.querySelector('.xo-tree__label')?.textContent).startsWith(this.#typed));
    } else return;
    e.preventDefault();
    if (to) this.#focus(to);
  }
}
define('xo-tree', XoTree);
