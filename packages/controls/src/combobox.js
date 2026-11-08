// @ts-check
/**
 * <xo-combobox> picks one value from a list you can filter by typing (the WAI-ARIA editable combobox with list autocomplete).
 * `multiple` picks several, shown as removable chips. <xo-tags> is the same control for free text: type and press Enter or a comma.
 *
 *   <xo-combobox name="author" label="Author" placeholder="Choose">
 *     <option value="1">Ada Lovelace</option>
 *     <option value="2">Grace Hopper</option>
 *   </xo-combobox>
 *   <xo-combobox name="topics" multiple>...</xo-combobox>
 *   <xo-tags name="keywords" placeholder="Add a keyword"></xo-tags>
 *
 * It is a form control (`XoControl`): it has `name`, `required`, `disabled`, `value`, validity, `dirty` and `touched`, and it takes part in
 * <form xo-submit> like a native field. The value is a string, or an array of strings with `multiple` (and for <xo-tags>).
 *
 * - Options: `<option>` children, or `el.options = ['a', { value: 'b', label: 'B', disabled: true }]`; `selected` on an <option> sets the start value.
 *   The generated form (xo-form) passes the schema `enum` that way.
 * - `creatable` lets the person add a value that is not in the list (always on for <xo-tags>); `remote` leaves filtering to you:
 *   listen to `xo-search` ({ detail: { query } }) and set `options`.
 * - Keys: ArrowDown/ArrowUp open and move (the focus stays in the input), Enter picks, Escape closes, Backspace on an empty field removes the
 *   last chip; with `multiple` the list stays open after a pick.
 * - Chips and the list are in the Light DOM: style `.xo-chip`, `.xo-combobox-list [role=option]`. `aria-activedescendant` tracks the highlighted option.
 */
import { XoControl, define, text } from '@xoong/core';
import { prepareLayer, showLayer, hideLayer } from './layer.js';

let counter = 0;

/** @typedef {{ value: string, label: string, disabled?: boolean }} Option */

/** @param {any} o @returns {Option} */
const normalize = (o) => (o && typeof o === 'object' ? { value: String(o.value), label: String(o.label ?? o.value), ...(o.disabled ? { disabled: true } : {}) } : { value: String(o), label: String(o) });

class XoCombobox extends XoControl {
  static props = { ...XoControl.props, placeholder: String, label: String, multiple: Boolean, creatable: Boolean, remote: Boolean };

  /** @type {Option[]} */ #options = [];
  #fromSchema = true; // the options came from the schema (or nowhere yet), not from markup or `el.options`
  /** @type {any} */ #schema = null;
  /** @type {HTMLInputElement | null} */ #input = null;
  /** @type {HTMLElement | null} */ #box = null;
  /** @type {HTMLElement | null} */ #list = null;
  #query = '';
  #active = -1;
  /** @type {Option[]} */ #shown = [];
  #open = false;
  #stopFollowing = () => {};
  #built = false;
  #id = `xo-combobox-${++counter}`;
  #onDocument = (/** @type {Event} */ event) => { if (!this.contains(/** @type {Node} */ (event.target))) this.#close(); };

  constructor() {
    super();
    // `options` or `schema` assigned before the element was upgraded (used before `define`) are own properties that hide the accessors: re-assign them
    for (const key of /** @type {const} */ (['options', 'schema'])) {
      if (Object.prototype.hasOwnProperty.call(this, key)) { const early = /** @type {any} */ (this)[key]; delete (/** @type {any} */ (this))[key]; /** @type {any} */ (this)[key] = early; }
    }
  }

  // ---- options ---------------------------------------------------------------------------------------------------------

  get options() { return this.#options; }
  set options(list) {
    this.#fromSchema = false;
    this.#options = (list ?? []).map(normalize);
    if (this.#built) { this.#syncText(); this.#renderChips(); if (this.#open) this.#refresh(); } // chips show labels, so they follow the options
  }

  /**
   * The schema node of the field (the form binder sets it): an `enum` gives the options, an array of an `enum` gives them with `multiple`.
   * This is how a generated form (`widget: "xo-combobox"` hint) fills the control without any markup.
   */
  get schema() { return this.#schema; }
  set schema(node) {
    this.#schema = node;
    const many = node?.t === 'array';
    const values = node?.enum ?? (many ? node?.items?.enum : undefined);
    if (many && !this.multiple) this.setAttribute('multiple', '');
    if (values && this.#fromSchema) {
      this.#options = values.map(normalize);
      if (this.#built) { this.#syncText(); this.#renderChips(); if (this.#open) this.#refresh(); }
    }
  }

  /** Whether this control holds several values. */
  get #many() { return this.multiple; }
  get #values() { const v = this.value; return Array.isArray(v) ? v : v === '' || v == null ? [] : [String(v)]; }

  setValue(v) {
    if (this.#many && typeof v === 'string') v = v === '' ? [] : v.split(',').map((s) => s.trim()).filter(Boolean);
    super.setValue(this.#many ? (Array.isArray(v) ? v.map(String) : []) : (v == null ? '' : String(v)));
    if (this.#built) { this.#syncText(); this.#renderChips(); }
  }

  isEmpty(v) { return v == null || v === '' || (Array.isArray(v) && v.length === 0); }

  serialize(v) {
    if (!Array.isArray(v)) return super.serialize(v);
    if (typeof FormData === 'undefined') return JSON.stringify(v);
    const data = new FormData();
    for (const item of v) data.append(this.name, item);
    return data;
  }

  get focusTarget() { return this.#input; }

  // ---- lifecycle -------------------------------------------------------------------------------------------------------

  connected() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.#build(), { once: true });
    else queueMicrotask(() => this.#build());
  }

  disconnected() { document.removeEventListener('pointerdown', this.#onDocument); this.#stopFollowing(); }

  #build() {
    if (this.#built || !this.isConnected) return;
    // <option> children are the data; the control draws its own content.
    const fromMarkup = /** @type {HTMLOptionElement[]} */ ([...this.querySelectorAll(':scope > option')]);
    if (fromMarkup.length) this.#fromSchema = false;
    if (fromMarkup.length && !this.#options.length) this.#options = fromMarkup.map((o) => normalize({ value: o.value, label: o.textContent?.trim() || o.value, disabled: o.disabled }));
    const chosen = fromMarkup.filter((o) => o.selected && o.hasAttribute('selected')).map((o) => o.value);
    fromMarkup.forEach((o) => o.remove());

    const box = document.createElement('div');
    box.className = 'xo-combobox-box';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'xo-combobox-input';
    input.autocomplete = 'off';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', `${this.#id}-list`);
    input.setAttribute('aria-label', this.label || this.name || 'Combobox');
    if (this.placeholder) input.placeholder = this.placeholder;
    const list = document.createElement('ul');
    list.id = `${this.#id}-list`;
    list.className = 'xo-combobox-list';
    list.setAttribute('role', 'listbox');
    if (this.#many) list.setAttribute('aria-multiselectable', 'true');
    prepareLayer(list);
    box.append(input);
    this.append(box, list);
    this.#box = box; this.#input = input; this.#list = list;
    this.#built = true;

    // The inner input's own input/change events are not the control's: only userInput/userChange speak for the control.
    for (const type of ['input', 'change']) input.addEventListener(type, (e) => e.stopPropagation());
    input.addEventListener('input', () => { this.#query = input.value; this.#open || this.#openList(); this.#refresh(); if (this.remote) this.dispatchEvent(new CustomEvent('xo-search', { bubbles: true, detail: { query: this.#query } })); });
    input.addEventListener('keydown', (e) => this.#onKey(e));
    input.addEventListener('focus', () => { if (!this.#many) input.select(); });
    input.addEventListener('click', () => { this.#openList(); }); // a click into the field shows the choices
    input.addEventListener('blur', () => { setTimeout(() => { if (!this.contains(document.activeElement)) this.#blurred(); }, 0); });
    box.addEventListener('mousedown', (e) => { if (e.target !== input && !(/** @type {Element} */ (e.target).closest('.xo-chip button'))) { e.preventDefault(); input.focus(); this.#openList(); this.#refresh(); } });
    list.addEventListener('mousedown', (e) => e.preventDefault()); // keep the focus in the input while choosing
    list.addEventListener('click', (e) => {
      const li = /** @type {Element} */ (e.target).closest('[role=option]');
      if (li) this.#choose(Number(/** @type {HTMLElement} */ (li).dataset.index));
    });
    box.addEventListener('click', (e) => {
      const button = /** @type {Element} */ (e.target).closest('.xo-chip button');
      if (button) this.#removeValue(/** @type {HTMLElement} */ (button).dataset.value ?? '');
    });

    if (chosen.length && this.isEmpty(this.value)) this.setValue(this.#many ? chosen : chosen[0]);
    else if (this.#many && typeof this.value === 'string') this.setValue(this.value);
    if (this.#many === false && Array.isArray(this.value)) this.setValue(this.value[0] ?? '');
    this.#syncText();
    this.#renderChips();
    this.markPristine();
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (!this.#built) return;
    if (attr === 'placeholder' && this.#input) this.#input.placeholder = value ?? '';
    if ((attr === 'disabled' || attr === 'readonly') && this.#input) { this.#input.disabled = this.isDisabled; this.#input.readOnly = this.readonly; }
  }

  // ---- display ---------------------------------------------------------------------------------------------------------

  #labelOf(/** @type {string} */ value) { return this.#options.find((o) => o.value === value)?.label ?? value; }

  /** Single mode shows the chosen label in the field; multiple mode keeps the field for typing. */
  #syncText() {
    if (!this.#input) return;
    this.#input.disabled = this.isDisabled;
    this.#input.readOnly = this.readonly;
    if (!this.#many) { this.#query = ''; this.#input.value = this.#values[0] === undefined ? '' : this.#labelOf(this.#values[0]); }
  }

  #renderChips() {
    const box = this.#box;
    if (!box || !this.#many) return;
    for (const chip of [...box.querySelectorAll('.xo-chip')]) chip.remove();
    for (const value of this.#values) {
      const chip = document.createElement('span');
      chip.className = 'xo-chip';
      const label = this.#labelOf(value);
      chip.append(label);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.tabIndex = -1;
      remove.dataset.value = value;
      remove.textContent = '×';
      remove.setAttribute('aria-label', text('xoong.controls.remove', 'Remove {label}', { label }));
      chip.append(remove);
      box.insertBefore(chip, this.#input);
    }
  }

  /** The options that match what was typed (all of them in `remote` mode), without those already chosen, plus the "add" row. */
  #matches() {
    const q = this.#query.trim().toLowerCase();
    const taken = this.#many ? new Set(this.#values) : new Set();
    const found = this.#options.filter((o) => !taken.has(o.value) && (this.remote || !q || o.label.toLowerCase().includes(q)));
    const typed = this.#query.trim();
    if (this.creatable) {
      if (typed && !this.#options.some((o) => o.label.toLowerCase() === typed.toLowerCase()) && !taken.has(typed)) found.push({ value: typed, label: text('xoong.controls.create', 'Add "{value}"', { value: typed }), create: true });
    }
    return found;
  }

  #refresh() {
    const list = this.#list;
    if (!list || !this.#input) return;
    this.#shown = this.#matches();
    list.replaceChildren();
    if (!this.#shown.length) {
      const empty = document.createElement('li');
      empty.className = 'xo-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = text('xoong.controls.noResults', 'No results');
      list.append(empty);
    }
    this.#shown.forEach((o, i) => {
      const li = document.createElement('li');
      li.id = `${this.#id}-option-${i}`;
      li.setAttribute('role', 'option');
      li.dataset.index = String(i);
      li.textContent = o.label;
      const selected = !this.#many && this.#values[0] === o.value;
      li.setAttribute('aria-selected', String(selected));
      if (o.disabled) li.setAttribute('aria-disabled', 'true');
      list.append(li);
    });
    this.#active = this.#shown.findIndex((o) => !o.disabled);
    if (!this.#many && this.#values[0] !== undefined && !this.#query) { const at = this.#shown.findIndex((o) => o.value === this.#values[0]); if (at >= 0) this.#active = at; }
    this.#highlight();
  }

  #highlight() {
    const input = this.#input;
    if (!input || !this.#list) return;
    for (const li of this.#list.querySelectorAll('[role=option]')) li.classList.toggle('xo-active', li.id === `${this.#id}-option-${this.#active}`);
    if (this.#active >= 0) { input.setAttribute('aria-activedescendant', `${this.#id}-option-${this.#active}`); this.#list.querySelector('.xo-active')?.scrollIntoView?.({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }

  // ---- opening and choosing --------------------------------------------------------------------------------------------

  #openList() {
    if (this.#open || this.isDisabled || this.readonly || !this.#list || !this.#box) return;
    this.#open = true;
    this.#refresh();
    this.#stopFollowing = showLayer(this.#list, this.#box, { matchWidth: true });
    this.#input?.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this.#onDocument);
  }

  #close() {
    if (!this.#open || !this.#list) return;
    this.#open = false;
    this.#stopFollowing();
    hideLayer(this.#list);
    this.#input?.setAttribute('aria-expanded', 'false');
    this.#input?.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', this.#onDocument);
  }

  #blurred() {
    if (this.creatable && this.#many && this.#query.trim()) this.#add(this.#query.trim());
    this.#close();
    if (this.#many && this.#input) { this.#query = ''; this.#input.value = ''; } else this.#syncText();
    this.markTouched();
  }

  #choose(/** @type {number} */ index) {
    const o = this.#shown[index];
    if (!o || o.disabled) return;
    this.#add(o.value, /** @type {any} */ (o).create);
  }

  #add(/** @type {string} */ value, created = false) {
    if (created && !this.#options.some((o) => o.value === value)) this.#options = [...this.#options, { value, label: value }];
    if (this.#many) {
      if (this.#values.includes(value)) return;
      this.userInput([...this.#values, value]);
      this.#query = '';
      if (this.#input) this.#input.value = '';
      this.#renderChips();
      this.#refresh();
    } else {
      this.userInput(value);
      this.#syncText();
      this.#close();
    }
    this.userChange();
  }

  #removeValue(/** @type {string} */ value) {
    this.userInput(this.#values.filter((v) => v !== value));
    this.userChange();
    this.#renderChips();
    if (this.#open) this.#refresh();
    this.#input?.focus();
  }

  #onKey(/** @type {KeyboardEvent} */ event) {
    const move = (/** @type {number} */ step) => {
      if (!this.#open) { this.#openList(); return; }
      const n = this.#shown.length;
      if (!n) return;
      let i = this.#active;
      for (let tries = 0; tries < n; tries++) { i = (i + step + n) % n; if (!this.#shown[i].disabled) break; }
      this.#active = i;
      this.#highlight();
    };
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); move(1); return;
      case 'ArrowUp': event.preventDefault(); move(-1); return;
      case 'Home': case 'End':
        if (this.#open && this.#active >= 0) { event.preventDefault(); this.#active = event.key === 'Home' ? 0 : this.#shown.length - 1; this.#highlight(); }
        return;
      case 'Enter':
        if (this.#open) event.preventDefault(); // Enter never submits the form while the list is open
        if (this.#open && this.#active >= 0) this.#choose(this.#active);
        else if (this.creatable && this.#query.trim()) { event.preventDefault(); this.#add(this.#query.trim(), true); }
        return;
      case ',':
        if (this.creatable && this.#many && this.#query.trim()) { event.preventDefault(); this.#add(this.#query.trim(), true); }
        return;
      case 'Escape':
        if (this.#open) { event.preventDefault(); event.stopPropagation(); this.#close(); this.#syncText(); }
        return;
      case 'Backspace':
        if (this.#many && !this.#input?.value && this.#values.length) { event.preventDefault(); this.#removeValue(this.#values[this.#values.length - 1]); }
        return;
      default:
    }
  }
}
define('xo-combobox', XoCombobox);

/** <xo-tags>: a combobox of free text values (multiple and creatable by default). */
class XoTags extends XoCombobox {
  connected() {
    this.setAttribute('multiple', '');
    this.setAttribute('creatable', '');
    super.connected();
  }
}
define('xo-tags', XoTags);
